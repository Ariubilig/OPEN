// Settings: your own name for everyone; the team, publishing rules, channels and tax rules for
// admins (the database enforces the same: non-admins cannot change them).
import { useState, type FormEvent } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'
import { clearCache } from '../../data/api'
import {
  ChannelSchema,
  TaxRulesSchema,
  TODO,
  type Channel,
  type Ref,
  type TaxRules,
} from '../../data/schema'
import { formatDateTime } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { taxRulesProblems } from '../../lib/validate'
import { adminCopy } from '../copy'
import { insertIn, moveIn, removeIn, setIn, type Path } from '../doc'
import {
  AddButton,
  CheckboxField,
  DateField,
  ErrorsProvider,
  ItemCard,
  NumberField,
  TextField,
} from '../fields'
import { useStaffSession } from '../session'
import { call, maybe, supabase, type StaffRole } from '../supabase'
import {
  Button,
  Checkbox,
  Field,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextInput,
  useAction,
} from '../ui'
import { findingsByPath, issuesByPath } from '../validation'

const t = adminCopy.settings
const c = adminCopy.common
const ROLES: StaffRole[] = ['editor', 'reviewer', 'admin']

export async function loader() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const me = session
    ? await maybe(
        supabase
          .from('staff')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle(),
      )
    : null
  const admin = me?.role === 'admin'
  const [settings, channels, taxRules, team] = await Promise.all([
    call(supabase.from('settings').select('*').single()),
    call(
      supabase
        .from('channels')
        .select('id, sort_order, content')
        .order('sort_order'),
    ),
    maybe(
      supabase
        .from('tax_rules')
        .select('content')
        .eq('id', 'pit')
        .maybeSingle(),
    ),
    admin ? call(supabase.rpc('list_staff')) : Promise.resolve([]),
  ])
  // email alerts: only admins can read the outbox and addresses (as counts here)
  const [outbox, subscribers] = admin
    ? await Promise.all([
        call(
          supabase
            .from('email_outbox')
            .select('id, status, last_error, created_at')
            .order('id', { ascending: false })
            .limit(500),
        ),
        supabase
          .from('subscribers')
          .select('id', { count: 'exact', head: true })
          .not('confirmed_at', 'is', null),
      ])
    : [[], { count: 0 }]
  return {
    admin,
    settings,
    channels: channels.map((ch) => ch.content as Channel),
    taxRules: (taxRules?.content ?? null) as TaxRules | null,
    team,
    outbox,
    subscribers: subscribers.count ?? 0,
  }
}

type Data = Awaited<ReturnType<typeof loader>>

// ---- me ----------------------------------------------------------------------------------------

function MeSection() {
  const { email, staff } = useStaffSession()
  const { revalidate } = useRevalidator()
  const [name, setName] = useState(staff?.name ?? '')
  const [saved, setSaved] = useState(false)
  const { run, busy, error } = useAction()

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    if (
      await run(() => call(supabase.rpc('update_my_name', { p_name: name })))
    ) {
      setSaved(true)
      revalidate()
    }
  }

  return (
    <Panel title={t.me.title}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-1 text-small sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">{t.me.email}</dt>
          <dd className="text-ink-2">{email}</dd>
          <dt className="font-semibold">{t.me.role}</dt>
          <dd className="text-ink-2">
            {staff && adminCopy.roles[staff.role]} —{' '}
            {staff && adminCopy.roleHints[staff.role]}
          </dd>
        </dl>
        <Field label={t.me.name} hint={t.me.nameHint}>
          {(props) => (
            <TextInput
              {...props}
              value={name}
              maxLength={100}
              required
              onChange={(e) => setName(e.target.value)}
              className="max-w-[28rem]"
            />
          )}
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="success">{c.saved}</Notice>}
        <Button
          type="submit"
          variant="primary"
          busy={busy}
          className="self-start"
        >
          {c.save}
        </Button>
      </form>
    </Panel>
  )
}

// ---- team --------------------------------------------------------------------------------------

function TeamSection({ team }: { team: Data['team'] }) {
  const { staff } = useStaffSession()
  const { revalidate } = useRevalidator()
  const list = useAction()
  const invite = useAction()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<StaffRole>('editor')
  const [done, setDone] = useState<string | null>(null)

  async function setMemberRole(userId: string, next: StaffRole) {
    if (
      await list.run(() =>
        call(
          supabase.rpc('set_staff_role', { p_user_id: userId, p_role: next }),
        ),
      )
    )
      revalidate()
  }

  async function remove(userId: string, memberName: string) {
    if (!window.confirm(t.team.removeConfirm(memberName))) return
    if (
      await list.run(() =>
        call(supabase.rpc('remove_staff', { p_user_id: userId })),
      )
    )
      revalidate()
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    setDone(null)
    let invited = false
    const ok = await invite.run(async () => {
      const { data, error } = await supabase.functions.invoke<{
        invited: boolean
      }>('invite-staff', { body: { email, name, role } })
      if (error) throw error
      invited = data?.invited ?? false
    })
    if (ok) {
      setDone(invited ? t.team.invited(email) : t.team.added(email))
      setEmail('')
      setName('')
      revalidate()
    }
  }

  return (
    <Panel id="team" title={t.team.title} intro={t.team.intro}>
      <ul className="flex flex-col divide-y divide-line">
        {team.map((m) => (
          <li
            key={m.user_id}
            className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-center md:gap-4"
          >
            <div className="min-w-0">
              <p className="font-bold">
                {m.name}
                {m.user_id === staff?.user_id && (
                  <span className="ml-2 text-meta font-semibold text-muted">
                    ({t.team.you})
                  </span>
                )}
              </p>
              <p className="truncate text-meta text-muted">
                {m.email} · {t.team.lastSignIn}:{' '}
                {m.last_sign_in_at
                  ? formatDateTime(m.last_sign_in_at)
                  : t.team.never}
              </p>
            </div>
            <Select
              aria-label={`${t.team.role}: ${m.name}`}
              value={m.role}
              disabled={list.busy}
              onChange={(e) =>
                setMemberRole(m.user_id, e.target.value as StaffRole)
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {adminCopy.roles[r]}
                </option>
              ))}
            </Select>
            <Button
              variant="danger"
              disabled={list.busy}
              onClick={() => remove(m.user_id, m.name)}
            >
              {t.team.remove}
            </Button>
          </li>
        ))}
      </ul>
      {list.error && <Notice tone="error">{list.error}</Notice>}

      <form
        onSubmit={send}
        className="mt-5 flex flex-col gap-4 border-t border-line pt-5"
      >
        <h3 className="text-[17px]">{t.team.inviteTitle}</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t.team.email}>
            {(props) => (
              <TextInput
                {...props}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label={t.team.name}>
            {(props) => (
              <TextInput
                {...props}
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label={t.team.role} hint={adminCopy.roleHints[role]}>
            {(props) => (
              <Select
                {...props}
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {adminCopy.roles[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {invite.error && <Notice tone="error">{invite.error}</Notice>}
        {done && <Notice tone="success">{done}</Notice>}
        <Button
          type="submit"
          variant="primary"
          busy={invite.busy}
          className="self-start"
        >
          {t.team.invite}
        </Button>
      </form>
    </Panel>
  )
}

// ---- publishing rules and links ----------------------------------------------------------------

const URL_RULES = {
  site_url: /^https?:\/\/[^\s/]+$/,
  functions_url: /^https?:\/\/\S+[^/]$/,
  deploy_hook_url: /^https:\/\/\S+$/,
} as const

function PublishingSection({ settings }: { settings: Data['settings'] }) {
  const { revalidate } = useRevalidator()
  const [form, setForm] = useState({
    require_two_person_review: settings.require_two_person_review,
    site_url: settings.site_url ?? '',
    functions_url: settings.functions_url ?? '',
    deploy_hook_url: settings.deploy_hook_url ?? '',
  })
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)
  const { run, busy, error } = useAction()

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const bad = new Set(
      (Object.keys(URL_RULES) as (keyof typeof URL_RULES)[]).filter(
        (k) => form[k] !== '' && !URL_RULES[k].test(form[k].trim()),
      ),
    )
    setInvalid(bad)
    if (bad.size) return
    const ok = await run(() =>
      call(
        supabase
          .from('settings')
          .update({
            require_two_person_review: form.require_two_person_review,
            site_url: form.site_url.trim() || null,
            functions_url: form.functions_url.trim() || null,
            deploy_hook_url: form.deploy_hook_url.trim() || null,
          })
          .eq('id', true),
      ),
    )
    if (ok) {
      setSaved(true)
      revalidate()
    }
  }

  const url = (
    key: keyof typeof URL_RULES,
    label: string,
    hint: string,
    placeholder: string,
  ) => (
    <Field
      label={label}
      hint={hint}
      optional
      error={invalid.has(key) ? t.publishing.urlError : null}
    >
      {(props) => (
        <TextInput
          {...props}
          type="url"
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </Field>
  )

  return (
    <Panel id="publishing" title={t.publishing.title}>
      {/* our own URL messages instead of the browser's (which speak its language) */}
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <Checkbox
          label={t.publishing.twoPerson}
          hint={t.publishing.twoPersonHint}
          checked={form.require_two_person_review}
          onChange={(v) => setForm({ ...form, require_two_person_review: v })}
        />
        {url(
          'site_url',
          t.publishing.siteUrl,
          t.publishing.siteUrlHint,
          'https://',
        )}
        {url(
          'functions_url',
          t.publishing.functionsUrl,
          t.publishing.functionsUrlHint,
          'https://',
        )}
        {url(
          'deploy_hook_url',
          t.publishing.deployHook,
          t.publishing.deployHookHint,
          'https://',
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="success">{c.saved}</Notice>}
        <Button
          type="submit"
          variant="primary"
          busy={busy}
          className="self-start"
        >
          {c.save}
        </Button>
      </form>
    </Panel>
  )
}

// ---- references (channel and tax sources) ------------------------------------------------------

function RefFields({
  value,
  path,
  onChange,
}: {
  value: Ref
  path: Path
  onChange: (next: Ref) => void
}) {
  const ch = t.channels
  const set = <K extends keyof Ref>(key: K, v: Ref[K]) =>
    onChange(setIn(value, [key], v))
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField
        label={ch.sourceTitle}
        path={[...path, 'title']}
        value={value.title}
        onChange={(v) => set('title', v ?? '')}
        className="md:col-span-2"
      />
      <TextField
        label={ch.publisher}
        path={[...path, 'publisher']}
        value={value.publisher}
        onChange={(v) => set('publisher', v ?? '')}
      />
      <DateField
        label={ch.publishedAt}
        path={[...path, 'publishedAt']}
        optional
        value={value.publishedAt}
        onChange={(v) => set('publishedAt', v ?? undefined)}
      />
      <TextField
        label={ch.sourceUrl}
        path={[...path, 'url']}
        type="url"
        allowUnknown
        value={value.url}
        onChange={(v) => set('url', v ?? '')}
        className="md:col-span-2"
      />
    </div>
  )
}

// ---- channels ----------------------------------------------------------------------------------

function ChannelEditor({ channel }: { channel: Channel }) {
  const ch = t.channels
  const { revalidate } = useRevalidator()
  const [value, setValue] = useState<Channel>(channel)
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map())
  const [saved, setSaved] = useState(false)
  const { run, busy, error } = useAction()
  const set = (path: Path, v: unknown) => {
    setSaved(false)
    setValue((prev) => setIn(prev, path, v))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const parsed = ChannelSchema.safeParse(value)
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error))
      return
    }
    setErrors(new Map())
    if (
      await run(() =>
        call(
          supabase
            .from('channels')
            .update({ content: parsed.data })
            .eq('id', channel.id),
        ),
      )
    ) {
      clearCache()
      setSaved(true)
      revalidate()
    }
  }

  return (
    <details className="group rounded-xl border border-line bg-paper/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2">
        <span className="min-w-0">
          <span className="block font-bold">{channel.name}</span>
          <span className="block truncate text-meta text-muted">
            {channel.id} · {channel.url ?? ch.urlNone}
          </span>
        </span>
        <span className="text-small font-semibold text-accent group-open:hidden">
          {c.edit}
        </span>
      </summary>
      <ErrorsProvider errors={errors}>
        <form onSubmit={save} className="flex flex-col gap-3 px-4 pt-1 pb-4">
          <TextField
            label={ch.name}
            path={['name']}
            value={value.name}
            onChange={(v) => set(['name'], v ?? '')}
          />
          <TextField
            label={ch.description}
            path={['description']}
            multiline
            value={value.description}
            onChange={(v) => set(['description'], v ?? '')}
          />
          {value.url === null ? (
            <Checkbox
              label={ch.urlNone}
              checked
              onChange={() => set(['url'], '')}
            />
          ) : (
            <>
              <TextField
                label={ch.url}
                path={['url']}
                type="url"
                value={value.url}
                onChange={(v) => set(['url'], v ?? '')}
              />
              <Checkbox
                label={ch.urlNone}
                checked={false}
                onChange={() => set(['url'], null)}
              />
            </>
          )}
          <p className="mt-1 text-small font-bold">{ch.source}</p>
          <RefFields
            value={value.source}
            path={['source']}
            onChange={(v) => set(['source'], v)}
          />
          <TextField
            label={ch.note}
            hint={ch.noteHint}
            path={['verify']}
            optional
            multiline
            value={value.verify}
            onChange={(v) => set(['verify'], v)}
          />
          {error && <Notice tone="error">{error}</Notice>}
          {saved && <Notice tone="success">{c.saved}</Notice>}
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            className="self-start"
          >
            {c.save}
          </Button>
        </form>
      </ErrorsProvider>
    </details>
  )
}

function ChannelsSection({ channels }: { channels: Channel[] }) {
  return (
    <Panel id="channels" title={t.channels.title} intro={t.channels.intro}>
      <div className="flex flex-col gap-2">
        {channels.map((channel) => (
          <ChannelEditor key={channel.id} channel={channel} />
        ))}
      </div>
    </Panel>
  )
}

// ---- tax rules ---------------------------------------------------------------------------------

/** 0.15 → 15 without floating-point noise. */
const toPercent = (rate: number) => Math.round(rate * 10000) / 100

function TaxSection({ taxRules }: { taxRules: TaxRules }) {
  const tx = t.tax
  const { revalidate } = useRevalidator()
  const [value, setValue] = useState<TaxRules>(taxRules)
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map())
  const [saved, setSaved] = useState(false)
  const { run, busy, error } = useAction()
  const update = (next: TaxRules) => {
    setSaved(false)
    setValue(next)
  }
  const set = (path: Path, v: unknown) => update(setIn(value, path, v))

  async function save(e: FormEvent) {
    e.preventDefault()
    const parsed = TaxRulesSchema.safeParse(value)
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error))
      return
    }
    const problems = taxRulesProblems(parsed.data)
    if (problems.length) {
      setErrors(findingsByPath(problems))
      return
    }
    setErrors(new Map())
    if (
      await run(() =>
        call(
          supabase
            .from('tax_rules')
            .update({ content: parsed.data })
            .eq('id', 'pit'),
        ),
      )
    ) {
      clearCache()
      setSaved(true)
      revalidate()
    }
  }

  return (
    <Panel id="tax" title={tx.title} intro={tx.intro}>
      <ErrorsProvider errors={errors}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <CheckboxField
            label={tx.verified}
            hint={tx.verifiedHint}
            path={['verified']}
            value={value.verified}
            onChange={(v) => set(['verified'], v)}
          />
          <TextField
            label={tx.assumption}
            path={['assumption']}
            multiline
            value={value.assumption}
            onChange={(v) => set(['assumption'], v ?? '')}
          />
          <p className="text-small font-bold">{tx.source}</p>
          <RefFields
            value={value.source}
            path={['source']}
            onChange={(v) => set(['source'], v)}
          />
          <p className="text-small font-bold">{tx.lawSource}</p>
          <RefFields
            value={value.lawSource}
            path={['lawSource']}
            onChange={(v) => set(['lawSource'], v)}
          />

          {value.years.map((year, yi) => (
            <ItemCard
              key={yi}
              title={`${year.year} · ${year.label}`}
              index={yi}
              count={value.years.length}
              onMove={(d) => update(moveIn(value, ['years'], yi, d))}
              onRemove={() => update(removeIn(value, ['years'], yi))}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  label={tx.year}
                  path={['years', yi, 'year']}
                  step={1}
                  value={year.year}
                  onChange={(v) => set(['years', yi, 'year'], v)}
                />
                <TextField
                  label={tx.label}
                  path={['years', yi, 'label']}
                  value={year.label}
                  onChange={(v) => set(['years', yi, 'label'], v ?? '')}
                />
              </div>
              <p className="text-small font-bold">{tx.brackets}</p>
              {year.brackets.map((b, bi) => (
                <div
                  key={bi}
                  className="grid items-end gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  {b.upTo === null ? (
                    <div className="flex min-h-11 flex-col justify-end">
                      <p className="text-small font-semibold">{tx.upTo}</p>
                      <p className="flex min-h-11 items-center text-ink-2">
                        {tx.upToNone}
                      </p>
                    </div>
                  ) : (
                    <NumberField
                      label={tx.upTo}
                      path={['years', yi, 'brackets', bi, 'upTo']}
                      step={1}
                      min={1}
                      value={b.upTo}
                      onChange={(v) =>
                        set(['years', yi, 'brackets', bi, 'upTo'], v ?? 0)
                      }
                    />
                  )}
                  {b.rate === TODO ? (
                    <div className="flex flex-col">
                      <p className="text-small font-semibold">{tx.rate}</p>
                      <div className="flex min-h-11 items-center gap-2">
                        <span className="text-ink-2">{tx.rateUnknown}</span>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            set(['years', yi, 'brackets', bi, 'rate'], 0)
                          }
                        >
                          {c.edit}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <NumberField
                      label={tx.rate}
                      path={['years', yi, 'brackets', bi, 'rate']}
                      step="any"
                      min={0}
                      value={toPercent(b.rate)}
                      onChange={(v) =>
                        set(
                          ['years', yi, 'brackets', bi, 'rate'],
                          v === undefined ? 0 : v / 100,
                        )
                      }
                    />
                  )}
                  <div className="flex gap-1">
                    {b.rate !== TODO && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          set(['years', yi, 'brackets', bi, 'rate'], TODO)
                        }
                      >
                        {tx.rateUnknown}
                      </Button>
                    )}
                    {year.brackets.length > 1 && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          update(removeIn(value, ['years', yi, 'brackets'], bi))
                        }
                      >
                        {c.remove}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <AddButton
                onClick={() => {
                  // a new bracket goes before the open-ended last one
                  const last = year.brackets.length - 1
                  const prev = year.brackets[last - 1]?.upTo ?? 0
                  update(
                    insertIn(
                      value,
                      ['years', yi, 'brackets'],
                      { upTo: prev + 1_000_000, rate: 0 },
                      last,
                    ),
                  )
                }}
              >
                {tx.addBracket}
              </AddButton>
            </ItemCard>
          ))}
          <AddButton
            onClick={() => {
              const last = value.years.at(-1)
              update(
                insertIn(value, ['years'], {
                  year: (last?.year ?? new Date().getFullYear()) + 1,
                  label: TODO,
                  brackets: structuredClone(
                    last?.brackets ?? [{ upTo: null, rate: 0 }],
                  ),
                }),
              )
            }}
          >
            {tx.addYear}
          </AddButton>

          {errors.size > 0 && (
            <Notice tone="error">{adminCopy.errors.codes.invalid_input}</Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {saved && <Notice tone="success">{c.saved}</Notice>}
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            className="self-start"
          >
            {c.save}
          </Button>
        </form>
      </ErrorsProvider>
    </Panel>
  )
}

// ---- email alerts ------------------------------------------------------------------------------

const OUTBOX_STATUSES = ['pending', 'sending', 'sent', 'failed', 'skipped']

function AlertsSection({
  outbox,
  subscribers,
}: {
  outbox: Data['outbox']
  subscribers: number
}) {
  const a = t.alerts
  const problems = outbox
    .filter((e) => e.last_error && e.status !== 'sent')
    .slice(0, 5)
  return (
    <Panel id="alerts" title={a.title} intro={a.intro}>
      <p className="text-small font-semibold">{a.subscribers(subscribers)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {OUTBOX_STATUSES.map((status) => (
          <div key={status} className="rounded-xl bg-paper px-3 py-2">
            <dt className="text-meta text-muted">{a.statuses[status]}</dt>
            <dd className="text-[20px] font-bold tabular-nums">
              {outbox.filter((e) => e.status === status).length}
            </dd>
          </div>
        ))}
      </dl>
      {outbox.some((e) => e.status === 'skipped') && (
        <p className="mt-2 text-meta text-muted">{a.skippedHint}</p>
      )}
      {problems.length > 0 && (
        <>
          <h3 className="mt-4 text-[15px]">{a.problems}</h3>
          <ul className="mt-1 flex flex-col gap-1 text-meta">
            {problems.map((e) => (
              <li key={e.id} className="break-words">
                <span className="text-muted tabular-nums">
                  {formatDateTime(e.created_at)}
                </span>{' '}
                {e.last_error}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

// ---- page --------------------------------------------------------------------------------------

export function Component() {
  useDocumentTitle(`${t.title} · ${adminCopy.title}`)
  const data = useLoaderData() as Data
  return (
    <div className="flex max-w-[960px] flex-col gap-5">
      <PageHeader title={t.title} />
      <MeSection />
      {data.admin && (
        <>
          <TeamSection team={data.team} />
          <PublishingSection settings={data.settings} />
          <ChannelsSection channels={data.channels} />
          {data.taxRules && <TaxSection taxRules={data.taxRules} />}
          <AlertsSection outbox={data.outbox} subscribers={data.subscribers} />
        </>
      )}
    </div>
  )
}
