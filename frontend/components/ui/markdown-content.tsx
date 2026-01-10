"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content: string
  className?: string
  variant?: "default" | "chat" | "compact"
}

export function MarkdownContent({
  content,
  className,
  variant = "default",
}: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        // Variant-specific styles
        variant === "chat" && "[&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_h3]:my-2 [&_h4]:my-2 [&_h5]:my-2",
        variant === "compact" && "[&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_h3]:my-1 [&_h4]:my-1 [&_h5]:my-1 text-xs",
        className
      )}
    >
      <ReactMarkdown
        components={{
        // Custom heading styles for Gemini output patterns like "**Finding**:"
        h1: ({ children }) => (
          <h3 className="text-base font-bold text-foreground mt-4 mb-2 first:mt-0">
            {children}
          </h3>
        ),
        h2: ({ children }) => (
          <h4 className="text-sm font-bold text-foreground mt-3 mb-2 first:mt-0">
            {children}
          </h4>
        ),
        h3: ({ children }) => (
          <h5 className="text-sm font-semibold text-[var(--golden-chestnut)] uppercase tracking-wider mt-3 mb-1 first:mt-0">
            {children}
          </h5>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-outside ml-4 space-y-1 text-foreground/80">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside ml-4 space-y-1 text-foreground/80">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-foreground/80 leading-relaxed">{children}</li>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="text-foreground/80 leading-relaxed mb-2 last:mb-0">
            {children}
          </p>
        ),
        // Bold - often used as inline headers by Gemini
        strong: ({ children }) => (
          <strong className="font-semibold text-[var(--golden-chestnut)]">
            {children}
          </strong>
        ),
        // Italic
        em: ({ children }) => (
          <em className="italic text-foreground/70">{children}</em>
        ),
        // Code
        code: ({ children }) => (
          <code className="text-xs bg-card px-1.5 py-0.5 rounded text-[var(--golden-chestnut)] font-mono">
            {children}
          </code>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--golden-chestnut)] pl-3 my-2 text-foreground/60 italic">
            {children}
          </blockquote>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--golden-chestnut)] hover:underline"
          >
            {children}
          </a>
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
