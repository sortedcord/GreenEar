import { Check, LoaderCircle, Pause } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActiveTransport } from '../types'

import type { TestSource } from '../types'
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
  return <div className="abx-backdrop" role="dialog" aria-modal="true" aria-labelledby="abx-title"><section className="abx-dialog">
    {finished ? <div className="text-center"><Check className="mx-auto size-12 text-green-700" /><h2 id="abx-title" className="mt-3 text-2xl font-bold">The verdict is in</h2><p className="mt-2 text-lg">You got <strong>{correct} of {rounds}</strong>. {correct <= 6 ? 'A coin could do that.' : 'Okay, not bad.'}</p><p className="mt-2 text-sm text-slate-600">{correct <= 5 ? 'Maybe reconsider that 2 TB FLAC collection.' : correct <= 7 ? 'Suspicious, but not conclusive. Try again.' : 'Fine. You might actually hear it. Or you got lucky.'}</p><button onClick={onClose} className="mt-6 rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white">Cope & close</button></div> : <><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-green-700">Trial {round + 1} of {rounds}</p><h2 id="abx-title" className="text-2xl font-bold text-green-950">Which one is X, golden ears?</h2></div><button onClick={onClose} className="text-sm text-slate-500">Close</button></div><p className="mt-3 text-sm text-slate-600">Same transport, no cheating. Switch as much as you want — it won't help.</p>{loadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}<div className="mt-6 grid grid-cols-3 gap-3">{(['A', 'B', 'X'] as const).map(key => <button disabled={!ready} key={key} onClick={() => void play(key)} className={`rounded-xl border-2 py-7 text-2xl font-bold disabled:cursor-wait disabled:opacity-60 ${playing === key ? 'border-green-700 bg-green-100 text-green-900' : 'border-slate-200 hover:border-green-400'}`}>{!ready ? <LoaderCircle className="mx-auto size-6 animate-spin" /> : playing === key ? <Pause className="mx-auto size-7" /> : key}</button>)}</div><div className="mt-6 grid grid-cols-2 gap-3"><button disabled={answer !== null || !ready} onClick={() => submit(0)} className="rounded-lg border border-green-700 py-3 font-semibold text-green-800 disabled:opacity-50">X is A</button><button disabled={answer !== null || !ready} onClick={() => submit(1)} className="rounded-lg border border-green-700 py-3 font-semibold text-green-800 disabled:opacity-50">X is B</button></div>{answer !== null && <div className={`mt-4 rounded-lg p-4 text-sm font-medium ${answer === assignments[round] ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{answer === assignments[round] ? 'Lucky guess. Or is it?' : `Nope. X was ${assignments[round] === 0 ? 'A' : 'B'}. Your ears lied to you.`}<button onClick={nextRound} className="float-right font-bold underline">{round + 1 === rounds ? 'See results' : 'Next trial'}</button></div>}</>}
  </section></div>
}

export { AbxTest }
