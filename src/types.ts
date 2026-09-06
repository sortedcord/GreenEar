export type Variant = { id: string; codec: string; bitrate: number; label: string; url: string }
export type Source = { sessionId: string; name: string; referenceUrl: string }
export type Choice = { codec: 'mp3' | 'aac' | 'opus' | 'ogg'; bitrate: number; label?: string }
export type PresetId = 'youtube' | 'youtubeMusic' | 'spotify'
export type Progress = { kind: 'upload' | 'transcode'; value: number; fileName?: string }
export type TranscodeJob = { progress: number; status: 'processing' | 'complete' | 'failed'; variants?: Variant[]; error?: string }
export type TestSource = { id: string; label: string; url: string }
export type ActiveTransport = { id: string; source: AudioBufferSourceNode; gain: GainNode; offset: number; startedAt: number }
