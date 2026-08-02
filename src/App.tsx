import { ChangeEvent, DragEvent, SVGProps, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Headphones, Leaf, LoaderCircle, Pause, Play, Plus, Settings, ShieldCheck, Trash2, Upload } from 'lucide-react'

type Variant = { id: string; codec: string; bitrate: number; label: string; url: string }
type Source = { sessionId: string; name: string; referenceUrl: string }
type Choice = { codec: 'mp3' | 'aac' | 'opus' | 'ogg'; bitrate: number; label?: string }
type PresetId = 'youtube' | 'youtubeMusic' | 'spotify'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [testPair, setTestPair] = useState<[string, string] | null>(null)

  useEffect(() => () => { if (source) void fetch(`/api/session/${source.sessionId}`, { method: 'DELETE', keepalive: true }) }, [source])

  async function uploadFile(file?: File) {
    if (!file) return
    setBusy(true); setError(''); setVariants([]); setTestPair(null)
    const form = new FormData(); form.append('audio', file)
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setSource(body)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.') }
    finally { setBusy(false) }
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
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/transcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: source.sessionId, variants: choices }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setVariants(body.variants)
    } catch (e) { setError(e instanceof Error ? e.message : 'Conversion failed.') }
    finally { setBusy(false) }
  }

  return <div className="min-h-screen bg-[#f7faf7]">
    <header className="border-b border-green-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 text-green-900"><Leaf className="size-7" aria-hidden /><span className="text-lg font-bold">Green Ear</span></div>
        <span className="hidden items-center gap-1.5 text-sm text-green-800 sm:flex"><ShieldCheck className="size-4" /> Files deleted after 24 hours</span>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-9 max-w-2xl"><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-green-700">Lossy audio, honestly tested</p><h1 className="text-3xl font-bold tracking-tight text-green-950 sm:text-4xl">Can you hear the difference?</h1><p className="mt-3 text-base leading-7 text-slate-600">Upload a lossless master, create compressed versions, then run a blind ABX test in your browser.</p></div>
      <section className="rounded-xl border border-green-200 bg-white p-5 shadow-sm sm:p-7">
        <Step number="1" title="Upload a lossless source" />
        <DropZone source={source} busy={busy} onFile={uploadFile} />
        <div className="my-7 border-t border-slate-200" />
        <Step number="2" title="Choose quality versions" />
        <p className="-mt-2 mb-4 text-sm text-slate-600">Select one or more listening-quality presets to compare.</p>
        <div className="grid max-w-[42rem] grid-cols-2 gap-3 sm:grid-cols-4">
          {qualityPresets.map(preset => {
            const selected = selectedPresets.includes(preset.id)
            const Icon = preset.icon
            return <button type="button" key={preset.id} aria-pressed={selected} onClick={() => togglePreset(preset.id)} className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition-colors ${selected ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-white hover:border-green-400 hover:bg-green-50/50'}`}>
              {selected && <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-green-700 text-white"><Check className="size-4" /></span>}
              <Icon className="mb-3 size-9 text-green-700" />
              <span className="block font-bold text-slate-900">{preset.name}</span><span className="mt-1 block text-xs text-slate-500">{preset.detail}</span>
            </button>
          })}
          <button type="button" aria-pressed={customEnabled} onClick={() => setCustomEnabled(value => !value)} className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition-colors ${customEnabled ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-white hover:border-green-400 hover:bg-green-50/50'}`}>
            {customEnabled && <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-green-700 text-white"><Check className="size-4" /></span>}
            <Settings aria-hidden className="mb-3 size-9 text-green-700" strokeWidth={1.8} />
            <span className="block font-bold text-slate-900">Custom</span><span className="mt-1 block text-xs text-slate-500">Choose codec & bitrate</span>
          </button>
        </div>
        {customEnabled && <div className="mt-5 rounded-xl border border-green-200 bg-green-50/50 p-4">
          <h3 className="mb-3 text-sm font-bold text-green-950">Custom versions</h3>
          <div className="space-y-3">{customChoices.map((choice, i) => <div key={i} className="flex gap-3">
            <select aria-label={`Custom codec ${i + 1}`} value={choice.codec} onChange={e => setCustomChoices(current => current.map((item, j) => j === i ? { ...item, codec: e.target.value as Choice['codec'] } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium">{codecs.map(codec => <option key={codec} value={codec}>{codec === 'ogg' ? 'OGG VORBIS' : codec.toUpperCase()}</option>)}</select>
            <select aria-label={`Custom bitrate ${i + 1}`} value={choice.bitrate} onChange={e => setCustomChoices(current => current.map((item, j) => j === i ? { ...item, bitrate: Number(e.target.value) } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium">{bitrates.map(bitrate => <option key={bitrate} value={bitrate}>{bitrate} kbps</option>)}</select>
            <button aria-label="Remove custom version" disabled={customChoices.length === 1} onClick={() => setCustomChoices(current => current.filter((_, j) => j !== i))} className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><Trash2 className="size-5" /></button>
          </div>)}</div>
          <button disabled={customChoices.length >= 5 || choices.length >= 8} onClick={() => setCustomChoices(current => [...current, { codec: 'aac', bitrate: 192 }])} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-900 disabled:opacity-40"><Plus className="size-4" /> Add custom version</button>
        </div>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button onClick={transcode} disabled={!source || busy || choices.length === 0} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300">
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Headphones className="size-5" />} Create listening set
        </button>
      </section>
      {source && variants.length > 0 && <ListeningSet source={source} variants={variants} onStart={(a, b) => setTestPair([a, b])} />}
      {testPair && <AbxTest sources={[{ id: 'reference', label: 'Lossless reference', url: source!.referenceUrl }, ...variants].filter(v => testPair.includes(v.id))} onClose={() => setTestPair(null)} />}
    </main>
    <footer className="mx-auto max-w-5xl px-5 py-8 text-sm text-slate-500">Green Ear · Listen carefully, trust your results.</footer>
  </div>
}

function Step({ number, title }: { number: string; title: string }) { return <h2 className="mb-4 flex items-center gap-3 text-lg font-bold text-slate-900"><span className="grid size-7 place-items-center rounded-full bg-green-100 text-sm text-green-800">{number}</span>{title}</h2> }

function DropZone({ source, busy, onFile }: { source: Source | null; busy: boolean; onFile: (file?: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const drop = (e: DragEvent) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }
  const change = (e: ChangeEvent<HTMLInputElement>) => onFile(e.target.files?.[0])
  if (source) return <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4"><span className="grid size-10 place-items-center rounded-full bg-green-200 text-green-800"><Check className="size-5" /></span><div className="min-w-0"><p className="truncate font-semibold text-green-950">{source.name}</p><p className="text-sm text-green-700">Ready to encode</p></div><button onClick={() => input.current?.click()} className="ml-auto text-sm font-semibold text-green-800">Replace</button><input ref={input} hidden type="file" accept=".wav,.flac,.aif,.aiff,.alac,.m4a,audio/wav,audio/flac" onChange={change} /></div>
  return <button type="button" disabled={busy} onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={drop} className="w-full rounded-xl border-2 border-dashed border-green-300 bg-green-50/60 px-5 py-10 text-center hover:border-green-500 hover:bg-green-50 disabled:opacity-60">
    <Upload className="mx-auto mb-3 size-8 text-green-700" /><span className="block font-semibold text-green-950">Drop a FLAC, WAV, AIFF, or ALAC file here</span><span className="mt-1 block text-sm text-slate-500">or click to browse · up to 500 MB</span><input ref={input} hidden type="file" accept=".wav,.flac,.aif,.aiff,.alac,.m4a,audio/wav,audio/flac" onChange={change} />
  </button>
}

type ListenTrack = { id: string; label: string; url: string; codec?: string }
type ActiveTransport = { id: string; source: AudioBufferSourceNode; gain: GainNode; offset: number; startedAt: number }

function ListeningSet({ source, variants, onStart }: { source: Source; variants: Variant[]; onStart: (a: string, b: string) => void }) {
  const all: ListenTrack[] = [{ id: 'reference', label: 'Lossless reference', url: source.referenceUrl }, ...variants]
  const trackKey = all.map(track => `${track.id}:${track.url}`).join('|')
  const [pair, setPair] = useState<[string, string]>(['reference', variants[0].id])
  const [activeId, setActiveId] = useState('reference')
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const contextRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef(new Map<string, AudioBuffer>())
  const transportRef = useRef<ActiveTransport | null>(null)
  const frameRef = useRef<number | null>(null)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const getPosition = () => {
    const transport = transportRef.current
    if (!transport || !contextRef.current) return position
    return Math.min(transport.offset + contextRef.current.currentTime - transport.startedAt, buffersRef.current.get(transport.id)?.duration ?? Infinity)
  }

  const stopTransport = (fadeOut = false) => {
    const transport = transportRef.current
    const context = contextRef.current
    if (!transport || !context) return
    const now = context.currentTime
    transport.gain.gain.cancelScheduledValues(now)
    if (fadeOut) {
      transport.gain.gain.setValueAtTime(Math.max(transport.gain.gain.value, 0.0001), now)
      transport.gain.gain.linearRampToValueAtTime(0.0001, now + 0.012)
      transport.source.stop(now + 0.015)
    } else transport.source.stop()
    transportRef.current = null
  }

  const beginPlayback = (id: string, requestedOffset: number, fadeIn = false) => {
    const context = contextRef.current
    const buffer = buffersRef.current.get(id)
    if (!context || !buffer) return false
    const offset = Math.min(Math.max(0, requestedOffset), Math.max(0, buffer.duration - 0.001))
    const sourceNode = context.createBufferSource()
    const gain = context.createGain()
    sourceNode.buffer = buffer
    sourceNode.connect(gain).connect(context.destination)
    const now = context.currentTime
    gain.gain.setValueAtTime(fadeIn ? 0.0001 : 1, now)
    if (fadeIn) gain.gain.linearRampToValueAtTime(1, now + 0.012)
    const transport: ActiveTransport = { id, source: sourceNode, gain, offset, startedAt: now }
    transportRef.current = transport
    sourceNode.onended = () => {
      if (transportRef.current?.source !== sourceNode) return
      transportRef.current = null
      setIsPlaying(false)
      setPosition(buffer.duration)
    }
    sourceNode.start(now, offset)
    return true
  }

  // Decode each file once. Unlike swapping HTMLAudioElement src values, AudioBuffers are
  // resident in the Web Audio graph and can be crossfaded at the exact same audio clock time.
  useEffect(() => {
    const context = new AudioContext()
    contextRef.current = context
    let cancelled = false
    setReady(false); setLoadError(''); setPosition(0); setDuration(0); setIsPlaying(false)
    void Promise.all(all.map(async track => {
      const response = await fetch(track.url)
      if (!response.ok) throw new Error(`Could not load ${track.label}.`)
      return [track.id, await context.decodeAudioData(await response.arrayBuffer())] as const
    })).then(entries => {
      if (cancelled) return
      buffersRef.current = new Map(entries)
      setDuration(entries.find(([id]) => id === activeIdRef.current)?.[1].duration ?? entries[0]?.[1].duration ?? 0)
      setReady(true)
    }).catch(error => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not prepare audio for seamless comparison.')
    })
    return () => {
      cancelled = true
      stopTransport()
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      void context.close()
      if (contextRef.current === context) contextRef.current = null
    }
    // The URL signature is deliberate: tracks are recreated on render but only a new listening set reloads buffers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey])

  useEffect(() => {
    if (!isPlaying) { if (frameRef.current) cancelAnimationFrame(frameRef.current); return }
    const update = () => { setPosition(getPosition()); frameRef.current = requestAnimationFrame(update) }
    frameRef.current = requestAnimationFrame(update)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  })

  async function playOrPause() {
    const context = contextRef.current
    if (!context || !ready) return
    await context.resume()
    if (isPlaying) {
      const currentPosition = getPosition()
      stopTransport()
      setPosition(currentPosition); setIsPlaying(false)
      return
    }
    if (beginPlayback(activeId, position, true)) setIsPlaying(true)
  }

  async function switchVersion(nextId: string) {
    if (nextId === activeId) return
    const nextBuffer = buffersRef.current.get(nextId)
    const currentPosition = getPosition()
    const shouldContinue = isPlaying
    if (shouldContinue) {
      await contextRef.current?.resume()
      stopTransport(true)
      if (beginPlayback(nextId, currentPosition, true)) setIsPlaying(true)
    }
    setActiveId(nextId)
    setDuration(nextBuffer?.duration ?? 0)
    setPosition(Math.min(currentPosition, nextBuffer?.duration ?? currentPosition))
  }

  async function seek(value: number) {
    const currentPosition = Math.max(0, value)
    if (isPlaying) {
      stopTransport()
      await contextRef.current?.resume()
      if (beginPlayback(activeId, currentPosition, true)) setIsPlaying(true)
    }
    setPosition(currentPosition)
  }

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00'
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
  }

  return <section className="mt-7 rounded-xl border border-green-200 bg-white p-5 shadow-sm sm:p-7">
    <Step number="3" title="Listen and compare" />
    <p className="-mt-2 mb-5 text-sm text-slate-600">All versions share one transport. Switching versions crossfades at the same listening position.</p>
    <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <button onClick={playOrPause} disabled={!ready} aria-label={isPlaying ? 'Pause' : 'Play'} className="grid size-12 shrink-0 place-items-center rounded-full bg-green-700 text-white hover:bg-green-800 disabled:cursor-wait disabled:bg-green-300">{isPlaying ? <Pause className="size-5" /> : ready ? <Play className="ml-0.5 size-5" /> : <LoaderCircle className="size-5 animate-spin" />}</button>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-green-950">{all.find(item => item.id === activeId)?.label ?? all[0].label}</p><p className="text-xs text-green-800">{ready ? 'Shared listening position' : 'Preparing seamless playback…'}</p></div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-green-900">{formatTime(position)} / {formatTime(duration)}</span>
      </div>
      <input aria-label="Playback position" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(position, duration || 0)} onChange={event => void seek(Number(event.target.value))} disabled={!ready || !duration} className="mt-5 h-2 w-full cursor-pointer accent-green-700 disabled:cursor-not-allowed" />
    </div>
    {loadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{all.map(item => <button key={item.id} disabled={!ready} onClick={() => void switchVersion(item.id)} aria-pressed={activeId === item.id} className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${activeId === item.id ? 'border-green-700 bg-green-100 text-green-950' : 'border-slate-200 bg-white text-slate-800 hover:border-green-400 hover:bg-green-50'}`}><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${activeId === item.id ? 'bg-green-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{activeId === item.id ? <Check className="size-4" /> : item.id === 'reference' ? 'R' : (item.codec?.toUpperCase().slice(0, 1) ?? 'V')}</span><span className="font-medium">{item.label}</span></button>)}</div>
    <div className="mt-7 border-t border-slate-200 pt-6"><h3 className="font-bold text-slate-900">Start a blind ABX test</h3><p className="mb-4 mt-1 text-sm text-slate-600">Choose two versions. X will randomly be one of them.</p><div className="flex flex-col gap-3 sm:flex-row"><select value={pair[0]} onChange={e => setPair([e.target.value, pair[1]])} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">{all.map(x => <option disabled={x.id === pair[1]} key={x.id} value={x.id}>{x.label}</option>)}</select><select value={pair[1]} onChange={e => setPair([pair[0], e.target.value])} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">{all.map(x => <option disabled={x.id === pair[0]} key={x.id} value={x.id}>{x.label}</option>)}</select><button onClick={() => onStart(...pair)} className="shrink-0 rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800">Begin test</button></div></div>
  </section>
}

type TestSource = { id: string; label: string; url: string }
function AbxTest({ sources, onClose }: { sources: TestSource[]; onClose: () => void }) {
  const rounds = 10
  const assignments = useMemo(() => Array.from({ length: rounds }, () => Math.random() < .5 ? 0 : 1), [])
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [answer, setAnswer] = useState<number | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const contextRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef(new Map<string, AudioBuffer>())
  const transportRef = useRef<ActiveTransport | null>(null)
  const sourceKey = sources.map(source => `${source.id}:${source.url}`).join('|')

  function position() {
    const transport = transportRef.current
    const context = contextRef.current
    if (!transport || !context) return 0
    return Math.min(transport.offset + context.currentTime - transport.startedAt, buffersRef.current.get(transport.id)?.duration ?? Infinity)
  }

  function stop(fadeOut = false) {
    const transport = transportRef.current
    const context = contextRef.current
    if (!transport || !context) return
    const now = context.currentTime
    transport.gain.gain.cancelScheduledValues(now)
    if (fadeOut) {
      transport.gain.gain.setValueAtTime(Math.max(transport.gain.gain.value, 0.0001), now)
      transport.gain.gain.linearRampToValueAtTime(0.0001, now + 0.012)
      transport.source.stop(now + 0.015)
    } else transport.source.stop()
    transportRef.current = null
  }

  function start(id: string, offset: number, fadeIn = false) {
    const context = contextRef.current
    const buffer = buffersRef.current.get(id)
    if (!context || !buffer) return false
    const sourceNode = context.createBufferSource()
    const gain = context.createGain()
    sourceNode.buffer = buffer
    sourceNode.connect(gain).connect(context.destination)
    const now = context.currentTime
    gain.gain.setValueAtTime(fadeIn ? 0.0001 : 1, now)
    if (fadeIn) gain.gain.linearRampToValueAtTime(1, now + 0.012)
    const transport: ActiveTransport = { id, source: sourceNode, gain, offset: Math.min(offset, Math.max(0, buffer.duration - 0.001)), startedAt: now }
    transportRef.current = transport
    sourceNode.onended = () => { if (transportRef.current?.source === sourceNode) { transportRef.current = null; setPlaying(null) } }
    sourceNode.start(now, transport.offset)
    return true
  }

  useEffect(() => {
    const context = new AudioContext()
    contextRef.current = context
    let cancelled = false
    setReady(false); setLoadError('')
    void Promise.all(sources.map(async source => {
      const response = await fetch(source.url)
      if (!response.ok) throw new Error(`Could not load ${source.label}.`)
      return [source.id, await context.decodeAudioData(await response.arrayBuffer())] as const
    })).then(entries => {
      if (!cancelled) { buffersRef.current = new Map(entries); setReady(true) }
    }).catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not prepare blind-test audio.') })
    return () => { cancelled = true; stop(); void context.close(); if (contextRef.current === context) contextRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  async function play(key: 'A' | 'B' | 'X') {
    if (!ready) return
    const index = key === 'A' ? 0 : key === 'B' ? 1 : assignments[round]
    const id = sources[index].id
    const previous = transportRef.current
    // Selecting the active source acts as play/pause. Switching preserves the exact audio-clock position.
    if (previous?.id === id) {
      const currentPosition = position()
      stop(); setPlaying(null)
      return currentPosition
    }
    const currentPosition = position()
    await contextRef.current?.resume()
    if (previous) stop(true)
    if (start(id, currentPosition, Boolean(previous))) setPlaying(key)
  }

  function submit(index: number) { setAnswer(index); if (index === assignments[round]) setCorrect(c => c + 1) }
  function nextRound() {
    stop(); setPlaying(null); setRound(value => value + 1); setAnswer(null)
  }
  const finished = round === rounds
  return <div className="fixed inset-0 z-10 grid place-items-center bg-green-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="abx-title"><section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
    {finished ? <div className="text-center"><Check className="mx-auto size-12 text-green-700" /><h2 id="abx-title" className="mt-3 text-2xl font-bold">Test complete</h2><p className="mt-2 text-lg">You identified <strong>{correct} of {rounds}</strong> trials.</p><p className="mt-2 text-sm text-slate-600">Chance averages 5/10. Repeat the test before drawing conclusions.</p><button onClick={onClose} className="mt-6 rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white">Done</button></div> : <><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-green-700">Trial {round + 1} of {rounds}</p><h2 id="abx-title" className="text-2xl font-bold text-green-950">Which source is X?</h2></div><button onClick={onClose} className="text-sm text-slate-500">Close</button></div><p className="mt-3 text-sm text-slate-600">A, B, and X use the same seamless transport. Switch freely without losing your listening position.</p>{loadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}<div className="mt-6 grid grid-cols-3 gap-3">{(['A', 'B', 'X'] as const).map(key => <button disabled={!ready} key={key} onClick={() => void play(key)} className={`rounded-xl border-2 py-7 text-2xl font-bold disabled:cursor-wait disabled:opacity-60 ${playing === key ? 'border-green-700 bg-green-100 text-green-900' : 'border-slate-200 hover:border-green-400'}`}>{!ready ? <LoaderCircle className="mx-auto size-6 animate-spin" /> : playing === key ? <Pause className="mx-auto size-7" /> : key}</button>)}</div><div className="mt-6 grid grid-cols-2 gap-3"><button disabled={answer !== null || !ready} onClick={() => submit(0)} className="rounded-lg border border-green-700 py-3 font-semibold text-green-800 disabled:opacity-50">X is A</button><button disabled={answer !== null || !ready} onClick={() => submit(1)} className="rounded-lg border border-green-700 py-3 font-semibold text-green-800 disabled:opacity-50">X is B</button></div>{answer !== null && <div className={`mt-4 rounded-lg p-4 text-sm font-medium ${answer === assignments[round] ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{answer === assignments[round] ? 'Correct.' : `Not this time — X was ${assignments[round] === 0 ? 'A' : 'B'}.`}<button onClick={nextRound} className="float-right font-bold underline">{round + 1 === rounds ? 'See results' : 'Next trial'}</button></div>}</>}
  </section></div>
}

export default App
