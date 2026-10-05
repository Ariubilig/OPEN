// RSS feeds: the site's (/rss.xml) and one per topic, written by scripts/prerender.ts.
import type { Topic } from '../data/schema.ts'

/** English names for the file paths (CLAUDE.md rule 1). */
export const TOPIC_SLUGS = {
  Татвар: 'tax',
  'Төсөв ба санхүү': 'budget',
  'Орон сууц': 'housing',
  Боловсрол: 'education',
  'Эрүүл мэнд': 'health',
  'Ажил ба нийгмийн даатгал': 'work',
  'Эрчим хүч': 'energy',
  'Байгаль орчин': 'environment',
  'Хот ба дэд бүтэц': 'city',
  Засаглал: 'governance',
} as const satisfies Record<Topic, string>

/** Where a topic's feed is served, without the leading slash: rss/tax.xml */
export const topicFeedPath = (topic: Topic) => `rss/${TOPIC_SLUGS[topic]}.xml`
