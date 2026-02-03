"use client"

import { useState } from "react"
import { X, Share2, Globe, Lock } from "lucide-react"
import { updateSlideSharing } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

interface ShareSlideModalProps {
  open: boolean
  onClose: () => void
  slideId: string
  isCurrentlyPublic: boolean
  onShareUpdated?: (isPublic: boolean) => void
}

export function ShareSlideModal({
  open,
  onClose,
  slideId,
  isCurrentlyPublic,
  onShareUpdated,
}: ShareSlideModalProps) {
  const { user } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleShare = async (makePublic: boolean) => {
    if (!user) return

    setIsUpdating(true)
    setError(null)

    try {
      const result = await updateSlideSharing(slideId, makePublic, user.id)
      if (result.success) {
        onShareUpdated?.(makePublic)
        onClose()
      } else {
        setError(result.error || "Failed to update sharing")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sharing")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[var(--golden-chestnut)]" />
            <h3 className="font-bold text-lg">Share with Community</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-foreground/10 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-foreground/60 text-sm mb-6">
          {isCurrentlyPublic
            ? "This slide deck is currently shared with the community. Others can view and download it."
            : "Share your slide deck with other Noeron users exploring this claim."}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isCurrentlyPublic ? (
            <button
              onClick={() => handleShare(false)}
              disabled={isUpdating}
              className="w-full py-3 border border-border flex items-center justify-center gap-2 hover:bg-foreground/5 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Make Private
            </button>
          ) : (
            <button
              onClick={() => handleShare(true)}
              disabled={isUpdating}
              className="w-full py-3 bg-[var(--golden-chestnut)] text-white flex items-center justify-center gap-2 hover:bg-[var(--golden-chestnut)]/90 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Share with Community
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 border border-border text-foreground/60 hover:bg-foreground/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
