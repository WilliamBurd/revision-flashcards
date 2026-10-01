import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { asSyncWrite, db, SYNCED_TABLES } from '../db/db'
import { countPending, SyncEngine, type SyncStatus } from './engine'
import { SupabaseRemote } from './remote'
import { supabase } from './supabase'

interface Account {
  /** False when no Supabase project is set up: the app then works on this device only. */
  configured: boolean
  loading: boolean
  session: Session | null
  email: string | null
  status: SyncStatus
  signIn: (email: string, password: string) => Promise<void>
  /** Returns true if the account still needs its email confirming. */
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
  /** Email a link for choosing a new password. */
  sendPasswordReset: (email: string) => Promise<void>
  /** True after opening that link: the app asks for a new password. */
  recovering: boolean
  setNewPassword: (password: string) => Promise<void>
}

const OFFLINE_STATUS: SyncStatus = { state: 'idle', pending: 0, lastSyncedAt: null, error: null }
const AccountContext = createContext<Account | null>(null)

export function useAccount(): Account {
  const account = useContext(AccountContext)
  if (!account) throw new Error('useAccount must be used inside AccountProvider')
  return account
}

/**
 * Data on this device belongs to whoever is signed in. If someone else signs
 * in, the previous person's cards are cleared from this device (they stay
 * safe in the cloud). Cards made before any account existed are kept and
 * uploaded into the first account that signs in.
 */
async function claimDevice(userId: string): Promise<void> {
  const owner = (await db.meta.get('owner'))?.value
  if (owner === userId) return
  await asSyncWrite(db, [...SYNCED_TABLES, 'meta'], async () => {
    if (owner) {
      for (const t of SYNCED_TABLES) await db.table(t).clear()
    }
    await db.meta.clear()
    await db.meta.put({ key: 'owner', value: userId })
  })
}

async function clearDevice(): Promise<void> {
  await asSyncWrite(db, [...SYNCED_TABLES, 'meta'], async () => {
    for (const t of [...SYNCED_TABLES, 'meta']) await db.table(t).clear()
  })
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)
  const [status, setStatus] = useState<SyncStatus>(OFFLINE_STATUS)
  const [recovering, setRecovering] = useState(false)
  const engine = useRef<SyncEngine | null>(null)
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Opening a reset link signs you in for long enough to choose a new password.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Start syncing once someone is signed in.
  useEffect(() => {
    if (!supabase || !userId) return
    let cancelled = false
    let unsubscribe = () => {}
    void claimDevice(userId).then(() => {
      if (cancelled) return
      const e = new SyncEngine(db, new SupabaseRemote(supabase!))
      engine.current = e
      unsubscribe = e.subscribe(setStatus)
      e.start()
    })
    return () => {
      cancelled = true
      unsubscribe()
      engine.current?.stop()
      engine.current = null
      setStatus(OFFLINE_STATUS)
    }
  }, [userId])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(friendlyError(error.message))
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password })
    if (error) throw new Error(friendlyError(error.message))
    return !data.session
  }, [])

  const signOut = useCallback(async () => {
    await engine.current?.sync()
    const pending = await countPending(db)
    if (
      pending > 0 &&
      !window.confirm(
        `${pending} ${pending === 1 ? 'change hasn’t' : 'changes haven’t'} synced yet and will be lost if you sign out now. Sign out anyway?`,
      )
    ) {
      return
    }
    engine.current?.stop()
    await supabase!.auth.signOut({ scope: 'local' })
    await clearDevice()
  }, [])

  const syncNow = useCallback(async () => {
    await engine.current?.sync()
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    if (error) throw new Error(friendlyError(error.message))
  }, [])

  const setNewPassword = useCallback(async (password: string) => {
    const { error } = await supabase!.auth.updateUser({ password })
    if (error) throw new Error(friendlyError(error.message))
    setRecovering(false)
  }, [])

  const value = useMemo<Account>(
    () => ({
      configured: supabase !== null,
      loading,
      session,
      email: session?.user.email ?? null,
      status,
      signIn,
      signUp,
      signOut,
      syncNow,
      sendPasswordReset,
      recovering,
      setNewPassword,
    }),
    [loading, session, status, signIn, signUp, signOut, syncNow, sendPasswordReset, recovering, setNewPassword],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match an account.'
  if (/already registered/i.test(message)) return 'There’s already an account with that email. Try signing in.'
  if (/password should be at least/i.test(message)) return 'Your password needs to be at least 6 characters.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address first.'
  if (/rate limit|too many|security purposes/i.test(message)) return 'Too many emails sent. Wait a few minutes and try again.'
  if (/should be different/i.test(message)) return 'Choose a password different from your old one.'
  if (/fetch|network/i.test(message)) return 'Can’t reach the server. Check your connection and try again.'
  return message
}
