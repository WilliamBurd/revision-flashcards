import { useState } from 'react'
import { btn, input, label } from '../components/ui'
import { useAccount } from '../sync/AccountProvider'

/** Sign in or create an account. Shown until someone is signed in on this device. */
export default function Login() {
  const { signIn, signUp, sendPasswordReset } = useAccount()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const signingUp = mode === 'signup'
  const resetting = mode === 'reset'

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (resetting) {
        await sendPasswordReset(email)
        setResetSent(true)
      } else if (signingUp) {
        const needsConfirm = await signUp(email, password)
        if (needsConfirm) setConfirmSent(true)
      } else {
        await signIn(email, password)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/favicon.svg" alt="" width={56} height={56} />
          <h1 className="text-3xl">Burdis Flashcards</h1>
          <p className="text-muted">
            {resetting
              ? "Enter your email and we'll send you a link to choose a new password."
              : signingUp
                ? 'Create an account so your cards are saved and sync between your phone and computer.'
                : 'Sign in to see your cards on this device.'}
          </p>
        </div>

        {resetSent ? (
          <div className="card p-5 text-center">
            <p className="mb-2 font-semibold">Check your email</p>
            <p className="text-muted">
              If {email} has an account, a link is on its way. Open it on this device to choose a new password. It can take a
              minute or two, so check your spam folder too.
            </p>
            <button
              type="button"
              className={`${btn.secondary} mt-4 w-full`}
              onClick={() => {
                setResetSent(false)
                setMode('signin')
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : confirmSent ? (
          <div className="card p-5 text-center">
            <p className="mb-2 font-semibold">Check your email</p>
            <p className="text-muted">We sent a link to {email}. Open it to confirm your account, then sign in here.</p>
            <button
              type="button"
              className={`${btn.secondary} mt-4 w-full`}
              onClick={() => {
                setConfirmSent(false)
                setMode('signin')
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form
            className="card flex flex-col gap-4 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div>
              <label htmlFor="email" className={label}>
                Email
              </label>
              <input
                id="email"
                type="email"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
                autoFocus
              />
            </div>
            <div hidden={resetting}>
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className={label}>
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
                    onClick={() => {
                      setMode('reset')
                      setError(null)
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signingUp ? 'new-password' : 'current-password'}
                minLength={6}
                required={!resetting}
                disabled={resetting}
              />
              {signingUp && <p className="mt-1 text-sm text-muted">At least 6 characters.</p>}
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            )}
            <button type="submit" className={btn.primary} disabled={busy}>
              {busy ? 'Please wait…' : resetting ? 'Send reset link' : signingUp ? 'Create account' : 'Sign in'}
            </button>
          </form>
        )}

        {resetting && !resetSent && (
          <p className="text-center">
            <button type="button" className="font-semibold text-accent underline-offset-4 hover:underline" onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          </p>
        )}
        {!confirmSent && !resetting && (
          <p className="text-center text-muted">
            {signingUp ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              className="font-semibold text-accent underline-offset-4 hover:underline"
              onClick={() => {
                setMode(signingUp ? 'signin' : 'signup')
                setError(null)
              }}
            >
              {signingUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

/** After opening a password reset link: choose the new password. */
export function NewPassword() {
  const { setNewPassword } = useAccount()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/favicon.svg" alt="" width={56} height={56} />
          <h1 className="text-3xl">Choose a new password</h1>
        </div>
        <form
          className="card flex flex-col gap-4 p-5"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              await setNewPassword(password)
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <div>
            <label htmlFor="new-password" className={label}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
              autoFocus
            />
            <p className="mt-1 text-sm text-muted">At least 6 characters.</p>
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? 'Please wait…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
