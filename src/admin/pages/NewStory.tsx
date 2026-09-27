// A new story: from a few typed fields, or from a JSON file in the seed format.
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../../components/Icon'
import type { Json } from '../../data/database.types'
import { DOC_TYPES, STAGES, type DocType, type Stage } from '../../data/schema'
import { today } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'
import { newStory } from '../editor/documents'
import { call, supabase } from '../supabase'
import {
  Button,
  Field,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextArea,
  TextInput,
  useAction,
} from '../ui'

const t = adminCopy.newStory
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function Component() {
  useDocumentTitle(`${t.title} · ${adminCopy.title}`)
  const navigate = useNavigate()

  const [id, setId] = useState('')
  const [type, setType] = useState<DocType>('Хуулийн төсөл')
  const [stage, setStage] = useState<Stage>('Өргөн мэдүүлсэн')
  const [title, setTitle] = useState('')
  const blank = useAction()
  const idError =
    id && !SLUG.test(id) ? adminCopy.errors.codes.invalid_id : null

  async function createBlank(e: FormEvent) {
    e.preventDefault()
    if (!SLUG.test(id)) return
    const content = newStory({
      id,
      type,
      stage,
      title: title.trim(),
      today: today(),
    })
    if (
      await blank.run(() =>
        call(
          supabase.rpc('create_story', {
            p_id: id,
            p_content: content as Json,
          }),
        ),
      )
    )
      navigate(`/admin/stories/${id}`)
  }

  const [file, setFile] = useState<{ id: string; content: object } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const imported = useAction()

  async function readFile(e: ChangeEvent<HTMLInputElement>) {
    setFile(null)
    setFileError(null)
    const chosen = e.target.files?.[0]
    if (!chosen) return
    try {
      const content = JSON.parse(await chosen.text()) as unknown
      if (!content || typeof content !== 'object' || Array.isArray(content))
        throw new Error('not an object')
      const fileId = (content as { id?: unknown }).id
      setFile({
        id:
          typeof fileId === 'string'
            ? fileId
            : chosen.name.replace(/\.json$/i, ''),
        content,
      })
    } catch {
      setFileError(t.badFile)
    }
  }

  async function importFile(e: FormEvent) {
    e.preventDefault()
    if (!file || !SLUG.test(file.id)) return
    const target = file.id
    if (
      await imported.run(() =>
        call(
          supabase.rpc('create_story', {
            p_id: target,
            p_content: file.content as Json,
            p_action: 'import',
          }),
        ),
      )
    )
      navigate(`/admin/stories/${target}`)
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <Link
        to="/admin"
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-small font-semibold text-accent"
      >
        <Icon name="arrowLeft" className="size-4" />
        {adminCopy.editor.back}
      </Link>
      <PageHeader title={t.title} />

      <Panel title={t.blank} intro={t.blankIntro}>
        <form onSubmit={createBlank} className="flex flex-col gap-4">
          <Field label={t.id} hint={t.idHint} error={idError}>
            {(props) => (
              <TextInput
                {...props}
                required
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase())}
                className="font-mono"
              />
            )}
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t.type}>
              {(props) => (
                <Select
                  {...props}
                  value={type}
                  onChange={(e) => setType(e.target.value as DocType)}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.stage}>
              {(props) => (
                <Select
                  {...props}
                  value={stage}
                  onChange={(e) => setStage(e.target.value as Stage)}
                >
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={t.titleField} hint={adminCopy.editor.fields.titleHint}>
            {(props) => (
              <TextArea
                {...props}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          {blank.error && <Notice tone="error">{blank.error}</Notice>}
          <Button
            type="submit"
            variant="primary"
            busy={blank.busy}
            className="self-start"
          >
            {t.create}
          </Button>
        </form>
      </Panel>

      <Panel title={t.import} intro={t.importIntro}>
        <form onSubmit={importFile} className="flex flex-col gap-4">
          <Field label={t.file} error={fileError}>
            {(props) => (
              <input
                {...props}
                type="file"
                accept="application/json,.json"
                onChange={readFile}
                className="min-h-11 text-small file:mr-3 file:min-h-11 file:rounded-full file:border file:border-line-strong file:bg-surface file:px-4 file:font-semibold"
              />
            )}
          </Field>
          {file && (
            <Field
              label={t.id}
              hint={t.idHint}
              error={
                SLUG.test(file.id) ? null : adminCopy.errors.codes.invalid_id
              }
            >
              {(props) => (
                <TextInput
                  {...props}
                  required
                  value={file.id}
                  onChange={(e) =>
                    setFile({ ...file, id: e.target.value.toLowerCase() })
                  }
                  className="font-mono"
                />
              )}
            </Field>
          )}
          {imported.error && <Notice tone="error">{imported.error}</Notice>}
          <Button
            type="submit"
            variant="primary"
            busy={imported.busy}
            disabled={!file}
            className="self-start"
          >
            {t.importButton}
          </Button>
        </form>
      </Panel>
    </div>
  )
}
