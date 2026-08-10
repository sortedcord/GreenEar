import { expect, test, type APIRequestContext } from '@playwright/test'

type Variant = { id: string; codec: string; bitrate: number; label: string; url: string }
type TranscodeJob = { status: 'processing' | 'complete' | 'failed'; progress: number; variants?: Variant[]; error?: string }

function wavFixture() {
  const buffer = Buffer.alloc(46)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(38, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(8_000, 24)
  buffer.writeUInt32LE(16_000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(2, 40)
  return buffer
}

async function waitForJob(request: APIRequestContext, statusUrl: string): Promise<TranscodeJob> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await request.get(statusUrl)
    expect(response.ok()).toBeTruthy()
    const job = await response.json() as TranscodeJob
    if (job.status !== 'processing') return job
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Conversion did not complete within five seconds.')
}

test('reuses a matching encoded variant when adding another quality', async ({ request }) => {
  const upload = await request.post('/api/upload', {
    multipart: { audio: { name: 'source.wav', mimeType: 'audio/wav', buffer: wavFixture() } },
  })
  expect(upload.status()).toBe(201)
  const source = await upload.json() as { sessionId: string }

  const firstStart = await request.post('/api/transcode', {
    data: { sessionId: source.sessionId, variants: [{ codec: 'mp3', bitrate: 192, label: 'MP3 192' }] },
  })
  expect(firstStart.status()).toBe(202)
  const firstJob = await firstStart.json() as { statusUrl: string }
  const first = await waitForJob(request, firstJob.statusUrl)
  expect(first.status).toBe('complete')
  const firstMp3 = first.variants?.[0]
  expect(firstMp3).toMatchObject({ codec: 'mp3', bitrate: 192 })

  const secondStart = await request.post('/api/transcode', {
    data: { sessionId: source.sessionId, variants: [
      { codec: 'mp3', bitrate: 192, label: 'MP3 192' },
      { codec: 'aac', bitrate: 128, label: 'AAC 128' },
    ] },
  })
  expect(secondStart.status()).toBe(202)
  const secondJob = await secondStart.json() as { statusUrl: string }
  const second = await waitForJob(request, secondJob.statusUrl)
  expect(second.status).toBe('complete')
  expect(second.variants).toHaveLength(2)
  expect(second.variants?.find(variant => variant.codec === 'mp3' && variant.bitrate === 192)?.id).toBe(firstMp3?.id)
  expect(second.variants?.find(variant => variant.codec === 'aac' && variant.bitrate === 128)).toBeTruthy()

  await request.delete(`/api/session/${source.sessionId}`)
})
