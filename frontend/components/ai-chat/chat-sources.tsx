"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink, FileText } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ChatSource } from "@/lib/chat-types"

interface ChatSourcesProps {
  sources: ChatSource[]
  onViewPaper?: (paperId: string) => void
}

export function ChatSources({ sources, onViewPaper }: ChatSourcesProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!sources || sources.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-foreground/60 hover:text-foreground/80 transition-colors">
        <FileText className="w-3 h-3" />
        <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {sources.map((source, index) => (
          <div
            key={`${source.paper_id}-${index}`}
            className={`bg-background/50 border border-border rounded-sm p-3 text-xs ${
              onViewPaper ? "cursor-pointer hover:border-[var(--golden-chestnut)]/50 hover:bg-background/80 transition-colors" : ""
            }`}
            onClick={() => onViewPaper?.(source.paper_id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className={`font-medium leading-snug ${onViewPaper ? "text-[var(--golden-chestnut)] hover:underline" : "text-foreground/80"}`}>
                  {source.paper_title}
                </p>
                <p className="text-foreground/50 mt-1">
                  {source.year} {source.section && `• ${source.section}`}
                </p>
              </div>
              {onViewPaper && (
                <ExternalLink className="shrink-0 w-3 h-3 text-[var(--golden-chestnut)]/60" />
              )}
            </div>
            {source.relevance_snippet && (
              <p className="mt-2 text-foreground/60 leading-relaxed italic">
                "{source.relevance_snippet}"
              </p>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
