export default function PodcastContextualFeed() {
  const feedItems = [
    {
      time: '12:45',
      headline: 'Adenosine Buildup',
      detail:
        'Adenosine accumulates in the brain during waking hours, creating "sleep pressure" that signals the need for rest.',
      badge: 'Biochemistry',
      source: 'Source: NIH Review 2023',
      past: true,
    },
    {
      time: '14:02',
      headline: 'Circadian Rhythm Entrainment',
      detail:
        'Viewing sunlight within 30-60 minutes of waking anchors the circadian clock by triggering cortisol release.',
      badge: 'Current Topic',
      active: true,
      source: 'Podcast Segment',
    },
    {
      time: '15:30',
      headline: 'Caffeine Half-life Dynamics',
      detail: 'Future topic previewed in the contextual feed.',
      badge: 'Coming Up',
    },
  ]

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-white h-screen flex flex-col overflow-hidden transition-colors duration-300">
      <header className="flex-none z-50 border-b border-gray-200 dark:border-white/10 glass-panel">
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200/50 dark:border-white/5">
            <div className="flex items-center gap-4">
              <button className="text-gray-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined filled">arrow_back</span>
              </button>
              <div className="flex items-center gap-3">
                <div
                  className="size-8 rounded-full bg-cover bg-center"
                  style={{
                    backgroundImage:
                      'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCA44Iu3f8ehc4i4LS2_l26Lrx_bRfxkSoYba8th4JWqaaTXPSBSngUbN_-ZeQ-swCTYNFYFs4avxdcozixHEwb0Xo7nHwNm4V-qx-U7HcYY1qoVbz7XRo9cEFH2M-FMkSzFPSHWZbezfcSLM--Pdrpz8yYKkJl3S4NxVM2rhAvzoGvH4zVW9uC3PpGgRhoq7NH25QJVsR7j-LYx5aBFKbzj6HPRYwk_2oKT5xSRhy0C0B94887UDR1SwwUGdNhxEbJPYZi8d356qg")',
                  }}
                />
                <h1 className="text-sm font-semibold tracking-wide uppercase text-gray-400">NeuroCast</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined filled text-gray-500 dark:text-gray-400 text-xl">bookmark_border</span>
              </button>
              <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined filled text-gray-500 dark:text-gray-400 text-xl">share</span>
              </button>
              <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined filled text-gray-500 dark:text-gray-400 text-xl">settings</span>
              </button>
            </div>
          </div>
          <div className="px-6 py-5 flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-5 flex-1 w-full md:w-auto">
              <button className="flex-none size-14 rounded-full bg-primary text-background-dark flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(43,238,108,0.3)]">
                <span className="material-symbols-outlined filled text-3xl">pause</span>
              </button>
              <div className="flex flex-col overflow-hidden">
                <h2 className="text-lg md:text-xl font-bold truncate leading-tight">Ep. 42: The Neurobiology of Sleep</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Andrew Huberman</span>
                  <span className="size-1 bg-gray-500 rounded-full"></span>
                  <span>Science &amp; Medicine</span>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full flex flex-col justify-center gap-2">
              <div className="relative h-8 w-full flex items-center gap-0.5 opacity-60 mask-image-gradient">
                <div className="h-3 w-1 bg-primary rounded-full"></div>
                <div className="h-5 w-1 bg-primary rounded-full"></div>
                <div className="h-4 w-1 bg-primary rounded-full"></div>
                <div className="h-6 w-1 bg-primary rounded-full"></div>
                <div className="h-8 w-1 bg-primary rounded-full"></div>
                <div className="h-5 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-3 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-4 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-2 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-4 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-3 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-5 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-4 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-6 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-2 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-5 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-3 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-4 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-2 w-1 bg-gray-600 rounded-full"></div>
                <div className="h-4 w-1 bg-gray-600 rounded-full"></div>
              </div>
              <div className="group relative flex items-center h-4 cursor-pointer">
                <div className="absolute w-full h-1 bg-gray-300 dark:bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[35%]"></div>
                </div>
                <div className="absolute left-[35%] size-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform"></div>
              </div>
              <div className="flex justify-between text-xs font-medium font-mono text-gray-500 dark:text-gray-400">
                <span className="text-primary">14:02</span>
                <span>56:00</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative w-full">
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-12 min-h-full">
          <div className="flex items-center justify-between sticky top-0 z-10 py-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-200 dark:border-white/5 mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined filled text-primary">auto_awesome</span>
              Contextual Feed
            </h3>
            <div className="flex items-center gap-2 text-xs font-medium bg-gray-200 dark:bg-white/10 px-3 py-1.5 rounded-full text-gray-600 dark:text-gray-300">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              Syncing to Audio
            </div>
          </div>
          {feedItems.map((item) => (
            <div
              key={item.time}
              className={`flex gap-4 ${item.past ? 'opacity-50 hover:opacity-80' : ''}`}
            >
              <div className="flex flex-col items-center gap-2 pt-1">
                <span className="text-xs font-mono text-gray-500">{item.time}</span>
                <div className="w-px h-full bg-gray-300 dark:bg-white/10"></div>
              </div>
              <div
                className={`flex-1 p-5 rounded-xl shadow-sm transition ${
                  item.active
                    ? 'bg-surface-light dark:bg-[#1E2923] border border-primary/20 shadow-[0_0_30px_rgba(43,238,108,0.05)]'
                    : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/5'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">{item.badge}</div>
                  <span className="material-symbols-outlined filled text-green-500 text-lg">check_circle</span>
                </div>
                <h4 className="text-lg font-bold mb-2">{item.headline}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{item.detail}</p>
                {item.source && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="size-6 rounded-full bg-cover bg-center" />
                    <span>{item.source}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="h-24"></div>
        </div>
      </main>
      <footer className="flex-none p-4 md:p-6 z-40">
        <div className="max-w-3xl mx-auto w-full">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative flex items-center bg-white dark:bg-[#1E2923] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all">
              <button className="pl-4 pr-3 py-4 text-gray-400 hover:text-primary transition-colors flex items-center gap-1 border-r border-gray-200 dark:border-white/5" title="Clip this segment">
                <span className="material-symbols-outlined filled">cut</span>
              </button>
              <input
                className="w-full bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 px-4 py-4 focus:ring-0 text-base"
                placeholder="Ask AI about this segment..."
                type="text"
              />
              <div className="flex items-center gap-2 pr-3">
                <button className="p-2 text-gray-400 hover:text-white transition-colors" title="Voice Input">
                  <span className="material-symbols-outlined filled">mic</span>
                </button>
                <button className="bg-primary hover:bg-green-400 text-background-dark p-2 rounded-xl transition-colors flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined filled">arrow_upward</span>
                </button>
              </div>
            </div>
            <div className="absolute -top-8 left-0 w-full flex justify-center opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none">
              <span className="bg-black/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                Context: "Circadian Rhythm Entrainment" (14:02)
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

