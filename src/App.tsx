import { ChangeEvent, DragEvent, SVGProps, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Clock3, FileAudio, Github, Headphones, LoaderCircle, Plus, Settings, ShieldCheck, Trash2, Upload } from 'lucide-react'
import packageJson from '../package.json'
import { AbxTest } from './components/AbxTest'
import { ListeningSet } from './components/ListeningSet'
import { Step } from './components/Step'
import type { Choice, PresetId, Progress, Source, TranscodeJob, Variant } from './types'

const version = `v${packageJson.version}`
const githubUrl = 'https://github.com/sortedcord/greenear'

const codecs: Choice['codec'][] = ['mp3', 'aac', 'opus', 'ogg']
const bitrates = [64, 96, 128, 160, 192, 256, 320]
type PresetIcon = (props: SVGProps<SVGSVGElement>) => React.ReactNode

const YouTubeOutline: PresetIcon = props => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><path d="M21.2 7.2a2.7 2.7 0 0 0-1.9-1.9C17.6 4.8 12 4.8 12 4.8s-5.6 0-7.3.5a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2.3 12a28 28 0 0 0 .5 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.3.5 7.3.5s5.6 0 7.3-.5a2.7 2.7 0 0 0 1.9-1.9 28 28 0 0 0 .5-4.8 28 28 0 0 0-.5-4.8Z"/><path d="m10 9 5 3-5 3V9Z"/></svg>
const YouTubeMusicOutline: PresetIcon = props => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="m10.6 9.7 4 2.3-4 2.3V9.7Z"/></svg>
const SpotifyOutline: PresetIcon = props => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><circle cx="12" cy="12" r="9"/><path d="M7.2 9.4c3.5-1 7.2-.7 10.4.9"/><path d="M7.9 12.4c2.9-.8 6-.5 8.7.8"/><path d="M8.6 15.2c2.3-.6 4.7-.4 6.8.6"/></svg>

const qualityPresets: { id: PresetId; name: string; detail: string; choice: Choice; icon: PresetIcon }[] = [
  { id: 'youtube', name: 'YouTube', detail: 'AAC · 128 kbps', choice: { codec: 'aac', bitrate: 128, label: 'YouTube · AAC 128 kbps' }, icon: YouTubeOutline },
  { id: 'youtubeMusic', name: 'YT Music', detail: 'Opus · 256 kbps', choice: { codec: 'opus', bitrate: 256, label: 'YT Music · Opus 256 kbps' }, icon: YouTubeMusicOutline },
  { id: 'spotify', name: 'Spotify', detail: 'Ogg · 320 kbps', choice: { codec: 'ogg', bitrate: 320, label: 'Spotify · Ogg 320 kbps' }, icon: SpotifyOutline },
]

function App() {
  const [source, setSource] = useState<Source | null>(null)
  const [selectedPresets, setSelectedPresets] = useState<PresetId[]>(['youtube', 'youtubeMusic', 'spotify'])
  const [customEnabled, setCustomEnabled] = useState(false)
  const [customChoices, setCustomChoices] = useState<Choice[]>([{ codec: 'mp3', bitrate: 192 }])
  const [variants, setVariants] = useState<Variant[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const [testPair, setTestPair] = useState<[string, string] | null>(null)

  useEffect(() => () => { if (source) void fetch(`/api/session/${source.sessionId}`, { method: 'DELETE', keepalive: true }) }, [source])

  async function uploadFile(file?: File) {
    if (!file) return
    setError(''); setVariants([]); setTestPair(null); setProgress({ kind: 'upload', value: 0, fileName: file.name })
    const form = new FormData(); form.append('audio', file)
    try {
      const body = await new Promise<Source>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('POST', '/api/upload')
        request.upload.onprogress = event => { if (event.lengthComputable) setProgress({ kind: 'upload', value: Math.round(event.loaded / event.total * 100), fileName: file.name }) }
        request.onerror = () => reject(new Error('Upload failed.'))
        request.onload = () => {
          try {
            const response = JSON.parse(request.responseText) as Source & { error?: string }
            if (request.status < 200 || request.status >= 300) return reject(new Error(response.error ?? 'Upload failed.'))
            resolve(response)
          } catch {
            reject(new Error(request.status === 413 ? 'Upload rejected by the network proxy before it reached the server. Use the app locally for this file.' : 'Upload failed.'))
          }
        }
        request.send(form)
      })
      setSource(body)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.') }
    finally { setProgress(null) }
  }

  const choices = [
    ...qualityPresets.filter(preset => selectedPresets.includes(preset.id)).map(preset => preset.choice),
    ...(customEnabled ? customChoices.map(choice => ({ ...choice, label: `Custom · ${choice.codec.toUpperCase()} ${choice.bitrate} kbps` })) : []),
  ]

  function togglePreset(id: PresetId) {
    setSelectedPresets(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  }

  async function transcode() {
    if (!source || choices.length === 0) return
    setError(''); setProgress({ kind: 'transcode', value: 0 })
    try {
      const response = await fetch('/api/transcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: source.sessionId, variants: choices }) })
      let job: { statusUrl?: string; error?: string }
      try { job = await response.json() } catch { job = {} }
      if (!response.ok || !job.statusUrl) throw new Error(job.error ?? 'Could not start conversion.')
      for (;;) {
        const statusResponse = await fetch(job.statusUrl)
        let status: TranscodeJob
        try { status = await statusResponse.json() } catch { throw new Error('Could not check conversion progress.') }
        if (!statusResponse.ok) throw new Error(status.error ?? 'Could not check conversion progress.')
        setProgress({ kind: 'transcode', value: status.progress })
        if (status.status === 'complete') {
          setVariants(status.variants ?? [])
          break
        }
        if (status.status === 'failed') throw new Error(status.error ?? 'Conversion failed.')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Conversion failed.') }
    finally { setProgress(null) }
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Green Ear home"><BrandMark /><span>Green Ear</span></a>
      <nav className="header-nav" aria-label="Utility navigation">
        <span className="privacy-note"><ShieldCheck aria-hidden /> Your shame is deleted in 1 hour</span>
        <a href={githubUrl} target="_blank" rel="noreferrer" aria-label="Green Ear on GitHub">GitHub <Github aria-hidden /></a>
        <span className="version" aria-label={`Version ${version}`}>{version}</span>
      </nav>
    </header>

    <main id="top" className="page-frame">
      <section className="hero-grid" aria-labelledby="hero-title">
        <article className="hero-statement module reveal reveal-1">
          <div className="module-meta"><span>Ego destruction tool</span><span>01 / 03</span></div>
          <h1 id="hero-title">Do you even<br />FLAC bro?</h1>
          <div className="hero-footer">
            <p>Probably not. But let's find out before you buy another DAC.</p>
            <span className="hero-arrow" aria-hidden><ArrowUpRight /></span>
          </div>
          <div className="hero-orbit" aria-hidden><span /><span /></div>
        </article>

        <article className="hero-system module reveal reveal-2">
          <div className="technical-grid" aria-hidden />
          <div className="module-meta light"><span>Copium detector</span><span>Signal path</span></div>
          <BrandMark className="hero-mark" />
          <p className="system-copy">FLAC IN.<br />EGO OUT.<br />COPE OPEN.</p>
          <div className="signal-orbit" aria-hidden><span>A</span><span>B</span><span>X</span></div>
        </article>

        <article className="hero-stat module reveal reveal-3">
          <div className="module-meta"><span>Reality check</span><span>10 rounds</span></div>
          <strong>10<span>/10</span></strong>
          <p>Good luck scoring<br />above chance.</p>
        </article>

        <article className="hero-principle module reveal reveal-4">
          <Clock3 aria-hidden />
          <div><span>No witnesses</span><strong>Your results self-destruct in one hour.</strong></div>
        </article>
      </section>

      <section className="setup-board" aria-label="Create a listening set">
        <article className="upload-card module reveal reveal-2">
          <div className="module-meta"><span>The precious file</span><span>Step 01</span></div>
          <Step number="01" title="Upload your precious FLAC" />
          <p className="section-intro">That 50 MB file you swear sounds better than the 4 MB MP3. Let's put it on trial.</p>
          <DropZone source={source} busy={progress?.kind === 'upload'} progress={progress?.kind === 'upload' ? progress : null} onFile={uploadFile} />
          <div className="format-strip" aria-label="Supported formats"><span>FLAC</span><span>WAV</span><span>AIFF</span><span>ALAC</span></div>
        </article>

        <article className="quality-card module reveal reveal-3">
          <div className="technical-grid quality-grid" aria-hidden />
          <div className="module-meta light"><span>The lineup</span><span>Step 02</span></div>
          <Step number="02" title="Pick the imposters" />
          <p className="section-intro">Choose the "garbage" lossy codecs you've been trash-talking on forums. They're about to fight back.</p>
          <div className="preset-grid">
            {qualityPresets.map(preset => {
              const selected = selectedPresets.includes(preset.id)
              const Icon = preset.icon
              return <button type="button" key={preset.id} aria-pressed={selected} onClick={() => togglePreset(preset.id)} className={`preset-card ${selected ? 'is-selected' : ''}`}>
                <span className="preset-index">0{qualityPresets.findIndex(item => item.id === preset.id) + 1}</span>
                {selected && <span className="selection-mark" aria-hidden><Check /></span>}
                <Icon className="preset-icon" />
                <span className="preset-name">{preset.name}</span><span className="preset-detail">{preset.detail}</span>
              </button>
            })}
            <button type="button" aria-pressed={customEnabled} onClick={() => setCustomEnabled(value => !value)} className={`preset-card ${customEnabled ? 'is-selected' : ''}`}>
              <span className="preset-index">04</span>
              {customEnabled && <span className="selection-mark" aria-hidden><Check /></span>}
              <Settings aria-hidden className="preset-icon" strokeWidth={1.5} />
              <span className="preset-name">Custom</span><span className="preset-detail">Codec + bitrate</span>
            </button>
          </div>

          {customEnabled && <div className="custom-panel">
            <div className="custom-heading"><h3>Custom versions</h3><span>{customChoices.length} / 5</span></div>
            <div className="custom-list">{customChoices.map((choice, i) => <div key={i} className="custom-row">
              <select aria-label={`Custom codec ${i + 1}`} value={choice.codec} onChange={e => setCustomChoices(current => current.map((item, j) => j === i ? { ...item, codec: e.target.value as Choice['codec'] } : item))}>{codecs.map(codec => <option key={codec} value={codec}>{codec === 'ogg' ? 'OGG VORBIS' : codec.toUpperCase()}</option>)}</select>
              <select aria-label={`Custom bitrate ${i + 1}`} value={choice.bitrate} onChange={e => setCustomChoices(current => current.map((item, j) => j === i ? { ...item, bitrate: Number(e.target.value) } : item))}>{bitrates.map(bitrate => <option key={bitrate} value={bitrate}>{bitrate} kbps</option>)}</select>
              <button type="button" aria-label="Remove custom version" disabled={customChoices.length === 1} onClick={() => setCustomChoices(current => current.filter((_, j) => j !== i))} className="icon-button"><Trash2 /></button>
            </div>)}</div>
            <button type="button" disabled={customChoices.length >= 5 || choices.length >= 8} onClick={() => setCustomChoices(current => [...current, { codec: 'aac', bitrate: 192 }])} className="text-button"><Plus /> Add custom version</button>
          </div>}

          {progress?.kind === 'transcode' && <ProgressBar label="Transcoding progress" message="Creating listening set" value={progress.value} />}
          {error && <p role="alert" className="error-message">{error}</p>}
          <button type="button" onClick={transcode} disabled={!source || progress !== null || choices.length === 0} className="primary-action">
            {progress?.kind === 'transcode' ? <LoaderCircle className="spin" /> : <Headphones />} <span>Create listening set</span> {/* test-critical label */}<ArrowUpRight className="action-arrow" />
          </button>
        </article>
      </section>

      {source && variants.length > 0 && <ListeningSet source={source} variants={variants} onStart={(a, b) => setTestPair([a, b])} />}
      {testPair && <AbxTest sources={[{ id: 'reference', label: 'Lossless reference', url: source!.referenceUrl }, ...variants].filter(v => testPair.includes(v.id))} onClose={() => setTestPair(null)} />}
    </main>

    <footer className="site-footer"><div className="brand"><BrandMark /><span>Green Ear</span></div><p>Your ears are<br />probably lying.</p><div><span>Open source ego check</span><span>{version} / 2026</span></div></footer>
  </div>
}

function BrandMark({ className = '' }: { className?: string }) {
  return <svg className={`brand-mark ${className}`} viewBox="0 0 32 32" aria-hidden><path d="M4 4h12v12H4z" /><path d="M16 4a12 12 0 0 1 0 24V16H4A12 12 0 0 1 16 4Z" fill="currentColor" fillOpacity=".38" /><circle cx="16" cy="16" r="5" /></svg>
}

function ProgressBar({ label, message, value }: { label: string; message: string; value: number }) {
  const percent = Math.min(100, Math.max(0, Math.round(value)))
  return <div className="progress-block" aria-live="polite"><div className="progress-copy"><span>{message} · {percent}%</span><span>{percent.toString().padStart(2, '0')}%</span></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="progress-track"><div style={{ width: `${percent}%` }} /></div></div>
}

function DropZone({ source, busy, progress, onFile }: { source: Source | null; busy: boolean; progress: Progress | null; onFile: (file?: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const drop = (e: DragEvent) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }
  const change = (e: ChangeEvent<HTMLInputElement>) => onFile(e.target.files?.[0])
  if (source) return <div><div className="source-ready"><span className="source-icon"><FileAudio /></span><div><p>{source.name}</p><span><Check /> Ready to encode</span></div><button type="button" onClick={() => input.current?.click()}>Replace</button><input ref={input} hidden type="file" accept=".wav,.flac,.aif,.aiff,.alac,.m4a,audio/wav,audio/flac" onChange={change} /></div></div>
  return <div><button type="button" disabled={busy} onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={drop} className="drop-zone">
    <span className="upload-icon"><Upload /></span><span className="drop-title">Drop the sacred lossless file</span><span className="drop-detail">we won't judge the 500 MB album rip · up to 500 MB</span><span className="drop-cta">Choose audio <ArrowUpRight /></span><input ref={input} hidden type="file" accept=".wav,.flac,.aif,.aiff,.alac,.m4a,audio/wav,audio/flac" onChange={change} />
  </button>{progress && <ProgressBar label="Upload progress" message={`Uploading source${progress.fileName ? ` · ${progress.fileName}` : ''}`} value={progress.value} />}</div>
}


export default App
