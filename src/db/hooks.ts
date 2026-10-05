import { useLiveQuery } from 'dexie-react-hooks'
import { allTags } from './notes'
import { getOverview } from './study'
import { listSets, listSubjects, listTopics } from './subjects'

/** Subjects, topics and sets, kept up to date as the database changes. */
export function useLibrary() {
  return useLiveQuery(async () => {
    const [subjects, topics, sets] = await Promise.all([listSubjects(), listTopics(), listSets()])
    return { subjects, topics, sets }
  })
}

/** Due / new / total counts per set, kept up to date. */
export function useOverview() {
  return useLiveQuery(() => getOverview())
}

/** Every tag in use, most used first. */
export function useTags() {
  return useLiveQuery(() => allTags(), []) ?? []
}
