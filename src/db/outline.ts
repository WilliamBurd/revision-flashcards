// How a subject is laid out on screen: its topics in order, each with its
// sets, then the sets sitting directly in the subject.

import { topicKey } from './subjects'
import type { CardSet, Subject, Topic } from './types'

export interface TopicGroup {
  /** The topicKey: what this group's Review button and new-card limit use. */
  key: string
  /** Null for the sets sitting directly in the subject. */
  topic: Topic | null
  sets: CardSet[]
}

/** A subject's topics in order (even empty ones), then its sets with no topic. */
export function subjectOutline(subject: Subject, topics: Topic[], sets: CardSet[]): TopicGroup[] {
  const live = new Set(topics.map((t) => t.id))
  const inSubject = sets.filter((s) => s.subject_id === subject.id)
  const groups: TopicGroup[] = topics
    .filter((t) => t.subject_id === subject.id)
    .map((topic) => ({ key: topic.id, topic, sets: inSubject.filter((s) => topicKey(s, live) === topic.id) }))
  const key = `subject:${subject.id}`
  groups.push({ key, topic: null, sets: inSubject.filter((s) => topicKey(s, live) === key) })
  return groups
}

/** "1900s Britain · Economics", or just the set's name when it isn't in a topic. */
export function setLabel(set: CardSet, topics: Topic[]): string {
  const topic = topics.find((t) => t.id === set.topic_id)
  return topic ? `${topic.name} · ${set.name}` : set.name
}
