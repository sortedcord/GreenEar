import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { z } from 'zod'

const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static') as string | null
const PORT = Number(process.env.PORT ?? 3001)
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 500)
const TTL_MS = Number(process.env.SESSION_TTL_HOURS ?? 24) * 60 * 60 * 1000
const root = path.resolve(process.cwd(), 'data')
await fsp.mkdir(root, { recursive: true })

const app = express()
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? false : /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
app.use(express.json({ limit: '50kb' }))
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }))

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, root),
    filename: (_req, _file, cb) => cb(null, `incoming-${crypto.randomUUID()}`),
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /\.(wav|flac|aif|aiff|alac|m4a)$/i.test(file.originalname)),
})

const transcodeSchema = z.object({
  sessionId: z.string().uuid(),
  variants: z.array(z.object({
    codec: z.enum(['mp3', 'aac', 'opus', 'ogg']),
    bitrate: z.number().int().min(48).max(512),
    label: z.string().trim().min(1).max(80).optional(),
  })).min(1).max(8),
})

type Variant = { id: string; codec: string; bitrate: number; url: string; label: string }
type Session = { id: string; dir: string; originalName: string; originalPath: string; createdAt: number; variants: Variant[] }
const sessions = new Map<string, Session>()

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('FFmpeg is unavailable on this platform'))
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args])
    let stderr = ''
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
    child.on('error', reject)
    child.on('close', (code: number | null) => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg exited with ${code}`)))
  })
}

async function removeSession(id: string) {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  await fsp.rm(session.dir, { recursive: true, force: true })
}

app.post('/api/upload', upload.single('audio'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a supported lossless audio file.' })
  const id = crypto.randomUUID()
  const dir = path.join(root, id)
  try {
    await fsp.mkdir(dir)
    const originalPath = path.join(dir, 'reference.wav')
    await runFfmpeg(['-i', req.file.path, '-map_metadata', '-1', '-vn', '-c:a', 'pcm_s24le', originalPath])
    await fsp.unlink(req.file.path)
    sessions.set(id, { id, dir, originalName: path.basename(req.file.originalname), originalPath, createdAt: Date.now(), variants: [] })
    res.status(201).json({ sessionId: id, name: path.basename(req.file.originalname), referenceUrl: `/media/${id}/reference.wav` })
  } catch (error) {
    await fsp.rm(req.file.path, { force: true })
    await fsp.rm(dir, { recursive: true, force: true })
    next(error)
  }
})

app.post('/api/transcode', async (req, res, next) => {
  try {
    const input = transcodeSchema.parse(req.body)
    const session = sessions.get(input.sessionId)
    if (!session) return res.status(404).json({ error: 'Session expired. Upload the source again.' })
    const variants: Variant[] = []
    for (const requested of input.variants) {
      const id = crypto.randomUUID()
      const extension = requested.codec === 'aac' ? 'm4a' : requested.codec
      const output = path.join(session.dir, `${id}.${extension}`)
      const codecArgs = requested.codec === 'mp3'
        ? ['-c:a', 'libmp3lame', '-b:a', `${requested.bitrate}k`]
        : requested.codec === 'aac'
          ? ['-c:a', 'aac', '-b:a', `${requested.bitrate}k`, '-movflags', '+faststart']
          : requested.codec === 'ogg'
            ? ['-ac', '2', '-c:a', 'libvorbis', '-b:a', `${requested.bitrate}k`]
            : ['-c:a', 'libopus', '-b:a', `${requested.bitrate}k`, '-vbr', 'on']
      await runFfmpeg(['-i', session.originalPath, '-vn', ...codecArgs, output])
      variants.push({ id, codec: requested.codec, bitrate: requested.bitrate, label: requested.label ?? `${requested.codec.toUpperCase()} · ${requested.bitrate} kbps`, url: `/media/${session.id}/${path.basename(output)}` })
    }
    session.variants.push(...variants)
    res.json({ variants })
  } catch (error) { next(error) }
})

app.get('/media/:session/:file', (req, res) => {
  const session = sessions.get(req.params.session)
  if (!session || !/^[a-zA-Z0-9.-]+$/.test(req.params.file)) return res.sendStatus(404)
  const file = path.join(session.dir, req.params.file)
  if (!file.startsWith(`${session.dir}${path.sep}`) || !fs.existsSync(file)) return res.sendStatus(404)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.sendFile(file)
})

app.delete('/api/session/:id', async (req, res) => {
  await removeSession(req.params.id)
  res.sendStatus(204)
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${MAX_UPLOAD_MB} MB.` : error.message })
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid conversion settings.' })
  res.status(500).json({ error: error instanceof Error ? error.message : 'Something went wrong.' })
})

setInterval(() => {
  for (const [id, session] of sessions) if (Date.now() - session.createdAt > TTL_MS) void removeSession(id)
}, 60 * 60 * 1000).unref()

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(process.cwd(), 'dist')
  app.use(express.static(dist))
  app.get('*splat', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () => console.log(`Audio AB server listening on http://localhost:${PORT}`))
