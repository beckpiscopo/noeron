
import { useMemo } from 'react'
import { useApiData } from '../hooks/useApiData.jsx'

const defaultPaper = {
  title: 'Neural Correlates of Auditory Perception',
  authors: 'Dr. A. Smith, Dr. J. Doe, et al.',
  journal: 'Nature Neuroscience • Vol 24 • Oct 2023',
  summary:
    'This study explores the relationship between neural firing patterns and auditory stimuli processing in chaotic environments.',
  sections: [
    'Abstract',
    '1. Introduction',
    '2. Methodology',
    '3. Results',
    '4. Conclusion',
  ],
  highlight: {
    label: 'Mentioned in Podcast (14:20)',
    title: 'Gamma Wave Spikes',
    body:
      'We saw a gamma burst 200ms before recognition, which hints at predictive coding shaping auditory perception.',
  },
  stats: { citations: 245, impact: 4.8 },
  paperUrl: '#',
}

const tocEntries = ['Abstract', '1. Introduction', '2. Methodology', '3. Results', '4. Conclusion']
const relatedHighlights = ['Neural Spikes & Attention', 'Auditory Segmentation', 'Predictive Coding']

export default function PaperViewer() {
  const { data } = useApiData('papers')
  const paper = useMemo(() => data?.paper ?? defaultPaper, [data])

  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-neutral-400">Paper viewer</p>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-bold text-white">{paper.title}</h1>
          <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.4em] text-neutral-400">
            Now viewing
          </div>
        </div>
        <p className="text-base text-neutral-300 max-w-3xl">
          {paper.summary} • {paper.journal}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[3fr_1.2fr]">
        <article className="space-y-10 rounded-[32px] bg-[#0f170f] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
          <div className="space-y-4 border-b border-white/5 pb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-primary">
                Neuroscience
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-neutral-400">
                Original Research
              </div>
            </div>
            <p className="text-sm text-neutral-400">{paper.authors}</p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/5 bg-[#182119] p-6">
              <h2 className="text-xl font-semibold text-white">Abstract</h2>
              <p className="mt-2 text-neutral-300">
                {paper.summary}
              </p>
            </div>
            <div className="space-y-6 text-neutral-300">
              <p>
                The human auditory system possesses a remarkable ability to isolate specific sound sources within complex acoustic scenes—what makes a signal pop out from the noise?
              </p>
              <p>
                Previous work implicates temporal modulation of the superior temporal gyrus. This paper charts how temporal coherence enables stream segregation while retaining top-down attention mechanisms.
              </p>
            </div>

            <div className="relative rounded-2xl border border-primary/40 bg-[#102016] p-6 shadow-lg">
              <div className="absolute -left-1 top-5 bg-primary text-[#0f2c19] px-3 py-1 text-[10px] uppercase tracking-[0.4em] font-bold">
                {paper.highlight.label}
              </div>
              <h3 className="text-xl font-semibold text-white mt-6">
                {paper.highlight.title}
              </h3>
              <p className="mt-3 text-neutral-300">{paper.highlight.body}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.4em] text-neutral-400">
                <button className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-2 text-white transition hover:bg-primary hover:text-[#0f2c19]">
                  <span className="material-symbols-outlined text-base">play_circle</span>
                  Play Segment
                </button>
                <button className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-neutral-300 transition hover:border-primary hover:text-white">
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  Copy Text
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#111814] p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Figure 1 – Gamma burst view</h3>
                <span className="text-[11px] uppercase tracking-[0.4em] text-neutral-400">Visualization</span>
              </div>
              <div className="mt-4 flex h-48 items-end justify-between gap-3">
                {[20, 35, 25, 45, 80, 60, 30, 20].map((value, index) => (
                  <span
                    key={value + index}
                    className="w-3 rounded-t-full bg-gradient-to-t from-primary to-emerald-400"
                    style={{ height: `${value}%` }}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.4em] text-neutral-500">
                Fig 1. Gamma oscillation amplitude during target recognition.
              </p>
            </div>
          </div>
        </article>

        <aside className="space-y-6">
          <div className="sticky top-10 space-y-4 rounded-[32px] border border-[#142018] bg-[#0b120c]/80 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">podcasts</span>
                <p className="text-sm uppercase tracking-[0.4em] text-neutral-400">Now viewing context</p>
              </div>
              <span className="text-[11px] uppercase tracking-[0.4em] text-neutral-500">14:20</span>
            </div>
            <h3 className="text-xl font-semibold text-white">Neural Spikes & Attention</h3>
            <p className="text-sm text-neutral-400">
              Discussion on the "Gamma Wave Spike" in the methodology section: how prediction shapes hearing.
            </p>
            <div className="rounded-2xl border border-[#1f2e26] bg-[#101b13] p-4">
              <div className="flex items-center gap-3">
                <button className="size-12 rounded-full bg-primary text-[#0f2c19]">
                  <span className="material-symbols-outlined text-xl">play_arrow</span>
                </button>
                <div className="flex-1">
                  <div className="h-1 rounded-full bg-white/5">
                    <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary to-[#1afc73]" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400">
                    <span>14:20</span>
                    <span>18:45</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#142018] bg-[#0e180d] p-6">
            <h4 className="text-xs uppercase tracking-[0.4em] text-neutral-400 pb-3">Table of contents</h4>
            <nav className="space-y-2">
              {tocEntries.map((entry, index) => (
                <button
                  key={entry}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
                    index === 2
                      ? 'bg-gradient-to-r from-[#162d20] to-[#0b170d] border border-primary text-white'
                      : 'border border-white/10 text-neutral-400 hover:border-primary hover:text-white'
                  }`}
                >
                  {entry}
                  <span className="material-symbols-outlined text-base text-primary">arrow_forward</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-[32px] border border-[#142018] bg-[#0c150e] p-4 text-center text-white">
            <div className="space-y-1 rounded-2xl border border-white/5 px-3 py-4">
              <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Citations</p>
              <p className="text-2xl font-semibold">{paper.stats.citations}</p>
            </div>
            <div className="space-y-1 rounded-2xl border border-white/5 px-3 py-4">
              <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Impact</p>
              <p className="text-2xl font-semibold">{paper.stats.impact}</p>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#142018] bg-[#0c150b] p-6 space-y-3">
            <h4 className="text-xs uppercase tracking-[0.4em] text-neutral-400">Related contexts</h4>
            <div className="flex flex-col gap-3">
              {relatedHighlights.map((highlight) => (
                <button
                  key={highlight}
                  type="button"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#151e15]/60 px-4 py-3 text-sm text-white transition hover:border-primary hover:text-primary"
                >
                  {highlight}
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              ))}
            </div>
            <a
              href={paper.paperUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary px-3 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-primary transition hover:bg-primary hover:text-[#0f2c19]"
            >
              View source paper
            </a>
          </div>
        </aside>
      </div>
    </section>
  )
}

