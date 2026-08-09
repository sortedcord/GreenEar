import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

test('README embeds the generated frontend screenshot', async ({ page }) => {
  const screenshot = path.resolve(import.meta.dirname, '../docs/screenshots/frontend.png')
  const readme = await fs.readFile(path.resolve(import.meta.dirname, '../README.md'), 'utf8')
  expect(readme).toContain('docs/screenshots/frontend.png')

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Can you hear the difference?' })).toBeVisible()
  await fs.mkdir(path.dirname(screenshot), { recursive: true })
  await page.screenshot({ path: screenshot, fullPage: true })
})
