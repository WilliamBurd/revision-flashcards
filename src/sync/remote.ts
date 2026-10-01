// The cloud side of syncing. The engine only talks to this small interface,
// so tests can swap in an in-memory server.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncedTable } from '../db/db'

/** A row as stored in the cloud: the device's fields plus server bookkeeping. */
export type ServerRow = Record<string, unknown> & { server_updated_at: string }

export interface Remote {
  /** Rows changed after `since` (an ISO time from server_updated_at), oldest first. */
  pull(table: SyncedTable, since: string | null, limit: number): Promise<ServerRow[]>
  /** Insert or update rows (matched by id, or by user for settings). */
  push(table: SyncedTable, rows: Record<string, unknown>[]): Promise<void>
}

export class SupabaseRemote implements Remote {
  constructor(private client: SupabaseClient) {}

  async pull(table: SyncedTable, since: string | null, limit: number): Promise<ServerRow[]> {
    let query = this.client.from(table).select('*').order('server_updated_at', { ascending: true }).limit(limit)
    if (since) query = query.gt('server_updated_at', since)
    const { data, error } = await query
    if (error) throw new Error(`Couldn't download ${table}: ${error.message}`)
    return (data ?? []) as ServerRow[]
  }

  async push(table: SyncedTable, rows: Record<string, unknown>[]): Promise<void> {
    if (!rows.length) return
    const { error } = await this.client
      .from(table)
      .upsert(rows, { onConflict: table === 'settings' ? 'user_id' : 'id' })
    if (error) throw new Error(`Couldn't upload ${table}: ${error.message}`)
  }
}
