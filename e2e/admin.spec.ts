// The admin in a real browser: the sign-in page, the story list, and publishing a story that is in
// review (the RPC the database checks again). The session is a stand-in (e2e/mock-api.ts).
import { expect, test } from '@playwright/test'
import { EDITOR, mockApi, REVIEWER, signIn } from './mock-api'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-05T10:00:00+08:00'))
})

test('without a session the admin asks for an email address', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Удирдлагад нэвтрэх',
  )
  await expect(page.getByLabel('И-мэйл хаяг')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  )
})

test('a reviewer publishes a story that is in review', async ({ page }) => {
  const api = await mockApi(page)
  const story = api.tables.stories.find((s) => s.id === 'housing-16000')!
  story.state = 'in_review'
  story.updated_by = EDITOR.user_id
  await signIn(page, REVIEWER)

  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Мэдээ')
  await expect(page.getByText(REVIEWER.name)).toBeVisible()
  await page
    .getByRole('link', { name: /16,000 орон сууцыг/ })
    .first()
    .click()

  await expect(page).toHaveURL(/\/admin\/stories\/housing-16000/)
  await expect(page.getByText('Хянуулж буй').first()).toBeVisible()
  await page.getByRole('button', { name: 'Нийтлэх', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Нийтлэх' })
  await expect(dialog).toBeVisible()
  await dialog
    .getByLabel(/Шалгасан тухай тэмдэглэл/)
    .fill('Эх сурвалжтай тулгав.')
  await dialog.getByRole('button', { name: 'Нийтлэх', exact: true }).click()

  await expect(page.getByText('Нийтэллээ. Сайтад гарлаа.')).toBeVisible()
  expect(api.calls.find((c) => c.name === 'publish_story')?.args).toEqual({
    p_id: 'housing-16000',
    p_version: 1,
    p_note: 'Эх сурвалжтай тулгав.',
    p_correction: '',
  })
})

test('the person who last changed a story cannot publish it', async ({
  page,
}) => {
  const api = await mockApi(page)
  const story = api.tables.stories.find((s) => s.id === 'housing-16000')!
  story.state = 'in_review'
  story.updated_by = REVIEWER.user_id
  await signIn(page, REVIEWER)

  await page.goto('/admin/stories/housing-16000')
  await page.getByRole('button', { name: 'Нийтлэх', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Нийтлэх' })
  await expect(
    dialog.getByRole('button', { name: 'Нийтлэх', exact: true }),
  ).toBeDisabled()
  expect(api.calls.some((c) => c.name === 'publish_story')).toBe(false)
})

test('a step whose date has passed is flagged on the list and in the editor', async ({
  page,
}) => {
  const api = await mockApi(page)
  const story = api.tables.stories.find((s) => s.id === 'budget-2027')!
  const content = story.content as { timeline: Record<string, unknown>[] }
  content.timeline.push({
    date: '2026-10-01',
    label: 'Туршилтын шат',
    status: 'upcoming',
  })
  const index = content.timeline.length - 1
  await signIn(page, REVIEWER)

  await page.goto('/admin')
  await expect(
    page.getByText('Огноо нь өнгөрсөн шаттай мэдээ: 1'),
  ).toBeVisible()
  await page.getByRole('button', { name: /Огноо өнгөрсөн/ }).click()
  await expect(page).toHaveURL(/overdue=1/)
  await expect(page.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByText('1 шатны огноо өнгөрсөн')).toBeVisible()

  await page.goto('/admin/stories/budget-2027')
  await expect(
    page.getByText(/1 шатны огноо өнгөрсөн ч «Хүлээгдэж буй» хэвээр байна/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Шат руу очих' }).click()
  await expect(
    page.locator(`[data-path="$.timeline[${index}].status"] select`),
  ).toBeFocused()
})
