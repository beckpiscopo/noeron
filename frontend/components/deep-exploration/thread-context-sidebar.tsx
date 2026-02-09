"use client"

import { GitBranch } from "lucide-react"

export function ThreadContextSidebar() {
  return (
    <div className="w-56 shrink-0 space-y-4">
      <div className="flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-[var(--golden-chestnut)]" />
        <h3 className="font-semibold text-lg text-foreground">Evidence Threads</h3>
      </div>
      <div>
        <p className="text-sm text-foreground/50 leading-relaxed">
          An evidence thread traces how a line of research evolved over time — connecting foundational discoveries to later experimental work.
        </p>
        <p className="text-sm text-foreground/50 leading-relaxed mt-3">
          Each thread groups milestones that share a common research narrative, showing how ideas built on each other across papers and years.
        </p>
      </div>
    </div>
  )
}
