"use client"

export type TabId = "overview" | "evidence" | "figures" | "graph" | "create" | "community"

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "figures", label: "Figures" },
  { id: "graph", label: "Graph" },
  { id: "create", label: "Create" },
  { id: "community", label: "Community" },
]

interface SegmentedTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  className?: string
}

export function SegmentedTabBar({ activeTab, onTabChange, className = "" }: SegmentedTabBarProps) {
  return (
    <div
      className={`flex gap-1 border-b border-border/30 ${className}`}
      role="tablist"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            px-4 py-2.5 text-sm font-medium transition-colors relative
            ${activeTab === tab.id
              ? "text-foreground"
              : "text-foreground/50 hover:text-foreground/80"
            }
          `}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--golden-chestnut)]" />
          )}
        </button>
      ))}
    </div>
  )
}
