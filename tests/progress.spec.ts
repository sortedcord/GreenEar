import { expect, test } from '@playwright/test'

test('shows a helpful error when an upload proxy returns an HTML 413 response', async ({ page }) => {
  await page.route('**/api/upload', route => route.fulfill({
    status: 413,
    contentType: 'text/html',
    body: '<html><h1>Content Too Large</h1></html>',
  }))
  const pageError = page.waitForEvent('pageerror', { timeout: 1_000 }).then(error => error).catch(() => null)

  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'large.flac', mimeType: 'audio/flac', buffer: Buffer.from('audio') })

  await expect(page.getByRole('alert')).toHaveText('Upload rejected by the network proxy before it reached the server. Use the app locally for this file.')
  expect(await pageError).toBeNull()
})

test('shows progress indicators while uploading and transcoding', async ({ page }) => {
  await page.addInitScript(() => {
    const open = XMLHttpRequest.prototype.open
    const send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
      Object.assign(this, { __greenEarUrl: url })
      open.call(this, method, url, async ?? true, username, password)
    }
    XMLHttpRequest.prototype.send = function (body) {
      if (String((this as XMLHttpRequest & { __greenEarUrl?: string }).__greenEarUrl).includes('/api/upload')) {
        setTimeout(() => send.call(this, body), 750)
        return
      }
      return send.call(this, body)
    }
  })
  await page.route('**/api/upload', async route => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ sessionId: '11111111-1111-4111-8111-111111111111', name: 'source.wav', referenceUrl: '/media/reference.wav' }),
    })
  })
  await page.route('**/api/transcode', route => route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({ jobId: 'job-1', statusUrl: '/api/transcode/job-1' }),
  }))
  await page.route('**/api/transcode/job-1', async route => {
    await new Promise(resolve => setTimeout(resolve, 750))
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'processing', progress: 42 }) })
  })

  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'source.wav', mimeType: 'audio/wav', buffer: Buffer.from('audio') })
  await expect(page.getByRole('progressbar', { name: 'Upload progress' })).toBeVisible()
  await expect(page.getByText('Uploading source · source.wav · 0%')).toBeVisible()
  await expect(page.getByText('source.wav')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create listening set' })).toBeEnabled()

  await page.getByRole('button', { name: 'Create listening set' }).click()
  await expect(page.getByRole('progressbar', { name: 'Transcoding progress' })).toBeVisible()
  await expect(page.getByText('Creating listening set · 42%')).toBeVisible()
})
