// Alert emails: Mongolian text (the edge functions' copy file, like src/copy.ts for the site).
// Every fact in them comes from the database: the story's title and stages, never written here.

const TODO = 'TODO_VERIFY'
// the same label as the site's placeholder (src/copy.ts)
const PLACEHOLDER = 'Баталгаажуулж байна'

export const emailCopy = {
  notOfficial: 'Энэ бол УИХ-ын албан ёсны сайт биш.',
  disclaimer: 'Энэ нь мэдээлэл бөгөөд хуулийн зөвлөгөө биш.',
  confirm: {
    subject: (title: string) =>
      `«${title}» мэдээний мэдэгдлийг баталгаажуулна уу`,
    intro: (title: string) =>
      `Та «${title}» мэдээг дагахаар бүртгүүллээ. Баримт бичгийн шат өөрчлөгдөхөд энэ хаяг руу мэдэгдэнэ.`,
    action: 'Баталгаажуулах',
    ignore:
      'Та бүртгүүлээгүй бол энэ захидлыг устгана уу. Баталгаажуулаагүй хаяг руу өөр захидал илгээхгүй.',
  },
  stageChange: {
    subject: (title: string) => `«${title}»: шат өөрчлөгдлөө`,
    intro: (title: string) =>
      `«${title}» мэдээний баримт бичгийн шат өөрчлөгдлөө:`,
    read: 'Мэдээг унших',
    leaveStory: 'Энэ мэдээний мэдэгдлээс гарах',
    leaveAll: 'Бүх мэдэгдлээс гарах',
  },
}

export type Email = {
  subject: string
  text: string
  html: string
  unsubscribe?: string
}

type Data = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : '')
/** TODO_VERIFY never reaches a reader: its label instead. */
const plain = (s: string) => s.replaceAll(TODO, PLACEHOLDER)
const escape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

function html(
  paragraphs: (string | { href: string; label: string })[],
): string {
  const body = paragraphs
    .map((p) =>
      typeof p === 'string'
        ? `<p>${escape(p)}</p>`
        : `<p><a href="${escape(p.href)}">${escape(p.label)}</a></p>`,
    )
    .join('\n')
  return `<!doctype html><html lang="mn"><body style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #121318; line-height: 1.5">\n${body}\n</body></html>`
}

export function renderEmail(
  template: string,
  data: Data,
  siteUrl: string,
): Email {
  const title = plain(str(data.title))
  const token = encodeURIComponent(str(data.token))
  const storyId = encodeURIComponent(str(data.story_id))

  if (template === 'confirm') {
    const c = emailCopy.confirm
    const link = `${siteUrl}/alerts/confirm?token=${token}`
    return {
      subject: c.subject(title),
      text: [
        c.intro(title),
        `${c.action}: ${link}`,
        c.ignore,
        emailCopy.notOfficial,
      ].join('\n\n'),
      html: html([
        c.intro(title),
        { href: link, label: c.action },
        c.ignore,
        emailCopy.notOfficial,
      ]),
    }
  }

  if (template === 'stage_change') {
    const c = emailCopy.stageChange
    const change = `${str(data.old_stage)} → ${str(data.new_stage)}`
    const story = `${siteUrl}/story/${storyId}`
    const leaveStory = `${siteUrl}/alerts/unsubscribe?token=${token}&story=${storyId}`
    const leaveAll = `${siteUrl}/alerts/unsubscribe?token=${token}`
    return {
      subject: c.subject(title),
      text: [
        `${c.intro(title)}\n${change}`,
        `${c.read}: ${story}`,
        emailCopy.disclaimer,
        `${c.leaveStory}: ${leaveStory}\n${c.leaveAll}: ${leaveAll}`,
        emailCopy.notOfficial,
      ].join('\n\n'),
      html: html([
        c.intro(title),
        change,
        { href: story, label: c.read },
        emailCopy.disclaimer,
        { href: leaveStory, label: c.leaveStory },
        { href: leaveAll, label: c.leaveAll },
        emailCopy.notOfficial,
      ]),
      unsubscribe: leaveAll,
    }
  }

  throw new Error(`unknown email template "${template}"`)
}
