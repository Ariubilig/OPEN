// The public site in a real browser: the feed, a story, the source sheet, following, keyboard use,
// reduced motion and automated accessibility checks (CLAUDE.md rules 6 and 9).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './mock-api'

// countdowns and "N хоногийн дараа" depend on today
const TODAY = new Date('2026-10-05T10:00:00+08:00')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await mockApi(page)
})

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact ?? ''),
  )
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
  ).toEqual([])
}

test('the feed lists the published stories in Mongolian', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'mn')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Мэдээлэл нээлттэй.',
  )
  await expect(page.getByRole('heading', { name: 'Онцлох' })).toBeVisible()
  await expect(page.getByText('6 мэдээ')).toBeVisible()
  await expect(
    page.getByText(
      'Тод бол бие даасан иргэний мэдээллийн платформ. УИХ, Засгийн газрын албан ёсны сайт биш.',
    ),
  ).toBeVisible()
  await expectAccessible(page)
})

test('search filters the list as you type and can be cleared', async ({
  page,
}) => {
  await page.goto('/')
  const search = page.getByRole('searchbox', { name: 'Мэдээ хайх' })
  await search.fill('792000₮')
  await expect(page.getByText('1 мэдээ')).toBeVisible()
  await expect(page).toHaveURL(/\?q=792000/)
  await page.getByRole('button', { name: 'Хайлтыг арилгах' }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByText('6 мэдээ')).toBeVisible()
})

test('a story shows its sections, the disclaimer and its sources', async ({
  page,
}) => {
  await page.goto('/story/tax-package-2026')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '792,000₮',
  )
  await expect(
    page.getByRole('heading', { name: 'Юу өөрчлөгдсөн бэ?' }),
  ).toBeVisible()
  await expect(
    page.getByText('Энэ нь мэдээлэл бөгөөд хуулийн зөвлөгөө биш.'),
  ).toBeVisible()
  await expectAccessible(page)
})

test('a source marker opens the source sheet; Esc closes it and focus returns', async ({
  page,
}) => {
  await page.goto('/story/tax-package-2026')
  const marker = page.getByRole('button', { name: 'Эх сурвалж 1' }).first()
  await marker.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Энэ өгүүлбэр')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(marker).toBeFocused()
})

test('the skip link is the first stop and moves focus to the content', async ({
  page,
}) => {
  await page.goto('/')
  // after the page has rendered (the loading screen is replaced, focus with it)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Үндсэн агуулга руу шилжих' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
})

test('with reduced motion the source sheet does not animate', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/story/tax-package-2026')
  await page.getByRole('button', { name: 'Эх сурвалж 1' }).first().click()
  const duration = await page
    .getByRole('dialog')
    .evaluate((el) => getComputedStyle(el).animationDuration)
  expect(parseFloat(duration)).toBeLessThan(0.001)
})

test('a followed story appears on the feed, flagged when its stage moved', async ({
  page,
}) => {
  await page.goto('/story/budget-2027')
  await page.getByRole('button', { name: 'Дагах', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Дагаж байна', exact: true }),
  ).toBeVisible()

  // the reader last saw it at an earlier stage
  await page.evaluate(() => {
    const seen = JSON.parse(localStorage.getItem('tod:seen') ?? '{}')
    seen['budget-2027'] = { stage: 'Өргөн мэдүүлсэн', step: 'Өргөн мэдүүлсэн' }
    localStorage.setItem('tod:seen', JSON.stringify(seen))
  })
  await page.goto('/')
  const following = page.getByRole('region', { name: 'Дагаж буй' })
  await expect(following.getByText('Шат өөрчлөгдсөн')).toBeVisible()
  await expect(following.getByText('Өмнө нь: Өргөн мэдүүлсэн')).toBeVisible()

  // opening the story again: seen, no flag
  await following.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/story\/budget-2027/)
  await page.goto('/')
  await expect(
    page
      .getByRole('region', { name: 'Дагаж буй' })
      .getByText('Шат өөрчлөгдсөн'),
  ).toHaveCount(0)
})

test('the About page and the not-found page', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Арга зүй')
  await expectAccessible(page)
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Хуудас олдсонгүй',
  )
})

test('an upcoming step can be added to a calendar', async ({ page }) => {
  await page.goto('/story/tax-package-2026')
  const timeline = page.getByRole('region', { name: 'Хаана явж байна?' })
  const buttons = timeline.getByRole('button', { name: /Календарьт нэмэх/ })
  // the two dated steps still ahead (2027 and 2028), nothing for past or undated ones
  await expect(buttons).toHaveCount(2)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    buttons.first().click(),
  ])
  expect(download.suggestedFilename()).toBe('tax-package-2026-2027-01-01.ics')
  const ics = await (await download.createReadStream()).toArray()
  const text = Buffer.concat(ics).toString('utf8')
  expect(text).toContain('DTSTART;VALUE=DATE:20270101')
  expect(text).toContain('URL:http://localhost:')
  expect(text).toContain('BEGIN:VEVENT')
})
