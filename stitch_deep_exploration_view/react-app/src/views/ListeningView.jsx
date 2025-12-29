import { useEffect, useMemo, useRef, useState } from 'react'
import { useApiData } from '../hooks/useApiData.jsx'

const fallbackFeed = [
  {
    time: '12:45',
    label: 'Biochemistry',
    title: 'Adenosine Buildup',
    body: 'Adenosine accumulates during waking hours, creating sleep pressure that signals the need for rest.',
    status: 'past',
    source: 'NIH Review 2023',
  },
  {
    time: '14:02',
    label: 'Current Topic',
    title: 'Circadian Rhythm Entrainment',
    body: 'View sunlight within 30-60 minutes of waking to anchor your cortisol rhythm and signal melatonin ~12-14 hours later.',
    status: 'active',
    source: 'Podcast Segment',
  },
  {
    time: '16:10',
    label: 'Coming Up',
    title: 'Sleep Drive Mechanics',
    body: 'How adenosine and caffeine compete for the same homeostatic control pathways.',
    status: 'future',
  },
]

const upcomingPrompts = [
  'What is the homeostatic set point for sleep pressure?',
  'Show me the adenosine vs cortisol overlay.',
  'How do we measure gamma spikes alongside sleep inertia?',
]

const generateWaveform = () =>
  Array.from({ length: 20 }, (_, index) => {
    const variance = Math.sin(index * 0.65)
    const height = 20 + Math.abs(variance) * 65 + Math.random() * 6
    return height
  })

export default function ListeningView() {
  const { data, loading, error } = useApiData('listening')
  const feedItems = data?.feed ?? fallbackFeed
  const activeItem = feedItems.find((item) => item.status === 'active') ?? fallbackFeed[1]
  const description = data?.summary ?? 'Pulling the latest notes from the session.'
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const waveform = useMemo(() => generateWaveform(), [])
  const [progress, setProgress] = useState(35)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    const updateProgress = () => {
      if (!audio.duration) {
        return
      }
      setProgress((audio.currentTime / audio.duration) * 100)
    }
    audio.addEventListener('timeupdate', updateProgress)
    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
    }
  }, [audioRef])

  const togglePlay = () => {
    if (!audioRef.current) {
      return
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex-none z-50 border-b border-white/10 bg-[#030605]/70 text-white">
        <div className="mx-auto flex max-w-5xl flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-3">
            <div className="flex items-center gap-4">
              <button className="text-white/70 transition hover:text-primary">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-cover bg-center" />
                <h1 className="text-sm font-semibold uppercase tracking-[0.4em] text-neutral-300">
                  NeuroCast
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/70">
              <button className="p-2 rounded-full hover:bg-white/10 transition">
                <span className="material-symbols-outlined text-xl">bookmark_border</span>
              </button>
              <button className="p-2 rounded-full hover:bg-white/10 transition">
                <span className="material-symbols-outlined text-xl">share</span>
              </button>
              <button className="p-2 rounded-full hover:bg-white/10 transition">
                <span className="material-symbols-outlined text-xl">settings</span>
              </button>
            </div>
          </div>
          <div className="px-6 py-5 flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-5">
              <button
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[#04200f] shadow-[0_0_15px_rgba(43,238,108,0.3)] transition hover:scale-105"
                type="button"
                onClick={togglePlay}
              >
                <span className="material-symbols-outlined text-3xl">
                  {playing ? 'pause' : 'play_arrow'}
                </span>
              </button>
              <div>
                <h2 className="text-lg font-bold text-white truncate">{data?.title ?? 'Ep. 42: The Neurobiology of Sleep'}</h2>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="font-medium">Andrew Huberman</span>
                  <span className="h-1 w-1 rounded-full bg-white/40" />
                  <span>Science &amp; Medicine</span>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="relative h-8 w-full rounded-full bg-white/10">
                <div className="absolute inset-0 flex items-center justify-center gap-1">
                  {waveform.map((height, index) => (
                    <span
                      key={`wave-${index}`}
                      className="h-full w-1 rounded-full bg-gradient-to-b from-primary to-[#0ee979]"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="relative flex h-4 items-center">
                <div className="absolute inset-0 h-1 rounded-full bg-white/20" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-[#1afc73]"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute left-[35%] h-3 w-3 rounded-full border border-white bg-primary shadow-[0_0_12px_rgba(43,238,108,0.6)]"
                  aria-hidden
                />
              </div>
              <div className="flex justify-between text-xs font-mono uppercase tracking-[0.3em] text-white/60">
                <span className="text-primary">14:02</span>
                <span>56:00</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative w-full">
        <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-8">
          <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#020905]/80 px-4 py-3 text-xs uppercase tracking-[0.5em] text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              Contextual Feed
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-neutral-400">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Syncing to Audio
            </div>
          </div>

          <section className="space-y-6">
            {feedItems.map((item) => {
              const containerClass =
                item.status === 'active'
                  ? 'border-primary/40 bg-[#101a14]'
                  : item.status === 'future'
                    ? 'border-dashed border-white/20 bg-white/5 text-white/70'
                    : 'bg-white/5 opacity-80'
              return (
                <div
                  key={item.time}
                  className={`flex gap-4 rounded-2xl border px-4 py-4 text-sm text-neutral-300 shadow-sm transition ${containerClass}`}
                >
                  <div className="flex flex-col items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-neutral-400">
                    <span>{item.time}</span>
                    <div className="h-full w-px rounded-full bg-gradient-to-b from-primary to-transparent" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.4em] text-neutral-400">
                      <span>{item.label}</span>
                      {item.status === 'active' && (
                        <span className="rounded-full border border-primary/30 px-3 py-1 text-[10px] text-primary">
                          Current Topic
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="text-neutral-400">{item.body}</p>
                    {item.source && (
                      <p className="text-[11px] uppercase tracking-[0.4em] text-primary/70">{item.source}</p>
                    )}
                    <div className="flex gap-2 pt-4 text-[11px] uppercase tracking-[0.4em] text-neutral-400">
                      <button className="flex items-center gap-1 text-primary hover:text-white">
                        <span className="material-symbols-outlined text-base">search</span>
                        Dive deeper
                      </button>
                      {item.status === 'active' && (
                        <button className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">article</span>
                          View source
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </main>

      <footer className="flex-none p-4 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="group relative rounded-2xl border border-white/10 bg-[#020d09]/80 px-4 py-3 shadow-xl transition focus-within:border-primary">
            <div className="absolute inset-0 transform rounded-2xl bg-primary/10 blur-2xl opacity-0 transition group-focus-within:opacity-100" />
            <div className="relative flex items-center gap-3">
              <button className="text-neutral-400 transition hover:text-white">
                <span className="material-symbols-outlined">cut</span>
              </button>
              <input
                className="flex-1 bg-transparent border-none text-sm font-medium text-white placeholder:text-neutral-500 focus:outline-none"
                placeholder='Ask AI about this segment...'
                type="text"
              />
              <div className="flex items-center gap-2 text-neutral-400">
                <button className="p-2 rounded-full bg-white/10 transition hover:bg-primary">
                  <span className="material-symbols-outlined">mic</span>
                </button>
                <button className="rounded-full border border-primary bg-primary px-3 py-2 text-sm font-semibold text-[#0f2c19] shadow-[0_0_15px_rgba(43,238,108,0.4)] transition hover:bg-white hover:text-primary">
                  <span className="material-symbols-outlined">arrow_upward</span>
                </button>
              </div>
            </div>
            <p className="absolute -top-8 left-0 w-full text-center text-xs uppercase tracking-[0.4em] text-neutral-500 opacity-0 transition group-focus-within:opacity-100">
              Context: "{activeItem?.title}" ({activeItem?.time})
            </p>
          </div>
        </div>
      </footer>

      <audio
        ref={audioRef}
        src={data?.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="metadata"
      />
    </div>
  )
}

