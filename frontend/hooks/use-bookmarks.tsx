"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import {
  type Bookmark,
  type BookmarkWithDetails,
  type BookmarkType,
  type Claim,
  type Paper,
  type EpisodeNotebookStats,
  getBookmarksWithDetails,
  getBookmarksForEpisode as getBookmarksForEpisodeQuery,
  getEpisodesWithBookmarks,
  createBookmark,
  deleteBookmark,
  updateBookmark,
  updateBookmarkQuizStats,
  subscribeToBookmarks,
} from '@/lib/supabase'

interface BookmarkContextType {
  bookmarks: BookmarkWithDetails[]
  isLoading: boolean
  error: string | null

  // Actions
  addClaimBookmark: (claim: Claim, episodeId?: string) => Promise<Bookmark | null>
  addPaperBookmark: (paper: Paper, episodeId?: string) => Promise<Bookmark | null>
  addSnippetBookmark: (
    episodeId: string,
    text: string,
    startMs: number,
    endMs: number
  ) => Promise<Bookmark | null>
  addAiInsightBookmark: (
    episodeId: string,
    insightText: string,
    source: string,
    title?: string
  ) => Promise<Bookmark | null>
  addImageBookmark: (
    episodeId: string,
    imageUrl: string,
    caption?: string,
    title?: string
  ) => Promise<Bookmark | null>
  removeBookmark: (bookmarkId: string) => Promise<void>
  updateBookmarkNotes: (bookmarkId: string, notes: string) => Promise<void>
  toggleBookmark: (type: BookmarkType, item: Claim | Paper, episodeId?: string) => Promise<boolean>

  // Queries
  isItemBookmarked: (type: BookmarkType, itemId: number | string) => boolean
  getBookmarksByType: (type: BookmarkType) => BookmarkWithDetails[]
  getBookmarkForItem: (type: BookmarkType, itemId: number | string) => BookmarkWithDetails | undefined
  getBookmarksForEpisode: (episodeId: string) => Promise<BookmarkWithDetails[]>
  getEpisodeBookmarkCounts: () => Promise<EpisodeNotebookStats[]>

  // Quiz
  updateQuizStats: (bookmarkId: string, correct: boolean) => Promise<void>

  // Refresh
  refreshBookmarks: () => Promise<void>
}

const BookmarkContext = createContext<BookmarkContextType | null>(null)

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<BookmarkWithDetails[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Build lookup set for fast isBookmarked checks
  useEffect(() => {
    const ids = new Set<string>()
    bookmarks.forEach((b) => {
      if (b.claim_id) ids.add(`claim:${b.claim_id}`)
      if (b.paper_id) ids.add(`paper:${b.paper_id}`)
      if (b.snippet_text) ids.add(`snippet:${b.episode_id}:${b.start_ms}`)
    })
    setBookmarkedIds(ids)
  }, [bookmarks])

  const refreshBookmarks = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getBookmarksWithDetails()
      setBookmarks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks')
      console.error('Failed to load bookmarks:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    refreshBookmarks()
  }, [refreshBookmarks])

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToBookmarks((payload) => {
      // Refresh on any change for simplicity
      // Could optimize to update/remove specific items
      refreshBookmarks()
    })
    return unsubscribe
  }, [refreshBookmarks])

  const addClaimBookmark = useCallback(
    async (claim: Claim, episodeId?: string): Promise<Bookmark | null> => {
      try {
        const bookmark = await createBookmark({
          bookmark_type: 'claim',
          claim_id: claim.id,
          episode_id: episodeId || claim.podcast_id,
          title: claim.distilled_claim || claim.claim_text || 'Untitled claim',
          context_preview: claim.claim_text?.substring(0, 200),
        })
        if (bookmark) {
          setBookmarks((prev) => [{ ...bookmark, claim }, ...prev])
        }
        return bookmark
      } catch (err: unknown) {
        // Supabase errors have message/details properties
        const supabaseError = err as { message?: string; details?: string; code?: string }
        const errorMessage = supabaseError?.message || supabaseError?.details || 'Unknown error'
        console.error('Failed to create claim bookmark:', errorMessage, supabaseError?.code)
        setError(`Failed to save bookmark: ${errorMessage}`)
        return null
      }
    },
    []
  )

  const addPaperBookmark = useCallback(async (paper: Paper, episodeId?: string): Promise<Bookmark | null> => {
    try {
      const bookmark = await createBookmark({
        bookmark_type: 'paper',
        paper_id: paper.paper_id,
        episode_id: episodeId,
        title: paper.title || 'Untitled paper',
        context_preview: paper.abstract?.substring(0, 200),
      })
      if (bookmark) {
        setBookmarks((prev) => [{ ...bookmark, paper }, ...prev])
      }
      return bookmark
    } catch (err: unknown) {
      const supabaseError = err as { message?: string; details?: string; code?: string }
      const errorMessage = supabaseError?.message || supabaseError?.details || 'Unknown error'
      console.error('Failed to create paper bookmark:', errorMessage, supabaseError?.code)
      setError(`Failed to save bookmark: ${errorMessage}`)
      return null
    }
  }, [])

  const addSnippetBookmark = useCallback(
    async (
      episodeId: string,
      text: string,
      startMs: number,
      endMs: number
    ): Promise<Bookmark | null> => {
      try {
        const bookmark = await createBookmark({
          bookmark_type: 'snippet',
          episode_id: episodeId,
          snippet_text: text,
          start_ms: startMs,
          end_ms: endMs,
          title: text.length > 100 ? text.substring(0, 97) + '...' : text,
          context_preview: text,
        })
        if (bookmark) {
          setBookmarks((prev) => [bookmark, ...prev])
        }
        return bookmark
      } catch (err) {
        console.error('Failed to create snippet bookmark:', err)
        return null
      }
    },
    []
  )

  const addAiInsightBookmark = useCallback(
    async (
      episodeId: string,
      insightText: string,
      source: string,
      title?: string
    ): Promise<Bookmark | null> => {
      try {
        const bookmark = await createBookmark({
          bookmark_type: 'ai_insight',
          episode_id: episodeId,
          insight_source: source,
          title: title || (insightText.length > 100 ? insightText.substring(0, 97) + '...' : insightText),
          context_preview: insightText,
        })
        if (bookmark) {
          setBookmarks((prev) => [bookmark, ...prev])
        }
        return bookmark
      } catch (err) {
        console.error('Failed to create AI insight bookmark:', err)
        return null
      }
    },
    []
  )

  const addImageBookmark = useCallback(
    async (
      episodeId: string,
      imageUrl: string,
      caption?: string,
      title?: string
    ): Promise<Bookmark | null> => {
      try {
        const bookmark = await createBookmark({
          bookmark_type: 'image',
          episode_id: episodeId,
          image_url: imageUrl,
          image_caption: caption,
          title: title || caption || 'Saved image',
          context_preview: caption,
        })
        if (bookmark) {
          setBookmarks((prev) => [bookmark, ...prev])
        }
        return bookmark
      } catch (err) {
        console.error('Failed to create image bookmark:', err)
        return null
      }
    },
    []
  )

  const removeBookmark = useCallback(async (bookmarkId: string): Promise<void> => {
    try {
      await deleteBookmark(bookmarkId)
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
    } catch (err) {
      console.error('Failed to delete bookmark:', err)
    }
  }, [])

  const updateBookmarkNotes = useCallback(
    async (bookmarkId: string, notes: string): Promise<void> => {
      try {
        await updateBookmark(bookmarkId, { notes })
        setBookmarks((prev) =>
          prev.map((b) => (b.id === bookmarkId ? { ...b, notes } : b))
        )
      } catch (err) {
        console.error('Failed to update bookmark notes:', err)
      }
    },
    []
  )

  const toggleBookmark = useCallback(
    async (type: BookmarkType, item: Claim | Paper, episodeId?: string): Promise<boolean> => {
      const itemId = type === 'claim' ? (item as Claim).id : (item as Paper).paper_id
      const key = `${type}:${itemId}`

      if (bookmarkedIds.has(key)) {
        // Remove bookmark
        const bookmark = bookmarks.find(
          (b) =>
            (type === 'claim' && b.claim_id === itemId) ||
            (type === 'paper' && b.paper_id === itemId)
        )
        if (bookmark) {
          await removeBookmark(bookmark.id)
        }
        return false
      } else {
        // Add bookmark
        if (type === 'claim') {
          await addClaimBookmark(item as Claim, episodeId)
        } else {
          await addPaperBookmark(item as Paper, episodeId)
        }
        return true
      }
    },
    [bookmarkedIds, bookmarks, addClaimBookmark, addPaperBookmark, removeBookmark]
  )

  const isItemBookmarked = useCallback(
    (type: BookmarkType, itemId: number | string): boolean => {
      return bookmarkedIds.has(`${type}:${itemId}`)
    },
    [bookmarkedIds]
  )

  const getBookmarksByType = useCallback(
    (type: BookmarkType): BookmarkWithDetails[] => {
      return bookmarks.filter((b) => b.bookmark_type === type)
    },
    [bookmarks]
  )

  const getBookmarkForItem = useCallback(
    (type: BookmarkType, itemId: number | string): BookmarkWithDetails | undefined => {
      return bookmarks.find(
        (b) =>
          (type === 'claim' && b.claim_id === itemId) ||
          (type === 'paper' && b.paper_id === itemId)
      )
    },
    [bookmarks]
  )

  const getBookmarksForEpisode = useCallback(
    async (episodeId: string): Promise<BookmarkWithDetails[]> => {
      try {
        return await getBookmarksForEpisodeQuery(episodeId)
      } catch (err) {
        console.error('Failed to get bookmarks for episode:', err)
        return []
      }
    },
    []
  )

  const getEpisodeBookmarkCounts = useCallback(
    async (): Promise<EpisodeNotebookStats[]> => {
      try {
        return await getEpisodesWithBookmarks()
      } catch (err) {
        console.error('Failed to get episode bookmark counts:', err)
        return []
      }
    },
    []
  )

  const updateQuizStats = useCallback(
    async (bookmarkId: string, correct: boolean): Promise<void> => {
      try {
        await updateBookmarkQuizStats(bookmarkId, correct)
        // Optimistically update local state
        setBookmarks((prev) =>
          prev.map((b) => {
            if (b.id !== bookmarkId) return b
            const newCount = (b.quiz_count || 0) + 1
            const currentScore = b.quiz_score || 0
            const newScore =
              (currentScore * (newCount - 1) + (correct ? 1 : 0)) / newCount
            return {
              ...b,
              quiz_score: newScore,
              quiz_count: newCount,
              last_quizzed_at: new Date().toISOString(),
            }
          })
        )
      } catch (err) {
        console.error('Failed to update quiz stats:', err)
      }
    },
    []
  )

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        isLoading,
        error,
        addClaimBookmark,
        addPaperBookmark,
        addSnippetBookmark,
        addAiInsightBookmark,
        addImageBookmark,
        removeBookmark,
        updateBookmarkNotes,
        toggleBookmark,
        isItemBookmarked,
        getBookmarksByType,
        getBookmarkForItem,
        getBookmarksForEpisode,
        getEpisodeBookmarkCounts,
        updateQuizStats,
        refreshBookmarks,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  )
}

export function useBookmarks() {
  const context = useContext(BookmarkContext)
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarkProvider')
  }
  return context
}
