// The editor's sections, in the order of the story page. Headings reuse the questions readers see.
import { useState, type ReactNode } from 'react'
import { copy } from '../../copy'
import {
  AFFECT_DEFAULT_GROUP,
  newCited,
  newSource,
  renameSource,
} from './documents'
import {
  DOC_TYPES,
  EVIDENCE_STEPS,
  GROUPS,
  STAGES,
  TOPICS,
  TODO,
} from '../../data/schema'
import { formatDate } from '../../lib/format'
import { sourceRefs } from '../../lib/sources'
import { adminCopy } from '../copy'
import { getIn, insertIn, toJsonPath, type Path } from '../doc'
import { AddButton, useFieldError } from '../fields'
import { Button, Checkbox, Field, Select, TextInput } from '../ui'
import { asList, asObject, asText, useEditor } from './context'
import {
  Choice,
  CitedField,
  DateValue,
  excerpt,
  ItemList,
  MultiChoice,
  NoteField,
  Num,
  SourceField,
  Text,
  Toggle,
} from './storyFields'

const f = adminCopy.editor.fields
const s = copy.story.sections

export type SectionId =
  | 'basics'
  | 'sources'
  | 'changes'
  | 'key-numbers'
  | 'meaning'
  | 'affects'
  | 'timeline'
  | 'evidence'
  | 'participate'
  | 'related'
  | 'notes'

export const SECTIONS: { id: SectionId; title: string; keys: string[] }[] = [
  {
    id: 'basics',
    title: adminCopy.editor.sections.basics,
    keys: [
      'id',
      'type',
      'stage',
      'topics',
      'featured',
      'order',
      'title',
      'officialTitle',
      'summary',
      'publishedAt',
      'updatedAt',
      'reviewed',
      'calculator',
    ],
  },
  {
    id: 'sources',
    title: adminCopy.editor.sections.sources,
    keys: ['sources'],
  },
  { id: 'changes', title: s.changes, keys: ['changes'] },
  {
    id: 'key-numbers',
    title: s.keyNumbers,
    keys: ['keyNumbers', 'numberExplainer'],
  },
  { id: 'meaning', title: s.meaning, keys: ['meaning', 'positions'] },
  { id: 'affects', title: s.affects, keys: ['affects'] },
  { id: 'timeline', title: s.timeline, keys: ['timeline'] },
  { id: 'evidence', title: s.evidence, keys: ['evidence'] },
  { id: 'participate', title: s.participate, keys: ['participate'] },
  { id: 'related', title: s.related, keys: ['relatedStoryIds', 'corrections'] },
  { id: 'notes', title: adminCopy.editor.sections.notes, keys: ['verify'] },
]

function EditorSection({
  id,
  title,
  children,
}: {
  id: SectionId
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={`sec-${id}`}
      aria-labelledby={`sec-${id}-title`}
      className="scroll-mt-6 rounded-card border border-line bg-surface p-4 md:p-6"
    >
      <h2
        id={`sec-${id}-title`}
        className="mb-4 text-[20px] leading-7 tracking-[-0.01em] lg:text-[22px]"
      >
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

const options = <V extends string>(
  values: readonly V[],
  label = (v: V) => v as string,
) => values.map((value) => ({ value, label: label(value) }))

// ---- basics ------------------------------------------------------------------------------------

function StageField() {
  const { content, set } = useEditor()
  const path: Path = ['stage']
  const error = useFieldError(path)
  const g = f.stageGroups
  const groups: [string, readonly string[]][] = [
    [g.parliament, STAGES.slice(0, 9)],
    [g.legalinfo, STAGES.slice(9, 14)],
    [g.other, STAGES.slice(14)],
  ]
  return (
    <Field label={f.stage} error={error} dataPath={toJsonPath(path)}>
      {(props) => (
        <Select
          {...props}
          value={asText(getIn(content, path)) ?? ''}
          onChange={(e) => set(path, e.target.value || undefined)}
        >
          <option value="">—</option>
          {groups.map(([label, stages]) => (
            <optgroup key={label} label={label}>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}
    </Field>
  )
}

export function Basics() {
  const { content } = useEditor()
  const doc = asObject(content)
  const publishedAt = asText(doc.publishedAt)
  return (
    <EditorSection id="basics" title={adminCopy.editor.sections.basics}>
      <p className="text-small text-ink-2">
        <span className="font-semibold text-ink">{f.id}:</span>{' '}
        <code>{asText(doc.id)}</code> — {f.idHint}
      </p>
      <Text
        label={f.title}
        hint={f.titleHint}
        path={['title']}
        multiline
        allowUnknown
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Choice label={f.type} path={['type']} options={options(DOC_TYPES)} />
        <StageField />
      </div>
      <MultiChoice label={f.topics} path={['topics']} options={TOPICS} />
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <Toggle label={f.featured} hint={f.featuredHint} path={['featured']} />
        <Num
          label={f.order}
          hint={f.orderHint}
          path={['order']}
          optional
          step="any"
        />
      </div>
      <CitedField label={f.officialTitle} path={['officialTitle']} />
      <CitedField label={f.summary} path={['summary']} />
      <Toggle
        label={f.calculator}
        path={['calculator']}
        on="pit"
        off={undefined}
      />
      <p className="text-small text-ink-2">
        <span className="font-semibold text-ink">{f.publishedAt}:</span>{' '}
        {publishedAt && publishedAt !== TODO ? formatDate(publishedAt) : '—'}.{' '}
        {f.publishedAtAuto}
      </p>
    </EditorSection>
  )
}

// ---- sources -----------------------------------------------------------------------------------

/** The id of a source; renaming it (on leaving the field) renames every reference to it. */
function SourceIdField({ index }: { index: number }) {
  const { content, update } = useEditor()
  const path: Path = ['sources', index, 'id']
  const current = asText(getIn(content, path)) ?? ''
  const [draft, setDraft] = useState(current)
  const [problem, setProblem] = useState<string | null>(null)
  const validationError = useFieldError(path)

  function commit() {
    const next = draft.trim()
    if (next === current) return setProblem(null)
    if (!next) {
      setDraft(current)
      return setProblem(f.src.idEmpty)
    }
    const taken = asList(asObject(content).sources).some(
      (src, i) => i !== index && asText(asObject(src).id) === next,
    )
    if (taken) {
      setDraft(current)
      return setProblem(f.src.idTaken)
    }
    setProblem(null)
    update((doc) => renameSource(doc, index, current, next))
  }

  return (
    <Field
      label={f.src.id}
      error={problem ?? validationError}
      dataPath={toJsonPath(path)}
    >
      {(props) => (
        <TextInput
          {...props}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
          className="font-mono text-[15px]"
        />
      )}
    </Field>
  )
}

export function Sources() {
  const { content } = useEditor()
  // how often each source is cited, from the same walk the site uses to number the markers
  const usage = new Map<string, number>()
  try {
    for (const ref of sourceRefs(content as never))
      usage.set(ref.source, (usage.get(ref.source) ?? 0) + 1)
  } catch {
    // a half-filled document may be missing lists sourceRefs expects
  }
  const kinds = [
    { value: 'official', label: copy.source.official },
    { value: 'media', label: copy.source.media },
  ] as const
  return (
    <EditorSection id="sources" title={adminCopy.editor.sections.sources}>
      <ItemList
        path={['sources']}
        itemTitle={(i, item) => {
          const id = asText(item.id) ?? ''
          return `${i + 1}. ${id} · ${f.src.usage(usage.get(id) ?? 0)}`
        }}
        addLabel={f.src.add}
        newItem={() => newSource(asList(asObject(content).sources).length + 1)}
      >
        {(path, i, item) => (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <SourceIdField key={asText(item.id)} index={i} />
              <Choice
                label={f.src.kind}
                path={[...path, 'kind']}
                options={kinds}
              />
            </div>
            <Text
              label={f.src.title}
              path={[...path, 'title']}
              multiline
              allowUnknown
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Text
                label={f.src.publisher}
                path={[...path, 'publisher']}
                allowUnknown
              />
              <Text
                label={f.src.url}
                path={[...path, 'url']}
                type="url"
                allowUnknown
              />
              <DateValue
                label={f.src.publishedAt}
                path={[...path, 'publishedAt']}
                optional
                allowUnknown
              />
              <DateValue
                label={f.src.accessedAt}
                path={[...path, 'accessedAt']}
                allowUnknown
              />
            </div>
            <Text
              label={f.src.note}
              hint={f.src.noteHint}
              path={[...path, 'note']}
              optional
              multiline
            />
          </>
        )}
      </ItemList>
    </EditorSection>
  )
}

// ---- changes -----------------------------------------------------------------------------------

export function Changes() {
  const c = f.change
  return (
    <EditorSection id="changes" title={s.changes}>
      <ItemList
        path={['changes']}
        itemTitle={(i, item) =>
          `${c.item(i + 1)} ${excerpt(item.clause) && `· ${excerpt(item.clause)}`}`
        }
        addLabel={c.add}
        newItem={() => ({
          clause: '',
          plainBefore: newCited(),
          plainAfter: newCited(),
          lawBefore: '',
          lawAfter: '',
          lawSource: '',
        })}
      >
        {(path) => (
          <>
            <Text label={c.clause} path={[...path, 'clause']} allowUnknown />
            <CitedField label={c.plainBefore} path={[...path, 'plainBefore']} />
            <CitedField label={c.plainAfter} path={[...path, 'plainAfter']} />
            <Text
              label={c.lawBefore}
              hint={c.lawBeforeHint}
              path={[...path, 'lawBefore']}
              multiline
              rows={4}
              allowUnknown
            />
            <Text
              label={c.lawAfter}
              path={[...path, 'lawAfter']}
              multiline
              rows={4}
              allowUnknown
            />
            <div className="grid gap-3 md:grid-cols-2">
              <SourceField label={c.lawSource} path={[...path, 'lawSource']} />
              <DateValue
                label={c.effectiveFrom}
                path={[...path, 'effectiveFrom']}
                optional
              />
            </div>
          </>
        )}
      </ItemList>
    </EditorSection>
  )
}

// ---- key numbers and the explainer -------------------------------------------------------------

export function KeyNumbers() {
  const { content, set } = useEditor()
  const k = f.keyNumber
  const e = f.explainer
  const explainer = getIn(content, ['numberExplainer'])
  return (
    <EditorSection id="key-numbers" title={s.keyNumbers}>
      <ItemList
        path={['keyNumbers']}
        itemTitle={(i, item) =>
          `${k.item(i + 1)} ${excerpt(item.label) && `· ${excerpt(item.label)}`}`
        }
        addLabel={k.add}
        newItem={() => ({ label: '', value: '', source: '' })}
      >
        {(path) => (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Text label={k.label} path={[...path, 'label']} allowUnknown />
              <Text
                label={k.value}
                hint={k.valueHint}
                path={[...path, 'value']}
                allowUnknown
              />
            </div>
            <Text label={k.note} path={[...path, 'note']} optional />
            <SourceField path={[...path, 'source']} />
            <NoteField path={[...path, 'verify']} />
          </>
        )}
      </ItemList>

      <h3 className="mt-2 text-[17px]">
        {adminCopy.editor.sections.numberExplainer}
      </h3>
      {explainer === undefined ? (
        <AddButton
          onClick={() =>
            set(['numberExplainer'], { question: '', paragraphs: [newCited()] })
          }
        >
          {e.add}
        </AddButton>
      ) : (
        <div data-path="$.numberExplainer" className="flex flex-col gap-3">
          <Text label={e.question} path={['numberExplainer', 'question']} />
          <ItemList
            path={['numberExplainer', 'paragraphs']}
            itemTitle={(i) => e.paragraph(i + 1)}
            addLabel={e.addParagraph}
            newItem={newCited}
          >
            {(path) => <CitedField path={path} />}
          </ItemList>
          <Button
            variant="danger"
            onClick={() => set(['numberExplainer'], undefined)}
            className="self-start"
          >
            {e.remove}
          </Button>
        </div>
      )}
    </EditorSection>
  )
}

// ---- meaning and positions ---------------------------------------------------------------------

export function Meaning() {
  const p = f.position
  return (
    <EditorSection id="meaning" title={s.meaning}>
      <ItemList
        path={['meaning']}
        itemTitle={(i, item) =>
          `${f.meaning.item(i + 1)} ${excerpt(item.text) && `· ${excerpt(item.text)}`}`
        }
        addLabel={f.meaning.add}
        newItem={newCited}
      >
        {(path) => <CitedField path={path} />}
      </ItemList>

      <h3 className="mt-2 text-[17px]">{s.positions}</h3>
      <p className="-mt-2 text-small text-ink-2">{copy.story.positionsNote}</p>
      <ItemList
        path={['positions']}
        itemTitle={(i, item) =>
          `${p.item(i + 1)} ${excerpt(item.actor) && `· ${excerpt(item.actor)}`}`
        }
        addLabel={p.add}
        newItem={() => ({ actor: '', text: '', source: '' })}
      >
        {(path) => (
          <>
            <Text label={p.actor} path={[...path, 'actor']} />
            <Text
              label={p.text}
              path={[...path, 'text']}
              multiline
              allowUnknown
            />
            <SourceField path={[...path, 'source']} />
            <NoteField path={[...path, 'verify']} />
          </>
        )}
      </ItemList>
    </EditorSection>
  )
}

// ---- affects -----------------------------------------------------------------------------------

export function Affects() {
  const a = f.affect
  return (
    <EditorSection id="affects" title={s.affects}>
      <ItemList
        path={['affects']}
        itemTitle={(i, item) =>
          `${a.item(i + 1)} ${asText(item.group) ? `· ${asText(item.group)}` : ''}`
        }
        addLabel={a.add}
        newItem={() => ({ group: AFFECT_DEFAULT_GROUP, text: '', source: '' })}
      >
        {(path) => (
          <>
            <Choice
              label={a.group}
              path={[...path, 'group']}
              options={options(GROUPS)}
            />
            <Text
              label={a.text}
              path={[...path, 'text']}
              multiline
              allowUnknown
            />
            <SourceField path={[...path, 'source']} />
            <NoteField path={[...path, 'verify']} />
          </>
        )}
      </ItemList>
    </EditorSection>
  )
}

// ---- timeline ----------------------------------------------------------------------------------

export function Timeline() {
  const t = f.timeline
  const statuses = [
    { value: 'done', label: t.statuses.done },
    { value: 'current', label: t.statuses.current },
    { value: 'upcoming', label: t.statuses.upcoming },
  ] as const
  return (
    <EditorSection id="timeline" title={s.timeline}>
      <ItemList
        path={['timeline']}
        itemTitle={(i, item) =>
          `${t.item(i + 1)} ${excerpt(item.label) && `· ${excerpt(item.label)}`}`
        }
        addLabel={t.add}
        newItem={() => ({ date: null, label: '', status: 'upcoming' })}
      >
        {(path, _i, item) => (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <DateValue
                label={t.date}
                path={[...path, 'date']}
                allowUnknown
                allowNull
              />
              <Choice
                label={t.status}
                path={[...path, 'status']}
                options={statuses}
              />
            </div>
            {item.date === null && (
              <Text
                label={t.dateText}
                hint={t.dateTextHint}
                path={[...path, 'dateText']}
                optional
              />
            )}
            <Text label={t.label} path={[...path, 'label']} allowUnknown />
            <Text label={t.note} path={[...path, 'note']} optional />
            <SourceField path={[...path, 'source']} optional />
            <NoteField path={[...path, 'verify']} />
          </>
        )}
      </ItemList>
    </EditorSection>
  )
}

// ---- evidence ----------------------------------------------------------------------------------

/** The four evidence steps, always shown; a step enters the document with its first item. */
export function Evidence() {
  const { content, update } = useEditor()
  const evidence = asList(asObject(content).evidence)
  return (
    <EditorSection id="evidence" title={s.evidence}>
      <div data-path="$.evidence" className="flex flex-col gap-5">
        {EVIDENCE_STEPS.map((step, n) => {
          const index = evidence.findIndex((e) => asObject(e).step === step)
          return (
            <div key={step} className="flex flex-col gap-3">
              <h3 className="text-[17px]">
                {n + 1}. {step}
              </h3>
              {index === -1 ? (
                <>
                  <p className="-mt-2 text-small text-muted">
                    {copy.story.notFoundYet}
                  </p>
                  <AddButton
                    onClick={() =>
                      update((doc) =>
                        insertIn(doc, ['evidence'], {
                          step,
                          items: [newCited()],
                        }),
                      )
                    }
                  >
                    {f.evidence.add}
                  </AddButton>
                </>
              ) : (
                <ItemList
                  path={['evidence', index, 'items']}
                  itemTitle={(i, item) =>
                    `${f.evidence.item(i + 1)} ${excerpt(item.text) && `· ${excerpt(item.text)}`}`
                  }
                  addLabel={f.evidence.add}
                  newItem={newCited}
                >
                  {(path) => <CitedField path={path} />}
                </ItemList>
              )}
            </div>
          )
        })}
      </div>
    </EditorSection>
  )
}

// ---- participate -------------------------------------------------------------------------------

export function Participate() {
  const { channels } = useEditor()
  const p = f.participate
  const channelOptions = channels.map((ch) => ({
    value: ch.id,
    label: ch.name,
  }))
  return (
    <EditorSection id="participate" title={s.participate}>
      <p className="-mt-2 text-small text-ink-2">{copy.participate.intro}</p>
      <ItemList
        path={['participate']}
        itemTitle={(i, item) =>
          `${p.item(i + 1)} ${channels.find((ch) => ch.id === item.channel)?.name ?? ''}`
        }
        addLabel={p.add}
        newItem={() => ({ channel: channels[0]?.id ?? '', label: '' })}
      >
        {(path) => (
          <>
            <Choice
              label={p.channel}
              path={[...path, 'channel']}
              options={channelOptions}
            />
            <Text label={p.label} path={[...path, 'label']} />
            <Text
              label={p.url}
              hint={p.urlHint}
              path={[...path, 'url']}
              type="url"
              optional
            />
            <Text label={p.note} path={[...path, 'note']} optional />
          </>
        )}
      </ItemList>
    </EditorSection>
  )
}

// ---- related stories and corrections -----------------------------------------------------------

export function Related() {
  const { content, set, stories } = useEditor()
  const doc = asObject(content)
  const chosen = asList(doc.relatedStoryIds).filter(
    (v): v is string => typeof v === 'string',
  )
  const corrections = asList(doc.corrections).map(asObject)
  const error = useFieldError(['relatedStoryIds'])
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...chosen, id] : chosen.filter((x) => x !== id)
    set(['relatedStoryIds'], next.length ? next : undefined)
  }
  return (
    <EditorSection id="related" title={s.related}>
      <div data-path="$.relatedStoryIds" className="flex flex-col gap-1">
        <p className="text-small text-ink-2">{f.related.hint}</p>
        {error && (
          <p className="text-meta font-semibold text-del-ink">{error}</p>
        )}
        {stories
          .filter((st) => st.id !== doc.id)
          .map((st) => (
            <Checkbox
              key={st.id}
              checked={chosen.includes(st.id)}
              onChange={(on) => toggle(st.id, on)}
              label={
                <>
                  {st.title}{' '}
                  <span className="font-normal text-muted">
                    ({st.id}
                    {st.isLive ? '' : `, ${f.related.unpublished}`})
                  </span>
                </>
              }
            />
          ))}
      </div>

      <h3 className="mt-2 text-[17px]">{s.corrections}</h3>
      {corrections.length > 0 && (
        <ul className="flex flex-col gap-1 text-small">
          {corrections.map((cr, i) => (
            <li key={i}>
              <span className="text-muted tabular-nums">
                {formatDate(asText(cr.date) ?? '')}
              </span>{' '}
              {asText(cr.text)}
            </li>
          ))}
        </ul>
      )}
      <p className="text-small text-muted">{f.corrections}</p>
    </EditorSection>
  )
}

// ---- team notes --------------------------------------------------------------------------------

export function Notes() {
  const n = f.notes
  return (
    <EditorSection id="notes" title={adminCopy.editor.sections.notes}>
      <p className="-mt-2 text-small text-ink-2">{n.hint}</p>
      <ItemList
        path={['verify']}
        itemTitle={(i) => n.item(i + 1)}
        addLabel={n.add}
        newItem={() => ''}
      >
        {(path) => (
          <Text label={n.item(Number(path[1]) + 1)} path={path} multiline />
        )}
      </ItemList>
    </EditorSection>
  )
}

export const SECTION_COMPONENTS: Record<SectionId, () => ReactNode> = {
  basics: Basics,
  sources: Sources,
  changes: Changes,
  'key-numbers': KeyNumbers,
  meaning: Meaning,
  affects: Affects,
  timeline: Timeline,
  evidence: Evidence,
  participate: Participate,
  related: Related,
  notes: Notes,
}
