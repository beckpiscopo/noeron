# Noeron Style Integration Guide

## Step 1: Update globals.css

Replace your current `globals.css` with `noeron-updated-globals.css`

**Location:** `app/globals.css` (or wherever your globals.css lives)

**What changed:**
- Background: `#1D1E20` (carbon black)
- Foreground: `#F2E9E4` (parchment)
- Primary: `#BE7C4D` (golden chestnut)
- Destructive: `#BE5A38` (rosy copper)
- Secondary: `#6B5D52` (warm gray)
- Border radius reduced to `2px` for sharper, technical look

## Step 2: Add Extended Styles

Create a new file: `app/noeron.css`

Copy the contents of `noeron-extended.css` into this file.

Then import it in your root layout:

```tsx
// app/layout.tsx
import './globals.css'
import './noeron.css'  // Add this line

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

## Step 3: Update Tailwind Config (Optional)

If you want direct access to Noeron colors in Tailwind classes, add to `tailwind.config.ts`:

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        'carbon-black': '#1D1E20',
        'parchment': '#F2E9E4',
        'golden-chestnut': '#BE7C4D',
        'rosy-copper': '#BE5A38',
        'warm-gray': '#6B5D52',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
}
```

Now you can use: `bg-carbon-black`, `text-golden-chestnut`, `font-display`, etc.

## Step 4: Create Landing Page Component

Create: `app/page.tsx` (or `app/landing/page.tsx`)

Use the horizontal slider structure from `noeron-horizontal-landing.html`

**Basic structure:**

```tsx
export default function LandingPage() {
  return (
    <div className="noeron-theme">
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-6 backdrop-blur-lg bg-carbon-black/90 border-b border-parchment/10">
        <div className="font-display text-lg tracking-widest text-parchment">
          NOERON
        </div>
        <button className="btn-noeron-secondary">
          Access Demo →
        </button>
      </nav>

      <div className="slider-container" id="slider">
        {/* Hero Section */}
        <section className="slider-section section-dark">
          <div className="blueprint-pattern" />
          <div className="text-center max-w-4xl">
            <div className="eyebrow eyebrow-ornament mb-10">
              Epistemological Infrastructure
            </div>
            <h1 className="text-8xl font-display mb-8 text-parchment">
              NOERON
            </h1>
            <p className="text-xl text-parchment/85 mb-12">
              The knowledge layer for podcasts.<br />
              Bridging thoughtful exploration with rigorous evidence.
            </p>
            {/* Add CTAs, loading text, etc. */}
          </div>
        </section>

        {/* More sections... */}
      </div>

      {/* Dot Navigation */}
      <div className="dot-nav">
        <button className="dot active" />
        <button className="dot" />
        {/* More dots... */}
      </div>
    </div>
  )
}
```

## Step 5: Add Slider Logic

Create: `components/HorizontalSlider.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'

export function HorizontalSlider({ sections }: { sections: React.ReactNode[] }) {
  const [currentSection, setCurrentSection] = useState(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentSection(prev => Math.min(prev + 1, sections.length - 1))
      } else if (e.key === 'ArrowLeft') {
        setCurrentSection(prev => Math.max(prev - 1, 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sections.length])

  return (
    <>
      <div 
        className="slider-container"
        style={{ transform: `translateX(-${currentSection * 100}vw)` }}
      >
        {sections}
      </div>

      <div className="dot-nav">
        {sections.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === currentSection ? 'active' : ''}`}
            onClick={() => setCurrentSection(i)}
            aria-label={`Section ${i + 1}`}
          />
        ))}
      </div>
    </>
  )
}
```

## Quick Wins (Immediate Visual Impact)

**1. Update any existing buttons:**
```tsx
// Before
<button className="bg-primary text-primary-foreground">Click</button>

// After
<button className="btn-noeron-primary">Click</button>
```

**2. Add blueprint patterns to sections:**
```tsx
<section className="relative section-dark">
  <div className="blueprint-pattern" />
  {/* Your content */}
</section>
```

**3. Use eyebrow text for section labels:**
```tsx
<div className="eyebrow eyebrow-ornament mb-8">
  Technical Implementation
</div>
```

**4. Apply mono font to technical elements:**
```tsx
<div className="mono text-sm text-golden-chestnut">
  // SYSTEM: ONLINE
</div>
```

## Testing Checklist

- [ ] Colors updated globally
- [ ] Typography loads correctly (Space Grotesk, IBM Plex)
- [ ] Buttons have new styling
- [ ] Blueprint patterns visible on dark sections
- [ ] Horizontal slider works with keyboard navigation
- [ ] Dot navigation shows/updates correctly
- [ ] Mobile responsive (single column stacking)

## Next Steps

1. Replace placeholder content with real Noeron data
2. Add actual demo video/screenshots
3. Implement backend API connections if needed
4. Add page transitions and polish animations
5. Set up deployment (Vercel/Netlify)

## Color Usage Guidelines

**Primary (Golden Chestnut):** 5-10% of design
- Interactive elements (buttons, links)
- Active states
- Key metrics/stats

**Rosy Copper:** 1-2% of design
- Rare highlights only
- Special callouts
- Error states

**Backgrounds:**
- Dark sections: Carbon black
- Light sections: Parchment
- Alternate: Dark gray

## Questions?

If anything is unclear or you run into issues, let me know!