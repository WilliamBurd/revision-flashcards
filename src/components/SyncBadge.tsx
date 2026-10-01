import { useAccount } from '../sync/AccountProvider'
import type { SyncStatus } from '../sync/engine'

const DOT: Record<string, string> = {
  synced: 'bg-positive',
  pending: 'bg-bar-learning',
  syncing: 'bg-bar-learning animate-pulse',
  offline: 'bg-muted',
  error: 'bg-danger',
  idle: 'bg-muted',
}

export function syncLabel(status: SyncStatus): string {
  switch (status.state) {
    case 'synced':
      return 'Synced'
    case 'syncing':
      return 'Syncing…'
    case 'pending':
      return `${status.pending} to sync`
    case 'offline':
      return status.pending ? `Offline · ${status.pending} to sync` : 'Offline'
    case 'error':
      return 'Sync problem'
    default:
      return 'Connecting…'
  }
}

/** Small "Synced / 3 to sync / Offline" pill. */
export default function SyncBadge({ onClick }: { onClick?: () => void }) {
  const { configured, session, status } = useAccount()
  if (!configured || !session) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-muted hover:text-ink"
      aria-label={`Sync status: ${syncLabel(status)}. Open account`}
    >
      <span className={`h-2 w-2 rounded-full ${DOT[status.state]}`} aria-hidden="true" />
      {syncLabel(status)}
    </button>
  )
}
