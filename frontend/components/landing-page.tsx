"use client"

import { useState } from "react"
import Link from "next/link"
import { Play, Moon, Sun, Bookmark, Info, MessageSquare, Sparkles, Forward, Rewind, ChevronRight, Database, Brain, Zap, FileJson, Github, Menu, User, LogOut, Settings } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/auth-context"

interface LandingPageProps {
  onGetStarted: () => void
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const { theme, setTheme } = useTheme()
  const { user, authState, signOut } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Ensure component is mounted before rendering theme toggle
  useState(() => {
    setMounted(true)
  })

  return (
    <div className="bg-[#1a1a1a] text-[#E0E0E0] font-sans antialiased overflow-x-hidden scroll-smooth">
      {/* Custom styles for this page */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Playfair+Display:wght@400;500;600;700&display=swap');

        .perspective-container {
          perspective: 2000px;
        }

        /* Mobile: flat mockup, no 3D transform */
        .rotate-3d {
          transform: none;
          transform-style: flat;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          transition: transform 0.5s ease-out, box-shadow 0.5s ease-out;
        }

        /* Desktop (lg+): 3D perspective transform */
        @media (min-width: 1024px) {
          .rotate-3d {
            transform: rotateX(20deg) rotateY(0deg) rotateZ(-4deg) scale(0.95);
            transform-style: preserve-3d;
            box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.9);
          }

          .rotate-3d:hover {
            transform: rotateX(15deg) rotateY(0deg) rotateZ(-2deg) scale(0.98);
          }
        }

        .preserve-3d {
          transform-style: preserve-3d;
        }

        @media (min-width: 1024px) {
          .preserve-3d {
            transform-style: preserve-3d;
          }
        }

        .bg-bio-texture {
          background-color: #1a1a1a;
          background-image:
            radial-gradient(ellipse 100% 60% at 55% 25%, rgba(196, 139, 96, 0.18) 0%, rgba(196, 139, 96, 0.06) 35%, transparent 65%),
            linear-gradient(rgba(255, 0, 0, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 0, 0, 0.3) 1px, transparent 1px);
          background-size: 100% 100%, 40px 40px, 40px 40px;
          position: relative;
        }

        /* Vignette effect */
        .bg-bio-texture::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.5) 100%);
          pointer-events: none;
          z-index: 1;
        }

        /* Noise/grain texture */
        .bg-bio-texture::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          opacity: 0.04;
          pointer-events: none;
          z-index: 2;
        }

        /* Mobile: flat card, no 3D transform */
        .pop-out-card {
          transform: none;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5);
          z-index: 50;
          position: relative;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        /* Desktop (lg+): 3D pop-out effect */
        @media (min-width: 1024px) {
          .pop-out-card {
            transform: translateZ(80px) scale(1.05) translateX(-20px) translateY(-10px);
            box-shadow: -30px 40px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(196, 139, 96, 0.2);
          }
          .pop-out-card:hover {
            transform: translateZ(90px) scale(1.06) translateX(-20px) translateY(-12px);
            box-shadow: -35px 45px 70px rgba(0,0,0,0.9), 0 0 0 1px rgba(196, 139, 96, 0.4);
          }
        }

        .glow-effect {
          background: radial-gradient(ellipse 120% 80% at 70% 30%, rgba(196, 139, 96, 0.15) 0%, rgba(196, 139, 96, 0.05) 40%, transparent 70%);
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        /* Scroll snap for sections */
        .snap-container {
          scroll-snap-type: y mandatory;
          overflow-y: scroll;
          height: 100vh;
        }

        .snap-section {
          scroll-snap-align: start;
          min-height: 100vh;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}} />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-[#1a1a1a]/80 border-b border-white/10">
        <div className="w-full pl-4 sm:pl-6 lg:pl-12 xl:pl-20 pr-4 sm:pr-6 lg:pr-12 xl:pr-20">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="font-bold text-2xl tracking-tighter text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                Noeron
              </span>
            </div>
            {/* Nav links */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#gemini" className="text-sm text-gray-400 hover:text-white transition-colors" style={{ fontFamily: "'Fira Code', monospace" }}>
                Gemini 3
              </a>
              <a href="#tech-stack" className="text-sm text-gray-400 hover:text-white transition-colors" style={{ fontFamily: "'Fira Code', monospace" }}>
                Tech Stack
              </a>
              <a href="#demo" className="text-sm text-gray-400 hover:text-white transition-colors" style={{ fontFamily: "'Fira Code', monospace" }}>
                Demo
              </a>
            </div>
            <div className="flex items-center space-x-4">
              {/* Mobile hamburger menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <button className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Open menu">
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-[#1a1a1a] border-[#333] w-[280px]">
                  <nav className="flex flex-col gap-6 mt-8">
                    <a
                      href="#gemini"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg text-gray-400 hover:text-white transition-colors"
                      style={{ fontFamily: "'Fira Code', monospace" }}
                    >
                      Gemini 3
                    </a>
                    <a
                      href="#tech-stack"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg text-gray-400 hover:text-white transition-colors"
                      style={{ fontFamily: "'Fira Code', monospace" }}
                    >
                      Tech Stack
                    </a>
                    <a
                      href="#demo"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg text-gray-400 hover:text-white transition-colors"
                      style={{ fontFamily: "'Fira Code', monospace" }}
                    >
                      Demo
                    </a>
                    {authState === "authenticated" ? (
                      <>
                        <Link
                          href="/settings"
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-lg text-gray-400 hover:text-white transition-colors"
                          style={{ fontFamily: "'Fira Code', monospace" }}
                        >
                          Settings
                        </Link>
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false)
                            signOut()
                          }}
                          className="text-lg text-red-400 hover:text-red-300 transition-colors text-left"
                          style={{ fontFamily: "'Fira Code', monospace" }}
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-lg text-gray-400 hover:text-white transition-colors"
                        style={{ fontFamily: "'Fira Code', monospace" }}
                      >
                        Sign in
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false)
                        onGetStarted()
                      }}
                      className="inline-flex items-center justify-center px-4 py-3 border border-[#C48B60] text-sm uppercase tracking-wide font-medium text-white bg-[#C48B60] hover:bg-[#A8744F] hover:border-[#A8744F] transition-all mt-4"
                    >
                      Access Demo <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </nav>
                </SheetContent>
              </Sheet>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Toggle theme"
              >
                {mounted && theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              {/* Auth button/menu */}
              {authState === "authenticated" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 text-gray-400 hover:text-white transition-colors">
                      <User className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-[#1E1E1E] border-[#333]">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#333]" />
                    <DropdownMenuItem asChild className="text-gray-300 focus:bg-[#333] focus:text-white">
                      <Link href="/settings">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#333]" />
                    <DropdownMenuItem onClick={() => signOut()} className="text-red-400 focus:bg-[#333] focus:text-red-300">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : authState === "unauthenticated" ? (
                <Link
                  href="/login"
                  className="hidden sm:inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-xs uppercase tracking-wide font-medium text-gray-300 hover:border-white hover:text-white transition-all"
                >
                  Sign In
                </Link>
              ) : null}
              <button
                onClick={onGetStarted}
                className="hidden sm:inline-flex items-center justify-center px-4 py-2 border border-[#C48B60] shadow-sm text-xs uppercase tracking-wide font-medium text-white bg-[#C48B60] hover:bg-[#A8744F] hover:border-[#A8744F] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C48B60] transition-all"
              >
                Access Demo <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Section 1: Hero - Asymmetric Layout */}
      <section className="snap-section relative min-h-screen flex items-center pt-20 pb-12 lg:pt-24 lg:pb-0 overflow-hidden text-white">
        {/* Bio-texture background with grid, glow, vignette, and noise */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#1a1a1a',
            backgroundImage: `
              radial-gradient(ellipse 100% 60% at 55% 25%, rgba(196, 139, 96, 0.18) 0%, rgba(196, 139, 96, 0.06) 35%, transparent 65%),
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 50px 50px, 50px 50px'
          }}
        >
          {/* Vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.5) 100%)'
            }}
          />
          {/* Noise texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
            }}
          />
        </div>

        <div className="relative z-10 w-full px-4 sm:px-6 lg:pl-12 xl:pl-20 lg:pr-0">
          <div className="grid grid-cols-1 lg:grid-cols-[32%_68%] gap-8 lg:gap-4 items-center">
            {/* Left column - Text content */}
            <div className="text-center lg:text-left items-center lg:items-start flex flex-col lg:-mt-12">
              {/* Headline */}
              <h1 className="text-5xl md:text-5xl lg:text-6xl xl:text-7xl min-[1550px]:text-8xl font-bold tracking-tight mb-6 leading-tight text-white animate-fade-in-up" style={{ fontFamily: "'Playfair Display', serif" }}>
                The{' '}
                <span className="text-[#C48B60] inline-block" style={{ transform: 'skewX(-6deg)' }}>
                  knowledge layer
                </span>
                <br />
                for podcasts.
              </h1>

              {/* Subhead */}
              <p className="mt-3 max-w-lg text-base md:text-lg font-light leading-relaxed text-gray-300 mb-6 mx-auto lg:mx-0">
                Real-time synchronization between conversation and research.
              </p>

              {/* Terminal-style loading text with typing animation */}
              <div className="text-xs leading-[1.8] mb-8 max-w-[450px] mx-auto lg:mx-0" style={{ fontFamily: "'Fira Code', monospace" }}>
                <div className="animate-typing text-[#C48B60]/80 mb-1">
                  // PARSING AUDIO STREAMS
                </div>
                <div className="animate-typing text-[#C48B60]/80 mb-1" style={{ animationDelay: "0.4s" }}>
                  // VERIFYING FACTS WITH GEMINI 3
                </div>
                <div className="animate-typing text-[#C48B60]/80 flex items-center gap-2" style={{ animationDelay: "0.7s" }}>
                  // GENERATING KNOWLEDGE GRAPH...
                  <span className="animate-pulse inline-block w-2 h-3 bg-[#C48B60]" />
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <button
                  onClick={onGetStarted}
                  className="inline-flex items-center justify-center px-8 py-3 text-xs uppercase tracking-wide font-medium text-white bg-[#C48B60] border border-[#C48B60] hover:bg-[#A8744F] hover:border-[#A8744F] md:py-4 md:text-sm transition-all shadow-lg hover:shadow-[#C48B60]/20"
                >
                  Start Researching
                </button>
                <a href="#demo" className="inline-flex items-center justify-center px-8 py-3 text-xs uppercase tracking-wide font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-[#C48B60] hover:border-[#C48B60] hover:text-white md:py-4 md:text-sm transition-all group">
                  <Play className="w-4 h-4 mr-2 text-[#C48B60] group-hover:text-white transition-colors fill-current" />
                  Watch Demo
                </a>
              </div>
            </div>

            {/* Right column - 3D Product Mockup */}
            <div
              className="perspective-container relative w-full animate-fade-in-up mt-12 lg:mt-0 lg:-mt-16 lg:-mr-8 xl:-mr-16"
              style={{ animationDelay: '0.3s' }}
            >
            <div className="rotate-3d relative rounded-xl border border-gray-700/50 bg-[#121212] ring-1 ring-white/5 overflow-hidden">
              {/* Browser chrome */}
              <div className="h-8 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center px-4 space-x-2 rounded-t-xl">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <div className="ml-4 flex-1 text-center text-xs text-gray-600" style={{ fontFamily: "'Fira Code', monospace" }}>
                  noeron.app — Research Stream
                </div>
              </div>

              {/* Three-panel mockup content */}
              <div className="flex h-[500px] lg:h-[780px] bg-[#121212] text-gray-200 text-left rounded-b-xl preserve-3d overflow-hidden">
                {/* Left panel - Podcast Player */}
                <div className="w-64 min-[1550px]:w-80 border-r border-[#2a2a2a] p-4 min-[1550px]:p-6 flex-col hidden md:flex rounded-bl-xl bg-[#181818]">
                  {/* Podcast info - centered vertically */}
                  <div className="my-auto pt-8 min-[1550px]:pt-16">
                    <div className="aspect-square bg-black mb-3 min-[1550px]:mb-6 relative overflow-hidden group rounded-sm border border-[#333]">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#C48B60]/20 to-[#be5a38]/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-20 min-[1550px]:w-32 h-6 min-[1550px]:h-12 text-[#C48B60]" fill="none" stroke="currentColor" viewBox="0 0 100 20">
                          <path d="M0 10 Q 5 0 10 10 T 20 10 T 30 10 T 40 10 T 50 10 T 60 10 T 70 10 T 80 10 T 90 10 T 100 10" strokeWidth="2" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-base min-[1550px]:text-xl font-bold leading-tight mb-1 text-gray-200" style={{ fontFamily: "'Inter', sans-serif" }}>
                      Biology, Life, Aliens, Evolution & Xenobots
                    </h3>
                    <p className="text-[10px] min-[1550px]:text-xs uppercase tracking-widest text-[#C48B60] font-bold mb-2 min-[1550px]:mb-4">Episode 325</p>
                    <div className="text-xs min-[1550px]:text-sm text-gray-500">
                      <p>Host: <span className="italic text-gray-400">Lex Fridman</span></p>
                      <p>Guest: <span className="italic text-gray-400">Michael Levin</span></p>
                    </div>
                  </div>
                  {/* Player controls - pinned to bottom */}
                  <div className="mt-auto pt-4">
                    <div className="h-10 min-[1550px]:h-16 flex items-end justify-between w-full mb-2 opacity-60">
                      {[4, 8, 6, 10, 12, 5, 3, 6, 4, 2, 8, 5, 7, 11, 9, 4, 6, 8, 3, 5, 7, 10, 6, 4, 8, 5, 9, 7, 4, 6, 8, 11, 5, 3, 7, 9, 6, 4, 8, 5].map((h, i) => (
                        <div key={i} className={`w-0.5 min-[1550px]:w-1 flex-shrink-0 ${i < 13 ? 'bg-[#C48B60]' : 'bg-gray-700'}`} style={{ height: `${h * 3}px` }} />
                      ))}
                    </div>
                    <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-[#C48B60] w-1/3 h-full" />
                    </div>
                    <div className="flex justify-between text-[9px] min-[1550px]:text-[10px] text-gray-500 mt-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                      <span>31:32</span>
                      <span>180:00</span>
                    </div>
                    <div className="flex justify-center gap-4 min-[1550px]:gap-6 mt-3 min-[1550px]:mt-4 text-[#C48B60]">
                      <Rewind className="w-4 h-4 min-[1550px]:w-6 min-[1550px]:h-6 cursor-pointer hover:scale-110 transition-transform" />
                      <Play className="w-6 h-6 min-[1550px]:w-10 min-[1550px]:h-10 cursor-pointer hover:scale-110 transition-transform fill-current" />
                      <Forward className="w-4 h-4 min-[1550px]:w-6 min-[1550px]:h-6 cursor-pointer hover:scale-110 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Center panel - Research Stream */}
                <div className="flex-1 p-4 lg:p-8 bg-[#121212] preserve-3d">
                  <div className="text-center mb-6 lg:mb-12 relative">
                    <span className="absolute top-0 left-0 w-4 h-4 border-t border-l border-[#C48B60]/30" />
                    <span className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[#C48B60]/30" />
                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[#C48B60]/30" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-[#C48B60]/30" />
                    <h2 className="text-xl lg:text-2xl text-[#C48B60] font-light mb-1">Research Stream</h2>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Claims Extracted As You Listen</p>
                  </div>

                  {/* Primary claim card - pop-out effect */}
                  <div className="bg-[#1E1E1E] border border-[#333] p-4 lg:p-6 mb-4 lg:mb-6 rounded shadow-sm pop-out-card relative">
                    <div className="flex justify-between items-center mb-3 lg:mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#C48B60] uppercase tracking-wider">Mechanism</span>
                        <span className="w-2 h-2 bg-[#C48B60] rounded-full opacity-50" />
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="text-xs" style={{ fontFamily: "'Fira Code', monospace" }}>31:10</span>
                        <Bookmark className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                      </div>
                    </div>
                    <h3 className="text-base lg:text-xl font-medium text-gray-200 mb-2 lg:mb-3 leading-snug">
                      Evolution reprograms bodies by changing signals, not physical hardware
                    </h3>
                    <p className="text-gray-400 font-light leading-relaxed mb-4 lg:mb-6 text-sm lg:text-base">
                      "But much of the time it's not by changing the hardware, it's by changing the signals that the cells give to each other... It's doing what we as engineers do, which is try to convince the cells to do various things..."
                    </p>
                    <div className="flex justify-between items-center border-t border-[#333] pt-3 lg:pt-4">
                      <div className="text-xs text-gray-500 flex items-center gap-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                        CONFIDENCE: <span className="text-[#C48B60] font-bold">80%</span>
                        <Info className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                      <button className="text-xs uppercase tracking-wide border border-[#C48B60] text-[#C48B60] px-3 py-1.5 hover:bg-[#C48B60] hover:text-white transition-colors">
                        Dive Deeper
                      </button>
                    </div>
                  </div>

                  {/* Secondary claim card - faded */}
                  <div className="bg-[#1E1E1E] border border-[#333] p-4 lg:p-6 rounded shadow-sm opacity-60 relative">
                    <div className="flex justify-between items-center mb-3 lg:mb-4">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Theoretical</span>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="text-xs" style={{ fontFamily: "'Fira Code', monospace" }}>30:24 - 1 MIN AGO</span>
                        <Bookmark className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-base lg:text-lg font-medium text-gray-300 mb-2 lg:mb-3">
                      Every biological level, from molecules to organs, pursues its own goals
                    </h3>
                    <p className="text-gray-500 font-light text-sm leading-relaxed mb-4">
                      "Biology uses a multi scale competency architecture, meaning that every level has goals. So molecular networks have goals, cells have goals..."
                    </p>
                    <div className="flex justify-between items-center border-t border-[#333] pt-3 lg:pt-4">
                      <div className="text-xs text-gray-600 flex items-center gap-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                        CONFIDENCE: <span className="text-[#C48B60] font-bold">95%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right panel - Research Assistant (hidden below 1550px) */}
                <div className="w-72 lg:w-80 border-l border-[#2a2a2a] bg-[#161616] flex-col hidden min-[1550px]:flex rounded-br-xl">
                  <div className="p-4 border-b border-[#2a2a2a] bg-[#1E1E1E]">
                    <div className="flex items-start gap-3">
                      <div className="p-2 border border-[#C48B60]/30 rounded text-[#C48B60] bg-[#C48B60]/10">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Research Assistant</h4>
                        <p className="text-[9px] uppercase tracking-wider text-gray-500">AI-Powered Analysis</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 lg:p-5 flex-1 flex flex-col gap-4 lg:gap-6 overflow-y-auto">
                    {/* User question */}
                    <div className="flex flex-col items-end">
                      <div className="bg-[#2a2a2a] border border-[#333] p-3 rounded-2xl rounded-tr-sm shadow-sm max-w-[90%] relative group">
                        <p className="text-xs text-gray-300 font-medium leading-relaxed">
                          What is the specific mechanism of cellular reprogramming mentioned here?
                        </p>
                        <div className="absolute -right-1 -top-1 w-2 h-2 bg-[#C48B60] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[9px] text-gray-600 mt-1 mr-1" style={{ fontFamily: "'Fira Code', monospace" }}>12:42 PM</span>
                    </div>

                    {/* AI response */}
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="p-1 bg-[#C48B60]/10 rounded-sm">
                          <Sparkles className="w-3 h-3 text-[#C48B60]" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Noeron AI</span>
                      </div>
                      <div className="text-[13px] text-gray-300 leading-relaxed pr-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                        <p className="mb-3">
                          The mechanism is fundamentally <span className="italic text-[#C48B60] font-medium">bio-electric</span>, not genetic. The guest explains that evolution uses voltage gradients as a control layer:
                        </p>
                        <ul className="space-y-2 mb-4">
                          <li className="flex items-start gap-2.5">
                            <span className="w-1 h-1 rounded-full bg-[#C48B60] mt-2 flex-shrink-0" />
                            <span className="text-gray-400">Cells communicate via ion channels to maintain specific voltage patterns.</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-1 h-1 rounded-full bg-[#C48B60] mt-2 flex-shrink-0" />
                            <span className="text-gray-400">These electrical states serve as "pattern memories" for the target organ shape.</span>
                          </li>
                        </ul>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-[#1E1E1E] border border-[#333] rounded text-[10px] text-gray-500 hover:bg-[#252525] hover:border-[#C48B60] transition-all cursor-pointer group" style={{ fontFamily: "'Fira Code', monospace" }}>
                        <MessageSquare className="w-3 h-3 group-hover:text-[#C48B60]" />
                        <span>Source: Timestamp 31:45</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2 border-t border-[#2a2a2a] bg-[#181818] rounded-br-xl">
                    <div className="text-[9px] uppercase tracking-widest text-center text-gray-600 mb-2">Suggested Prompts</div>
                    <button className="w-full text-left text-xs bg-[#1E1E1E] border border-[#333] p-3 text-gray-400 hover:border-[#C48B60] hover:text-[#C48B60] transition-colors">
                      Explain this claim in simpler terms
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Section 2: Powered by Gemini 3 */}
      <section id="gemini" className="snap-section relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-20 lg:py-28 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
            <div>
              <p className="text-[#C48B60] text-sm tracking-[0.2em] mb-3" style={{ fontFamily: "'Fira Code', monospace" }}>
                POWERED BY GEMINI 3
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                Why Gemini 3 makes this possible
              </h2>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="inline-flex items-center px-4 py-2 bg-[#1E1E1E] border border-[#C48B60]/30 rounded">
                <span className="text-[10px] text-[#C48B60]/70 mr-2" style={{ fontFamily: "'Fira Code', monospace" }}>COST REDUCTION</span>
                <span className="text-2xl font-bold text-[#C48B60]">25x</span>
              </div>
            </div>
          </div>

          {/* Capability cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              {
                icon: <Database className="w-8 h-8" />,
                title: "1M Token Context",
                value: "150+ Papers",
                desc: "Load entire podcast transcripts alongside the full research corpus in a single context window"
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: "Context Caching",
                value: "$2 / 1K queries",
                desc: "Process the paper corpus once, then query thousands of times — making real-time responses economically viable"
              },
              {
                icon: <Brain className="w-8 h-8" />,
                title: "Thinking Levels",
                value: "Medium -> High",
                desc: "Adaptive reasoning depth: fast claim detection with medium thinking, deep synthesis with high thinking"
              },
              {
                icon: <FileJson className="w-8 h-8" />,
                title: "Structured Outputs",
                value: "JSON Schema",
                desc: "Generate context cards with proper citations, confidence scores, and provenance tracking automatically"
              }
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[#1E1E1E] border border-[#333] p-6 hover:border-[#C48B60]/30 transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(196,139,96,0.1)]"
              >
                <div className="text-[#C48B60] mb-4">{item.icon}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                  {item.title}
                </div>
                <div className="text-2xl font-semibold text-white mb-3">{item.value}</div>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Two-pass architecture diagram */}
          <div className="bg-[#1E1E1E] border border-[#C48B60]/30 p-6 lg:p-8 rounded-lg">
            <div className="text-sm tracking-[0.15em] text-[#C48B60] mb-8" style={{ fontFamily: "'Fira Code', monospace" }}>
              TWO-PASS GEMINI ARCHITECTURE
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
              {/* Pass 1 */}
              <div className="bg-[#121212] border border-[#333] p-6 rounded">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#C48B60]/10 border-2 border-[#C48B60] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#C48B60]" style={{ fontFamily: "'Fira Code', monospace" }}>01</span>
                  </div>
                  <div>
                    <div className="text-base font-medium text-white">Claim Detection</div>
                    <div className="text-[11px] text-[#C48B60]" style={{ fontFamily: "'Fira Code', monospace" }}>gemini-3-flash</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400 leading-relaxed space-y-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                  <p><span className="text-gray-600">thinking:</span> <span className="text-[#C48B60]">'medium'</span></p>
                  <p><span className="text-gray-600">input:</span> <span className="text-white">60s window</span></p>
                  <p><span className="text-gray-600">output:</span> <span className="text-white">claims+tags</span></p>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center">
                <div className="w-16 h-1 bg-gradient-to-r from-[#C48B60] to-[#be5a38]" />
                <ChevronRight className="w-6 h-6 text-[#be5a38] -ml-2" />
              </div>
              <div className="md:hidden flex justify-center">
                <ChevronRight className="w-8 h-8 text-[#C48B60] rotate-90" />
              </div>

              {/* Pass 2 */}
              <div className="bg-[#121212] border border-[#be5a38]/30 p-6 rounded">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#be5a38]/10 border-2 border-[#be5a38] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#be5a38]" style={{ fontFamily: "'Fira Code', monospace" }}>02</span>
                  </div>
                  <div>
                    <div className="text-base font-medium text-white">Context Synthesis</div>
                    <div className="text-[11px] text-[#be5a38]" style={{ fontFamily: "'Fira Code', monospace" }}>gemini-3-pro + cache</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400 leading-relaxed space-y-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                  <p><span className="text-gray-600">thinking:</span> <span className="text-[#be5a38]">'high'</span></p>
                  <p><span className="text-gray-600">cached:</span> <span className="text-white">150+ papers</span></p>
                  <p><span className="text-gray-600">output:</span> <span className="text-white">cards+cites</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Technical Stack */}
      <section id="tech-stack" className="snap-section relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-20 lg:py-28 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
            <div>
              <p className="text-[#C48B60] text-sm tracking-[0.2em] mb-3" style={{ fontFamily: "'Fira Code', monospace" }}>
                TECHNICAL STACK
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                How it all fits together
              </h2>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="inline-flex items-center px-4 py-2 bg-[#1E1E1E] border border-[#C48B60]/30 rounded">
                <span className="text-sm text-[#C48B60]" style={{ fontFamily: "'Fira Code', monospace" }}>MCP PROTOCOL</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8">
            {/* Left column: Data Pipeline */}
            <div className="bg-[#1E1E1E] border border-[#333] p-6 lg:p-8">
              <div className="text-sm tracking-[0.15em] text-[#C48B60] mb-8" style={{ fontFamily: "'Fira Code', monospace" }}>
                DATA PIPELINE
              </div>
              <div className="space-y-0">
                {[
                  { step: "01", label: "INGEST", desc: "Semantic Scholar + ArXiv", color: "copper" },
                  { step: "02", label: "EXTRACT", desc: "GROBID TEI Processing", color: "vermillion" },
                  { step: "03", label: "TRANSCRIBE", desc: "AssemblyAI + Diarization", color: "copper" },
                  { step: "04", label: "CHUNK", desc: "400 tokens / 50 overlap", color: "vermillion" },
                  { step: "05", label: "EMBED", desc: "Gemini text-embedding-004", color: "copper" },
                  { step: "06", label: "INDEX", desc: "Supabase pgvector", color: "vermillion" },
                  { step: "07", label: "DETECT", desc: "Gemini Claim Extraction", color: "copper" },
                  { step: "08", label: "VERIFY", desc: "RAG + Citation Scoring", color: "vermillion" },
                ].map((item, i, arr) => (
                  <div key={item.step} className="flex items-stretch gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        item.color === 'vermillion'
                          ? 'border-[#be5a38] bg-[#be5a38]/10'
                          : 'border-[#C48B60] bg-[#C48B60]/10'
                      }`}>
                        <span className={`text-xs font-bold ${item.color === 'vermillion' ? 'text-[#be5a38]' : 'text-[#C48B60]'}`} style={{ fontFamily: "'Fira Code', monospace" }}>
                          {item.step}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[20px] ${
                          item.color === 'vermillion'
                            ? 'bg-gradient-to-b from-[#be5a38] to-[#C48B60]'
                            : 'bg-[#C48B60]/30'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 py-2 border-b border-[#333]/50">
                      <div className="flex justify-between items-baseline gap-4">
                        <span className="text-sm text-white font-medium" style={{ fontFamily: "'Fira Code', monospace" }}>{item.label}</span>
                        <span className="text-sm text-gray-500">{item.desc}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column: Tech specs */}
            <div className="space-y-6">
              {/* Stack Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Backend", value: "Python + FastMCP", desc: "MCP protocol server with HTTP adapter" },
                  { label: "Frontend", value: "Next.js + React", desc: "Real-time sync via API proxy routes" },
                  { label: "Vector Store", value: "Supabase pgvector", desc: "Persistent embeddings + metadata" },
                  { label: "AI Engine", value: "Gemini 3 Pro", desc: "Claim detection + synthesis" },
                ].map((item) => (
                  <div key={item.label} className="bg-[#1E1E1E] border border-[#333] p-5 hover:border-[#C48B60]/30 transition-colors">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                      {item.label}
                    </div>
                    <div className="text-lg font-semibold text-white mb-2">{item.value}</div>
                    <div className="text-sm text-gray-400">{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { value: "500+", label: "Papers Indexed" },
                  { value: "< 3s", label: "Query Latency" },
                  { value: "768", label: "Embedding Dims" },
                ].map((stat, i) => (
                  <div key={stat.label} className="bg-[#1E1E1E] border border-[#333] p-5 text-center">
                    <div className={`text-3xl font-bold mb-2 ${i === 1 ? 'text-[#be5a38]' : 'text-[#C48B60]'}`} style={{ fontFamily: "'Fira Code', monospace" }}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider" style={{ fontFamily: "'Fira Code', monospace" }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* MCP Tools */}
              <div className="bg-[#1E1E1E] border border-[#C48B60]/30 p-6">
                <div className="text-sm tracking-[0.15em] text-[#C48B60] mb-6" style={{ fontFamily: "'Fira Code', monospace" }}>
                  EXPOSED MCP TOOLS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { name: "rag_search", primary: true },
                    { name: "save_paper", primary: false },
                    { name: "save_author_papers", primary: false },
                    { name: "get_saved_paper", primary: false },
                    { name: "list_saved_papers", primary: false },
                    { name: "rag_stats", primary: true },
                  ].map((tool) => (
                    <div key={tool.name} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        tool.primary
                          ? 'bg-[#C48B60] shadow-[0_0_8px_rgba(196,139,96,0.5)]'
                          : 'bg-gray-600'
                      }`} />
                      <span className={`text-sm ${tool.primary ? 'text-white font-medium' : 'text-gray-500'}`} style={{ fontFamily: "'Fira Code', monospace" }}>
                        {tool.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Demo Video */}
      <section id="demo" className="snap-section relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        {/* Bio-texture background with grid, glow, vignette, and noise */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#1a1a1a',
            backgroundImage: `
              radial-gradient(ellipse 100% 60% at 50% 40%, rgba(196, 139, 96, 0.15) 0%, rgba(196, 139, 96, 0.05) 35%, transparent 65%),
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 50px 50px, 50px 50px'
          }}
        >
          {/* Vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.5) 100%)'
            }}
          />
          {/* Noise texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
            }}
          />
        </div>
        <div className="max-w-4xl mx-auto w-full text-center relative z-10">
          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            SEE IT IN ACTION
          </h2>
          <p className="text-gray-400 text-lg mb-12" style={{ fontFamily: "'Fira Code', monospace" }}>
            3 minute walkthrough
          </p>

          {/* Demo video */}
          <div className="relative aspect-video bg-[#1E1E1E] border border-[#333] rounded-lg mb-12 overflow-hidden">
            <video
              controls
              preload="metadata"
              className="w-full h-full object-cover rounded-lg"
              poster="/demo2-poster.jpg"
            >
              <source src="https://lrdfpxvxzqaqbnzcuebj.supabase.co/storage/v1/object/public/public-assets/demo2.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Timestamp markers */}
          <div className="text-left max-w-lg mx-auto mb-12 space-y-3" style={{ fontFamily: "'Fira Code', monospace" }}>
            {[
              { time: "00:00", label: "Podcast begins" },
              { time: "00:45", label: "First claim detected" },
              { time: "01:30", label: "Research surfaces" },
              { time: "02:15", label: "Knowledge graph generates" },
              { time: "03:00", label: "Cross-episode connections" },
            ].map((item) => (
              <div key={item.time} className="flex items-center gap-4 text-sm">
                <span className="text-[#C48B60]">{item.time}</span>
                <span className="text-gray-500">—</span>
                <span className="text-gray-300">{item.label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center px-8 py-4 text-xs uppercase tracking-wide font-medium text-white bg-[#C48B60] border border-[#C48B60] hover:bg-[#A8744F] hover:border-[#A8744F] transition-all shadow-lg hover:shadow-[#C48B60]/20"
            >
              Try Live Demo
            </button>
            <button className="inline-flex items-center justify-center px-8 py-4 text-xs uppercase tracking-wide font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-[#C48B60] hover:border-[#C48B60] hover:text-white transition-all group">
              <Github className="w-4 h-4 mr-2" />
              View on GitHub
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 py-6 border-t border-[#1a1a1a]">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-xs text-gray-600" style={{ fontFamily: "'Fira Code', monospace" }}>
              &lt;/&gt; Built for Gemini 3 Global Hackathon
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
