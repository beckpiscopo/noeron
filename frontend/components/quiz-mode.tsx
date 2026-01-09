"use client"

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Check,
  X,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  Brain,
  Loader2,
} from 'lucide-react'
import { NoeronHeader } from './noeron-header'
import { Button } from '@/components/ui/button'
import { useBookmarks } from '@/hooks/use-bookmarks'
import { callMcpTool } from '@/lib/api'

interface QuizModeProps {
  onBack: () => void
}

type QuizState = 'loading' | 'question' | 'reveal' | 'complete' | 'error'

interface GeneratedQuestion {
  bookmark_id: string
  question: string
  answer: string
  question_type: 'recall' | 'concept' | 'application'
  source_text: string
}

export function QuizMode({ onBack }: QuizModeProps) {
  const { bookmarks, updateQuizStats } = useBookmarks()
  const [state, setState] = useState<QuizState>('loading')
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [results, setResults] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  })
  const [error, setError] = useState<string | null>(null)

  // Get quiz-enabled bookmarks
  const quizBookmarks = bookmarks.filter((b) => b.quiz_enabled)

  // Generate quiz questions on mount
  useEffect(() => {
    generateQuizQuestions()
  }, [])

  const generateQuizQuestions = async () => {
    setState('loading')
    setError(null)
    setCurrentIndex(0)
    setResults({ correct: 0, total: 0 })
    setShowAnswer(false)

    try {
      // Select up to 10 bookmarks for the quiz, prioritizing those less recently quizzed
      const selectedBookmarks = [...quizBookmarks]
        .sort((a, b) => {
          // Prioritize never-quizzed, then oldest quizzed
          if (!a.last_quizzed_at && b.last_quizzed_at) return -1
          if (a.last_quizzed_at && !b.last_quizzed_at) return 1
          if (!a.last_quizzed_at && !b.last_quizzed_at) return 0
          return (
            new Date(a.last_quizzed_at!).getTime() -
            new Date(b.last_quizzed_at!).getTime()
          )
        })
        .slice(0, 10)

      if (selectedBookmarks.length < 3) {
        setError('You need at least 3 bookmarks to start a quiz. Save more content first.')
        setState('error')
        return
      }

      // Prepare content for question generation
      const bookmarkData = selectedBookmarks.map((b) => ({
        id: b.id,
        type: b.bookmark_type,
        title: b.title,
        content: b.context_preview || b.title,
        claim_text: b.claim?.claim_text,
        paper_abstract: b.paper?.abstract,
      }))

      // Call MCP tool to generate questions
      const response = await callMcpTool<{
        questions: GeneratedQuestion[]
        error?: string
      }>('generate_quiz_questions', { bookmarks: bookmarkData })

      if (response.error) {
        setError(response.error)
        setState('error')
        return
      }

      if (response.questions && response.questions.length > 0) {
        setQuestions(response.questions)
        setState('question')
      } else {
        setError('Could not generate questions. Try adding more detailed bookmarks.')
        setState('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz')
      setState('error')
    }
  }

  const currentQuestion = questions[currentIndex]

  const handleReveal = () => {
    setShowAnswer(true)
    setState('reveal')
  }

  const handleRate = async (correct: boolean) => {
    // Update results
    setResults((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }))

    // Update bookmark quiz stats in database
    if (currentQuestion) {
      await updateQuizStats(currentQuestion.bookmark_id, correct)
    }

    // Move to next question or complete
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setShowAnswer(false)
      setState('question')
    } else {
      setState('complete')
    }
  }

  const restartQuiz = () => {
    generateQuizQuestions()
  }

  const iconButtonClasses =
    'flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground'

  const headerActions = (
    <button onClick={onBack} className={iconButtonClasses} title="Back to Library">
      <ArrowLeft className="h-4 w-4" />
    </button>
  )

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'recall':
        return 'Recall'
      case 'concept':
        return 'Concept'
      case 'application':
        return 'Application'
      default:
        return type
    }
  }

  return (
    <div className="noeron-theme relative flex min-h-screen w-full flex-col bg-background text-foreground">
      <NoeronHeader actions={headerActions} onLogoClick={onBack} />

      <main className="flex-1 flex items-center justify-center p-4 md:p-10">
        <div className="w-full max-w-2xl">
          {/* Loading State */}
          {state === 'loading' && (
            <div className="text-center py-20">
              <Loader2 className="w-10 h-10 text-[var(--golden-chestnut)] animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-medium mb-2">Generating Quiz</h2>
              <p className="text-foreground/60">
                Creating flashcard questions from your bookmarks...
              </p>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center py-20">
              <div className="bg-red-500/10 border border-red-500/30 p-6 mb-6">
                <p className="text-red-400">{error}</p>
              </div>
              <div className="flex gap-4 justify-center">
                <Button onClick={restartQuiz} variant="outline" className="!rounded-none">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={onBack} className="!rounded-none">
                  Back to Library
                </Button>
              </div>
            </div>
          )}

          {/* Question Card */}
          {state === 'question' && currentQuestion && (
            <div className="bg-card border border-border p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              {/* Progress */}
              <div className="flex items-center justify-between mb-6">
                <span className="eyebrow">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="text-xs text-foreground/50 uppercase tracking-wider px-2 py-1 bg-foreground/5 border border-border">
                  {getQuestionTypeLabel(currentQuestion.question_type)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-foreground/10 mb-8">
                <div
                  className="h-full bg-[var(--golden-chestnut)] transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                  }}
                />
              </div>

              {/* Question */}
              <div className="mb-8">
                <Brain className="w-8 h-8 text-[var(--golden-chestnut)] mb-4" />
                <h2 className="display text-2xl font-normal leading-relaxed">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Source context */}
              <div className="bg-background/50 border border-border p-4 mb-8">
                <div className="text-xs text-foreground/50 uppercase tracking-wider mb-2">
                  From your saved content
                </div>
                <p className="text-sm text-foreground/70 line-clamp-3">
                  {currentQuestion.source_text}
                </p>
              </div>

              {/* Reveal Button */}
              <Button
                onClick={handleReveal}
                className="w-full !rounded-none !bg-[var(--golden-chestnut)] !text-background !py-4 text-lg"
              >
                Reveal Answer
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Answer Reveal */}
          {state === 'reveal' && currentQuestion && (
            <div className="bg-card border border-border p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              {/* Question recap */}
              <div className="mb-6">
                <span className="eyebrow mb-2 block">Question</span>
                <p className="text-foreground/70">{currentQuestion.question}</p>
              </div>

              {/* Answer */}
              <div className="bg-[var(--golden-chestnut)]/10 border border-[var(--golden-chestnut)]/30 p-6 mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-[var(--golden-chestnut)]" />
                  <span className="text-sm font-bold text-[var(--golden-chestnut)] uppercase tracking-wider">
                    Answer
                  </span>
                </div>
                <p className="text-lg leading-relaxed">{currentQuestion.answer}</p>
              </div>

              {/* Self-rating */}
              <div className="text-center">
                <p className="text-sm text-foreground/60 mb-4">Did you get it right?</p>
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => handleRate(false)}
                    className="!rounded-none !bg-red-500/10 !border !border-red-500/30 !text-red-400 hover:!bg-red-500/20 !px-8"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Incorrect
                  </Button>
                  <Button
                    onClick={() => handleRate(true)}
                    className="!rounded-none !bg-green-500/10 !border !border-green-500/30 !text-green-400 hover:!bg-green-500/20 !px-8"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Correct
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Complete State */}
          {state === 'complete' && (
            <div className="bg-card border border-border p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="w-16 h-16 rounded-full bg-[var(--golden-chestnut)]/10 flex items-center justify-center mx-auto mb-6">
                <Brain className="w-8 h-8 text-[var(--golden-chestnut)]" />
              </div>

              <h2 className="display text-3xl font-normal mb-4">Quiz Complete!</h2>

              <div className="text-5xl font-bold text-[var(--golden-chestnut)] mb-2">
                {results.total > 0
                  ? Math.round((results.correct / results.total) * 100)
                  : 0}
                %
              </div>
              <p className="text-foreground/60 mb-8">
                {results.correct} of {results.total} correct
              </p>

              {/* Performance message */}
              <p className="text-sm text-foreground/50 mb-8">
                {results.correct / results.total >= 0.8
                  ? 'Excellent! You have a strong grasp of this material.'
                  : results.correct / results.total >= 0.5
                    ? 'Good progress! Review your bookmarks to strengthen weak areas.'
                    : 'Keep studying! Review the source material and try again.'}
              </p>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={restartQuiz}
                  variant="outline"
                  className="!rounded-none"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={onBack}
                  className="!rounded-none !bg-[var(--golden-chestnut)] !text-background"
                >
                  Back to Library
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
