import { useAccount } from '../sync/AccountProvider'
import Modal from './Modal'
import { syncLabel } from './SyncBadge'
import { btn } from './ui'

export default function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email, status, syncNow, signOut } = useAccount()
  const last = status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <Modal open={open} onClose={onClose} title="Account">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-muted">Signed in as</p>
          <p className="font-semibold break-all">{email}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Sync</p>
          <p className="font-semibold">
            {syncLabel(status)}
            {last && status.state === 'synced' ? ` at ${last}` : ''}
          </p>
          {status.error && <p className="mt-1 text-sm text-danger">{status.error}</p>}
          {status.state === 'offline' && (
            <p className="mt-1 text-sm text-muted">Keep studying. Your progress is saved here and syncs when you’re back online.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => void syncNow()} disabled={status.state === 'syncing'}>
            Sync now
          </button>
          <button
            type="button"
            className={`${btn.ghost} text-danger`}
            onClick={async () => {
              await signOut()
              onClose()
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </Modal>
  )
}
