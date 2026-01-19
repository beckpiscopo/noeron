'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** Height as viewport percentage (e.g., 50 for 50vh, 85 for 85vh) */
  height?: number
  /** Whether to show the close button in header */
  showClose?: boolean
  /** Title for the sheet header */
  title?: string
  /** Optional subtitle */
  subtitle?: string
}

function BottomSheet({
  open,
  onOpenChange,
  children,
  height = 50,
  showClose = true,
  title,
  subtitle,
}: BottomSheetProps) {
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background rounded-t-xl border-t border-border",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          )}
          style={{ maxHeight: `${height}vh` }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Header with title and close */}
          {(title || showClose) && (
            <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
              <div>
                {title && (
                  <DrawerPrimitive.Title className="text-sm font-bold text-foreground tracking-wide uppercase">
                    {title}
                  </DrawerPrimitive.Title>
                )}
                {subtitle && (
                  <p className="text-[10px] text-foreground/50 mono tracking-[0.1em] mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
              {showClose && (
                <DrawerPrimitive.Close className="p-2 -mr-2 text-foreground/50 hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </DrawerPrimitive.Close>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  )
}

// Simple trigger component
function BottomSheetTrigger({
  children,
  asChild,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return (
    <DrawerPrimitive.Trigger asChild={asChild} {...props}>
      {children}
    </DrawerPrimitive.Trigger>
  )
}

export { BottomSheet, BottomSheetTrigger }
