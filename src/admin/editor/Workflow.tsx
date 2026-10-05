// The editorial steps for one story, by state and role:
//   editor:   submit for review
//   reviewer: request changes, publish (not their own last change: two-person rule), unpublish
// Every step works on the saved version; the database checks the same rules again.
import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal'
import { adminCopy } from '../copy'
import { errorCode, errorMessage, problemList } from '../errors'
import { call, hasRole, supabase, type StaffMember } from '../supabase'
import { Button, Field, Notice, TextArea } from '../ui'
import { RULE_MESSAGES } from '../validation'
import type { StoryRow } from './useStoryDraft'

const t = adminCopy.workflow

export type WorkflowDone =
  'submit' | 'requestChanges' | 'publish' | 'unpublish' | 'restore'

type Step = 'submit' | 'requestChanges' | 'publish' | 'unpublish'

/** '<code> <path>' from story_problems() → a readable line. */
function problemText(problem: string): string {
  const [code, path, ...rest] = problem.split(' ')
  const message =
    code === 'schema' ? rest.join(' ') : (RULE_MESSAGES[code] ?? code)
  return path && path !== '$' ? `${path} — ${message}` : message
}

export default function Workflow({
  storyId,
  state,
  version,
  updatedBy,
  staff,
  dirty,
  errorCount,
  todoCount,
  live,
  wasPublished,
  twoPersonRule,
  onDone,
}: {
  storyId: string
  state: StoryRow['state']
  version: number
  updatedBy: string | null
  staff: StaffMember
  dirty: boolean
  errorCount: number
  todoCount: number
  live: boolean
  wasPublished: boolean
  twoPersonRule: boolean
  onDone: (done: WorkflowDone) => void
}) {
  const [step, setStep] = useState<Step | null>(null)
  const [note, setNote] = useState('')
  const [correction, setCorrection] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [problems, setProblems] = useState<string[]>([])

  const reviewer = hasRole(staff, 'reviewer')
  const ownChange = twoPersonRule && updatedBy === staff.user_id
  const canSubmit = state === 'draft' || state === 'changes_requested'
  const canRequest = reviewer && state === 'in_review'
  const canPublish = reviewer && state !== 'published'
  const canUnpublish = reviewer && live

  function open(next: Step) {
    setStep(next)
    setNote('')
    setCorrection('')
    setError(null)
    setProblems([])
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    if (!step) return
    setBusy(true)
    setError(null)
    setProblems([])
    try {
      if (step === 'submit')
        await call(
          supabase.rpc('submit_story', {
            p_id: storyId,
            p_version: version,
            p_note: note,
          }),
        )
      if (step === 'requestChanges')
        await call(
          supabase.rpc('request_changes', {
            p_id: storyId,
            p_version: version,
            p_note: note,
          }),
        )
      if (step === 'publish')
        await call(
          supabase.rpc('publish_story', {
            p_id: storyId,
            p_version: version,
            p_note: note,
            p_correction: correction,
          }),
        )
      if (step === 'unpublish')
        await call(
          supabase.rpc('unpublish_story', {
            p_id: storyId,
            p_version: version,
            p_note: note,
          }),
        )
      setStep(null)
      onDone(step)
    } catch (err) {
      setError(await errorMessage(err))
      if (errorCode(err) === 'story_problems') setProblems(problemList(err))
    } finally {
      setBusy(false)
    }
  }

  // why a step cannot be taken right now (shown in its dialog)
  const blocker =
    step === 'publish'
      ? dirty
        ? t.saveFirst
        : errorCount > 0
          ? t.errorsBlock
          : ownChange
            ? t.samePerson
            : null
      : dirty && step !== 'unpublish'
        ? t.saveFirst
        : null

  const titles: Record<Step, string> = {
    submit: t.submit,
    requestChanges: t.requestChanges,
    publish: t.publish,
    unpublish: t.unpublish,
  }
  const intros: Record<Step, string> = {
    submit: t.submitIntro,
    requestChanges: t.requestIntro,
    publish: t.publishIntro,
    unpublish: t.unpublishIntro,
  }
  const noteRequired = step === 'requestChanges' || step === 'unpublish'

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <Button onClick={() => open('submit')}>{t.submit}</Button>
        )}
        {canRequest && (
          <Button onClick={() => open('requestChanges')}>
            {t.requestChanges}
          </Button>
        )}
        {canPublish && (
          <Button variant="primary" onClick={() => open('publish')}>
            {t.publish}
          </Button>
        )}
        {canUnpublish && (
          <Button variant="danger" onClick={() => open('unpublish')}>
            {t.unpublish}
          </Button>
        )}
      </div>

      <Modal
        open={step !== null}
        title={step ? titles[step] : ''}
        closeLabel={adminCopy.common.close}
        onClose={() => setStep(null)}
      >
        {step && (
          <form onSubmit={confirm} className="flex flex-col gap-4">
            <p className="text-ink-2">{intros[step]}</p>
            {blocker ? (
              <Notice tone="warning">{blocker}</Notice>
            ) : (
              <>
                {step === 'publish' && todoCount > 0 && (
                  <Notice tone="warning">{t.todosWarning(todoCount)}</Notice>
                )}
                <Field
                  label={
                    step === 'publish'
                      ? t.publishNote
                      : step === 'unpublish'
                        ? t.reason
                        : t.note
                  }
                  hint={step === 'publish' ? t.publishNoteHint : undefined}
                  optional={!noteRequired}
                >
                  {(props) => (
                    <TextArea
                      {...props}
                      required={noteRequired}
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  )}
                </Field>
                {step === 'publish' && wasPublished && (
                  <Field label={t.correction} hint={t.correctionHint} optional>
                    {(props) => (
                      <TextArea
                        {...props}
                        maxLength={500}
                        value={correction}
                        onChange={(e) => setCorrection(e.target.value)}
                      />
                    )}
                  </Field>
                )}
              </>
            )}
            {error && (
              <Notice tone="error">
                <p>{error}</p>
                {problems.length > 0 && (
                  <>
                    <p className="mt-1">{t.problems}</p>
                    <ul className="mt-1 list-disc pl-5 text-small">
                      {problems.map((p, i) => (
                        <li key={i}>{problemText(p)}</li>
                      ))}
                    </ul>
                  </>
                )}
              </Notice>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setStep(null)}>
                {adminCopy.common.cancel}
              </Button>
              <Button
                type="submit"
                variant={step === 'unpublish' ? 'danger' : 'primary'}
                busy={busy}
                disabled={blocker !== null}
              >
                {titles[step]}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
