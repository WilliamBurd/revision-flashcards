import { useLiveQuery } from 'dexie-react-hooks'
import { getOverview } from './study'
import { listSets, listSubjects } from './subjects'

/** Subjects and sets, kept up to date as the database changes. */
export function useLibrary() {
  return useLiveQuery(async () => {
    const [subjects, sets] = await Promise.all([listSubjects(), listSets()])
    return { subjects, sets }
  })
}

/** Due / new / total counts per set, kept up to date. */
export function useOverview() {
  return useLiveQuery(() => getOverview())
}
