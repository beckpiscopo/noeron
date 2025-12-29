import { useMemo } from 'react'
import { useApiData } from '../hooks/useApiData.jsx'

const defaultAnchor = {
  title: 'Mitochondrial efficiency drops by 40% in high-sugar environments.',
  speaker: 'Dr. David Sinclair',
  description:
    'High sugar exposure propels ROS, uncoupling electron transport chain efficiency and dropping ATP production.',
  status: 'Triggered at 14:20',
}

const timelineDefaults = [
  {
    label: 'Synthesis',
    content:
      'The Electron Transport Chain (Complexes I and III) decouples when ROS saturates the inner membrane.',
  },
  {
    label: 'Mechanical insight',
    content:
      'Hyperglycemic spikes cause proton leak, which robs the mitochondria of electrochemical potential.',
  },
  {
    label: 'Experiment',
    content:
      'Meta-analysis shows stability up to 120mg/dL glucose, then a cascade into inefficiency.',
  },
]

const conceptCards = [
  { title: 'Krebs Cycle', description: 'The sequence most cells use to extract energy.' },
  { title: 'Reactive Oxygen Species', description: 'Highly reactive molecules forming under stress.' },
  { title: 'Electron Transport Chain', description: 'Protein complexes coupling redox reactions.' },
]

const evidenceThreads = [
  {
    label: 'Primary Source',
    title: 'Brownlee et al., Nature (2001)',
    description: 'Hyperglycemia relates to superoxide overproduction.',
  },
  {
    label: 'Replication',
    title: 'Ceriello et al. (2018)',
    description: 'Replicated ROS accumulation in endothelial cells.',
  },
  {
    label: 'Counter-Evidence',
    title: 'Smith & Jones (2020)',
    description: 'Proposed alternative ROS-independent pathway.',
  },
]

export default function DeepDiveView() {
  const { data, loading, error } = useApiData('deep-dive')
  const anchor = useMemo(() => data?.anchor ?? defaultAnchor, [data])
  const timeline = useMemo(() => data?.timeline ?? timelineDefaults, [data])
  const notes = data?.notes ?? ['Exploring molecular levers', 'Tracing evidence threads', 'Linking to audio narratives']

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-neutral-400">Deep dive</p>
        <h1 className="text-4xl font-bold text-white">From intuition to analysis</h1>
        <p className="text-base text-neutral-300 max-w-3xl">
          {data?.brief ?? 'Layer structured context on top of the listening experience.'}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[32px] border border-[#28392e] bg-gradient-to-br from-[#111913] to-[#0c130d] px-6 py-8 shadow-[0_30px_45px_rgba(0,0,0,0.6)]">
            <div className="absolute inset-0 opacity-20">
              <span className="material-symbols-outlined text-[160px] text-white">format_quote</span>
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="rounded-full border border-primary/30 px-3 py-1 text-[11px] uppercase tracking-[0.4em] text-primary">
                  Anchor Claim
                </div>
                <span className="text-[11px] font-mono uppercase tracking-[0.4em] text-neutral-400">
                  {anchor.status}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white leading-tight">{anchor.title}</h2>
              <div className="flex items-center gap-3 text-sm text-neutral-400">
                <div className="h-8 w-8 rounded-full bg-cover bg-center border border-white/20" />
                <p>
                  {anchor.speaker} • <span className="text-neutral-500">Host</span>
                </p>
              </div>
              <p className="text-neutral-300">{anchor.description}</p>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#1f2e26] bg-[#0c190f]/70 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                Synthesis
              </h3>
              <div className="flex items-center gap-2 rounded-full bg-[#1b2a20] px-3 py-1 text-[12px] uppercase tracking-[0.4em] text-neutral-500">
                <label className="cursor-pointer">
                  <input className="sr-only peer" type="radio" defaultChecked />
                  <span className="inline-block px-3 py-1 text-white peer-checked:text-primary">Technical</span>
                </label>
                <span className="text-white/40">Simplified</span>
                <span className="text-white/40">Raw</span>
              </div>
            </div>
            <div className="space-y-4 text-sm text-neutral-300">
              {timeline.map((entry) => (
                <div key={entry.label} className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-primary">{entry.label}</p>
                  <p>{entry.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-[32px] border border-[#1c2c21] bg-[#0b120c] p-6 shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
            <h4 className="text-xs uppercase tracking-[0.4em] text-neutral-500">Deepen your understanding</h4>
            <div className="flex flex-wrap gap-3">
              {['What is Complex I inhibition?', 'Show glucose vs efficiency graph', 'Are there mitigating compounds?'].map(
                (prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-[#1f3528] bg-[#14281c] px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:border-primary hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-sm">help</span>
                    {prompt}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-[#1d2f21] bg-[#0d1b14]/80 p-6 shadow-[0_20px_25px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Related Concepts</h4>
              <div className="flex gap-2">
                <button className="size-10 rounded-full border border-white/10 text-white/60 hover:text-white">←</button>
                <button className="size-10 rounded-full border border-white/10 text-white/60 hover:text-white">→</button>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
              {conceptCards.map((concept) => (
                <div
                  key={concept.title}
                  className="min-w-[200px] rounded-2xl border border-[#1c2a20] bg-gradient-to-br from-[#121c16] to-[#0f150f] p-4 shadow-xl"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-lg">science</span>
                  </div>
                  <h5 className="text-white text-base font-semibold">{concept.title}</h5>
                  <p className="text-xs text-neutral-500">{concept.description}</p>
                </div>
              ))}
              <div className="min-w-[200px] rounded-2xl border border-dashed border-primary/40 bg-[#09110a] p-4 text-center text-xs uppercase tracking-[0.4em] text-primary">
                Explore all
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[32px] border border-[#1f2f23] bg-[#111b14]/80 p-6 shadow-[0_25px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">account_tree</span>
              <h4 className="text-lg font-semibold text-white">Evidence Threads</h4>
            </div>
            <div className="mt-4 space-y-4 border-l border-[#1f2f23] pl-4 text-sm text-neutral-300">
              {evidenceThreads.map((thread) => (
                <div key={thread.title} className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-primary">{thread.label}</p>
                  <p className="text-white font-semibold">{thread.title}</p>
                  <p className="text-[12px] text-neutral-500">{thread.description}</p>
                </div>
              ))}
            </div>
            <button className="mt-6 w-full rounded-full border border-[#1f2f23] bg-[#182921] px-4 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-neutral-400 transition hover:border-primary hover:text-primary">
              View full citation map
            </button>
          </div>

          <div className="rounded-[32px] border border-[#1f2f23] bg-[#111c16] p-6 shadow-[0_20px_30px_rgba(0,0,0,0.45)]">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-2xl bg-white/10 text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">article</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-neutral-400">Source Material</p>
                <p className="text-white text-lg font-semibold">Original PDF cited</p>
              </div>
            </div>
            <button className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-[#0f2c19] shadow-[0_10px_25px_rgba(43,238,108,0.35)] transition hover:bg-[#1afc73]">
              View source paper
            </button>
            <div className="mt-5 grid grid-cols-2 gap-3 text-center text-white">
              <div className="rounded-2xl border border-[#1f2f23] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Confidence</p>
                <p className="text-lg font-semibold flex items-center justify-center gap-2">
                  High
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </p>
              </div>
              <div className="rounded-2xl border border-[#1f2f23] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Consensus</p>
                <p className="text-lg font-semibold">85%</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#1f2f23] bg-[#0a120a] p-6 shadow-[0_15px_25px_rgba(0,0,0,0.4)]">
            <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">Notes</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-300">
              {notes.map((note) => (
                <li key={note} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  )
}

