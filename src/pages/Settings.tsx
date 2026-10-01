import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ReactNode } from 'react'
import { useLayout } from '../components/Layout'
import { btn, input } from '../components/ui'
import { download, exportBackup, importBackup, readBackup, BackupError, type ImportResult } from '../backup/backup'
import { getSettings, updateSettings } from '../db/settings'
import { useAccount } from '../sync/AccountProvider'
import { dayKey } from '../lib/day'
import { installApp, useInstallState } from '../lib/install'

export default function Settings() {
  const settings = useLiveQuery(() => getSettings())
  const { openThemePicker, openAccount } = useLayout()
  const { configured, email } = useAccount()
  if (!settings) return null
  const retention = Math.round(settings.target_retention * 100)

  return (
    <div className="flex flex-col gap-6 py-6 lg:py-10">
      <h1 className="text-3xl tracking-tight">Settings</h1>

      <Section title="Studying">
        <div className="flex flex-col gap-2">
          <label htmlFor="retention" className="flex items-baseline justify-between gap-4">
            <span className="font-semibold">Target retention</span>
            <span className="font-display text-xl">{retention}%</span>
          </label>
          <input
            id="retention"
            type="range"
            min={80}
            max={95}
            step={1}
            value={retention}
            onChange={(e) => void updateSettings({ target_retention: Number(e.target.value) / 100 })}
            className="h-11 w-full accent-[var(--accent)]"
          />
          <p className="text-sm text-muted">
            How often you want to remember a card when it comes back. Higher means more reviews; 90% suits most people.
            In the two weeks before an exam it goes up to 95% automatically.
          </p>
        </div>
        <NumberSetting
          label="Longest gap between reviews"
          unit="days"
          hint="A card you know well never waits longer than this."
          value={settings.max_interval_days}
          min={1}
          max={3650}
          onChange={(n) => void updateSettings({ max_interval_days: n })}
        />
        <NumberSetting
          label="New cards per day, all sets"
          unit="cards"
          hint="Each set also has its own limit, on the set's page."
          value={settings.new_cards_per_day_total}
          min={0}
          max={999}
          onChange={(n) => void updateSettings({ new_cards_per_day_total: n })}
        />
      </Section>

      <Section title="Look">
        <button type="button" className={`${btn.secondary} self-start`} onClick={openThemePicker}>
          Change theme
        </button>
      </Section>

      <Section title="Home screen">
        <InstallApp />
      </Section>

      {configured && (
        <Section title="Account">
          <p className="text-sm text-muted">
            Signed in as <span className="font-semibold text-ink">{email}</span>
          </p>
          <button type="button" className={`${btn.secondary} self-start`} onClick={openAccount}>
            Sync and sign out
          </button>
        </Section>
      )}

      <Section title="Backup">
        <Backup />
      </Section>
    </div>
  )
}

function InstallApp() {
  const state = useInstallState()
  const [result, setResult] = useState<string | null>(null)

  async function install() {
    try {
      const outcome = await installApp()
      setResult(
        outcome === 'accepted'
          ? 'Chrome is adding it now. Look in your app drawer (swipe up on the home screen) for Burdis Flashcards, then drag it onto your home screen.'
          : outcome === 'dismissed'
            ? 'The install box was closed. Reload the page to try again.'
            : 'Chrome has stopped offering the install. Reload the page to try again.',
      )
    } catch (e) {
      setResult(`Chrome said: ${(e as Error).message || String(e)}`)
    }
  }

  const message = result && (
    <p role="status" className="text-sm font-semibold text-ink">
      {result}
    </p>
  )
  if (state === 'installed') return <p className="text-sm text-muted">The app is on your home screen.</p>
  if (state === 'ready') {
    return (
      <>
        <p className="text-sm text-muted">Put Burdis Flashcards on your home screen so it opens full screen like a normal app.</p>
        <button type="button" className={`${btn.primary} self-start`} onClick={() => void install()}>
          Add to home screen
        </button>
        {message}
      </>
    )
  }
  return (
    <>
      {message}
      <p className="text-sm text-muted">
        In Chrome, open the ⋮ menu and choose <span className="font-semibold text-ink">Add to Home screen</span> or{' '}
        <span className="font-semibold text-ink">Install app</span>. If it's already installed, look for Burdis Flashcards in
        your app drawer.
      </p>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="card flex flex-col gap-5 p-4">{children}</div>
    </section>
  )
}

function NumberSetting(props: {
  label: string
  unit: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-4">
        <span className="font-semibold">{props.label}</span>
        <span className="flex shrink-0 items-center gap-2">
          <input
            key={props.value}
            type="number"
            inputMode="numeric"
            min={props.min}
            max={props.max}
            defaultValue={props.value}
            className={`${input} w-24 py-2 text-center text-base`}
            onBlur={(e) => {
              const n = Math.round(Number(e.target.value))
              if (!Number.isFinite(n) || e.target.value === '') return void (e.target.value = String(props.value))
              const clamped = Math.max(props.min, Math.min(props.max, n))
              e.target.value = String(clamped)
              if (clamped !== props.value) props.onChange(clamped)
            }}
          />
          <span className="text-sm text-muted">{props.unit}</span>
        </span>
      </label>
      <p className="text-sm text-muted">{props.hint}</p>
    </div>
  )
}

function Backup() {
  const file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function exportAll() {
    const backup = await exportBackup()
    download(`burdis-flashcards-${dayKey(Date.now())}.json`, JSON.stringify(backup), 'application/json')
    setMessage({ ok: true, text: `Saved ${backup.cards.length} cards and ${backup.review_logs.length} reviews.` })
  }

  async function importFile(f: File) {
    setBusy(true)
    setMessage(null)
    try {
      let data: unknown
      try {
        data = JSON.parse(await f.text())
      } catch {
        throw new BackupError("That file couldn't be read. Choose a .json backup made by this app.")
      }
      setMessage({ ok: true, text: describeImport(await importBackup(readBackup(data))) })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof BackupError ? e.message : 'Something went wrong importing that file.' })
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <>
      <p className="text-sm text-muted">
        A backup file holds all your subjects, sets and cards with their progress. Importing one adds anything missing
        here and never removes cards. To move cards to or from a spreadsheet, use CSV on a set's page.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} onClick={() => void exportAll()}>
          Export everything
        </button>
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => file.current?.click()}>
          {busy ? 'Importing…' : 'Import a backup'}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
          }}
        />
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-positive' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </>
  )
}

function describeImport(r: ImportResult): string {
  if (!r.cards && !r.notes && !r.sets && !r.subjects && !r.reviews) return 'Everything in that file is already here.'
  const parts = [`${r.cards} ${r.cards === 1 ? 'card' : 'cards'}`, `${r.reviews} ${r.reviews === 1 ? 'review' : 'reviews'}`]
  if (r.sets) parts.unshift(`${r.sets} ${r.sets === 1 ? 'set' : 'sets'}`)
  return `Imported ${parts.join(', ')}.`
}
