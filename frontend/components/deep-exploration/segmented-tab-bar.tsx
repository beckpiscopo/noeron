"use client"

export type TabId = "overview" | "evidence" | "figures" | "graph" | "create"

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
]

interface SegmentedTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  className?: string
}

export function SegmentedTabBar({ activeTab, onTabChange, className = "" }: SegmentedTabBarProps) {
  return (
    <div
      className={`flex border border-border overflow-hidden bg-background ${className}`}
      role="tablist"
    >
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex-1 px-4 py-3 text-center text-sm font-medium transition-colors
            ${index < TABS.length - 1 ? "border-r border-border" : ""}
            ${activeTab === tab.id
              ? "bg-[var(--golden-chestnut)]/10 text-[var(--golden-chestnut)]"
              : "bg-transparent text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
