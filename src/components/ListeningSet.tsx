import { Check, LoaderCircle, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Step } from './Step'
import type { ActiveTransport, Source, Variant } from '../types'

type ListenTrack = { id: string; label: string; url: string; codec?: string }
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

  return <section className="listening-section module">
    <div className="module-meta light"><span>Moment of truth</span><span>Step 03</span></div>
    <Step number="03" title="Okay hotshot, listen" />
    <p className="-mt-2 mb-5 text-sm text-slate-600">Same position, seamless crossfade. No excuses about "the track wasn't at the right part."</p>
    <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <button onClick={playOrPause} disabled={!ready} aria-label={isPlaying ? 'Pause' : 'Play'} className="grid size-12 shrink-0 place-items-center rounded-full bg-green-700 text-white hover:bg-green-800 disabled:cursor-wait disabled:bg-green-300">{isPlaying ? <Pause className="size-5" /> : ready ? <Play className="ml-0.5 size-5" /> : <LoaderCircle className="size-5 animate-spin" />}</button>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-green-950">{all.find(item => item.id === activeId)?.label ?? all[0].label}</p><p className="text-xs text-green-800">{ready ? 'Synced — switch and cope' : 'Loading your copium…'}</p></div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-green-900">{formatTime(position)} / {formatTime(duration)}</span>
      </div>
      <input aria-label="Playback position" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(position, duration || 0)} onChange={event => void seek(Number(event.target.value))} disabled={!ready || !duration} className="mt-5 h-2 w-full cursor-pointer accent-green-700 disabled:cursor-not-allowed" />
    </div>
    {loadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{all.map(item => <button key={item.id} disabled={!ready} onClick={() => void switchVersion(item.id)} aria-pressed={activeId === item.id} className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${activeId === item.id ? 'border-green-700 bg-green-100 text-green-950' : 'border-slate-200 bg-white text-slate-800 hover:border-green-400 hover:bg-green-50'}`}><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${activeId === item.id ? 'bg-green-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{activeId === item.id ? <Check className="size-4" /> : item.id === 'reference' ? 'R' : (item.codec?.toUpperCase().slice(0, 1) ?? 'V')}</span><span className="font-medium">{item.label}</span></button>)}</div>
    <div className="mt-7 border-t border-slate-200 pt-6"><h3 className="font-bold text-slate-900">Put your money where your ears are</h3><p className="mb-4 mt-1 text-sm text-slate-600">Pick two versions. X is one of them. No peeking, no excuses.</p><div className="flex flex-col gap-3 sm:flex-row"><select value={pair[0]} onChange={e => setPair([e.target.value, pair[1]])} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">{all.map(x => <option disabled={x.id === pair[1]} key={x.id} value={x.id}>{x.label}</option>)}</select><select value={pair[1]} onChange={e => setPair([pair[0], e.target.value])} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">{all.map(x => <option disabled={x.id === pair[0]} key={x.id} value={x.id}>{x.label}</option>)}</select><button onClick={() => onStart(...pair)} className="shrink-0 rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800">Begin test</button></div></div>
  </section>
}


export { ListeningSet }
