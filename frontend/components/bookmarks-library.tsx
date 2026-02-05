"use client"

import { useState } from 'react'
import {
  Bookmark,
  FileText,
  Quote,
  Search,
  HelpCircle,
  Trash2,
  Brain,
  ChevronRight,
  ArrowLeft,
  Edit3,
  Loader2,
} from 'lucide-react'
import { NoeronHeader } from './noeron-header'
import { Button } from '@/components/ui/button'
import { useBookmarks } from '@/hooks/use-bookmarks'
import type { BookmarkWithDetails, BookmarkType } from '@/lib/supabase'

interface BookmarksLibraryProps {
  onBack: () => void
  onStartQuiz: () => void
  onViewClaim: (claimId: number) => void
  onViewPaper: (paperId: string) => void
}

type FilterType = 'all' | BookmarkType

export function BookmarksLibrary({
  onBack,
  onStartQuiz,
  onViewClaim,
  onViewPaper,
}: BookmarksLibraryProps) {
  const { bookmarks, isLoading, removeBookmark, updateBookmarkNotes } = useBookmarks()
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')

  const filteredBookmarks = bookmarks.filter((bookmark) => {
    const matchesFilter = filter === 'all' || bookmark.bookmark_type === filter
    const matchesSearch =
      !searchQuery ||
      bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.context_preview?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const counts = {
    all: bookmarks.length,
    claim: bookmarks.filter((b) => b.bookmark_type === 'claim').length,
    paper: bookmarks.filter((b) => b.bookmark_type === 'paper').length,
    snippet: bookmarks.filter((b) => b.bookmark_type === 'snippet').length,
  }

  const quizReadyCount = bookmarks.filter((b) => b.quiz_enabled).length

  const iconButtonClasses =
    'flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground'

  const headerActions = (
    <>
      <button onClick={onBack} className={iconButtonClasses} title="Back">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button className={iconButtonClasses}>
        <HelpCircle className="h-4 w-4" />
      </button>
    </>
  )

  const getBookmarkIcon = (type: BookmarkType) => {
    switch (type) {
      case 'claim':
        return <FileText className="w-4 h-4" />
      case 'paper':
        return <FileText className="w-4 h-4" />
      case 'snippet':
        return <Quote className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: BookmarkType) => {
    switch (type) {
      case 'claim':
        return 'bg-blue-500/10 text-blue-400'
      case 'paper':
        return 'bg-green-500/10 text-green-400'
      case 'snippet':
        return 'bg-purple-500/10 text-purple-400'
    }
  }

  const handleBookmarkClick = (bookmark: BookmarkWithDetails) => {
    if (bookmark.bookmark_type === 'claim' && bookmark.claim_id) {
      onViewClaim(bookmark.claim_id)
    } else if (bookmark.bookmark_type === 'paper' && bookmark.paper_id) {
      onViewPaper(bookmark.paper_id)
    }
    // Snippets don't navigate anywhere currently
  }

  const handleStartEditNotes = (bookmark: BookmarkWithDetails, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNotes(bookmark.id)
    setNotesValue(bookmark.notes || '')
  }

  const handleSaveNotes = async (bookmarkId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await updateBookmarkNotes(bookmarkId, notesValue)
    setEditingNotes(null)
    setNotesValue('')
  }

  const handleCancelNotes = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNotes(null)
    setNotesValue('')
  }

  return (
    <div className="noeron-theme relative flex min-h-screen w-full flex-col bg-background text-foreground">
      <NoeronHeader actions={headerActions} onLogoClick={onBack} />

      <main className="flex-1 w-full px-4 md:px-10 py-8">
        <div className="mx-auto max-w-[1200px]">
          {/* Page Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="eyebrow mb-2">Your Library</div>
              <h1 className="display text-3xl md:text-4xl font-normal leading-tight tracking-[-0.02em] text-foreground mb-2">
                Saved Content
              </h1>
              <p className="text-foreground/60 text-sm md:text-base">
                {bookmarks.length} items bookmarked across claims, papers, and snippets
              </p>
            </div>

            {/* Quiz Mode CTA */}
            <div className="hidden md:block">
              <Button
                onClick={onStartQuiz}
                disabled={quizReadyCount < 3}
                className="!rounded-none !bg-[var(--golden-chestnut)] !text-background !px-6 !py-3 flex items-center gap-2 disabled:opacity-50"
              >
                <Brain className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-bold">Quiz Mode</div>
                  <div className="text-xs opacity-80">{quizReadyCount} cards ready</div>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-6 border-b border-border pb-4 flex-wrap">
            {[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'claim', label: 'Claims', count: counts.claim },
              { key: 'paper', label: 'Papers', count: counts.paper },
              { key: 'snippet', label: 'Snippets', count: counts.snippet },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key as FilterType)}
                className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-[18px] ${
                  filter === key
                    ? 'text-[var(--golden-chestnut)] border-[var(--golden-chestnut)]'
                    : 'text-foreground/50 border-transparent hover:text-foreground'
                }`}
              >
                {label}
                <span className="ml-1.5 text-xs opacity-60">({count})</span>
              </button>
            ))}

            {/* Search */}
            <div className="ml-auto flex items-center gap-2 bg-card border border-border px-3 py-1.5">
              <Search className="w-4 h-4 text-foreground/40" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none w-32 md:w-48"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mr-3" />
              <div className="text-foreground/50">Loading bookmarks...</div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredBookmarks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bookmark className="w-12 h-12 text-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery ? 'No matching bookmarks' : 'No bookmarks yet'}
              </h3>
              <p className="text-foreground/60 text-sm max-w-md">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Start saving claims, papers, and snippets while exploring podcasts'}
              </p>
              {!searchQuery && (
                <Button onClick={onBack} variant="outline" className="!rounded-none mt-4">
                  Browse Episodes
                </Button>
              )}
            </div>
          )}

          {/* Bookmarks Grid */}
          {!isLoading && filteredBookmarks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBookmarks.map((bookmark) => (
                <article
                  key={bookmark.id}
                  onClick={() => handleBookmarkClick(bookmark)}
                  className={`group relative flex flex-col border border-border p-5 transition-all duration-300 hover:bg-card hover:shadow-[0_0_25px_rgba(190,124,77,0.15)] hover:border-[var(--golden-chestnut)]/30 bg-card/50 ${
                    bookmark.bookmark_type !== 'snippet' ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase tracking-wider ${getTypeColor(
                        bookmark.bookmark_type
                      )}`}
                    >
                      {getBookmarkIcon(bookmark.bookmark_type)}
                      <span>{bookmark.bookmark_type}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => handleStartEditNotes(bookmark, e)}
                        className="p-1 text-foreground/40 hover:text-foreground transition-all"
                        title="Edit notes"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeBookmark(bookmark.id)
                        }}
                        className="p-1 text-foreground/40 hover:text-red-400 transition-all"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-foreground font-medium leading-snug mb-2 line-clamp-2">
                    {bookmark.title}
                  </h3>

                  {/* Preview */}
                  {bookmark.context_preview && (
                    <p className="text-foreground/60 text-sm leading-relaxed line-clamp-3 mb-3">
                      {bookmark.context_preview}
                    </p>
                  )}

                  {/* Notes Section */}
                  {editingNotes === bookmark.id ? (
                    <div
                      className="mt-auto pt-3 border-t border-border/50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        placeholder="Add your notes..."
                        className="w-full bg-background border border-border p-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-[var(--golden-chestnut)] resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={(e) => handleSaveNotes(bookmark.id, e)}
                          className="!rounded-none !bg-[var(--golden-chestnut)] !text-background"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelNotes}
                          className="!rounded-none"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : bookmark.notes ? (
                    <div className="mt-2 p-2 bg-background/50 border-l-2 border-[var(--golden-chestnut)]/50">
                      <p className="text-xs text-foreground/70 italic line-clamp-2">
                        {bookmark.notes}
                      </p>
                    </div>
                  ) : null}

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-foreground/40 mono">
                      {new Date(bookmark.created_at).toLocaleDateString()}
                    </span>
                    {bookmark.quiz_count > 0 && (
                      <span className="text-xs text-[var(--golden-chestnut)] mono">
                        Quiz: {Math.round((bookmark.quiz_score || 0) * 100)}%
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Quiz Button */}
      <div className="md:hidden fixed bottom-4 right-4">
        <Button
          onClick={onStartQuiz}
          disabled={quizReadyCount < 3}
          className="!rounded-full !bg-[var(--golden-chestnut)] !text-background !w-14 !h-14 !p-0 shadow-lg disabled:opacity-50"
        >
          <Brain className="w-6 h-6" />
        </Button>
      </div>
    </div>
  )
}
