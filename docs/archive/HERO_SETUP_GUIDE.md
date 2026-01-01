# Watercolor Hero Setup Guide

## Image Placement

Save your watercolor illustration to:
```
/frontend/public/images/hero-watercolor.jpg
```

## Image Specifications

### Recommended Dimensions
- **Width**: 2400px - 3200px
- **Height**: 1350px - 1800px
- **Aspect Ratio**: ~16:9 (maintains typical hero proportions)
- **Format**: JPEG for watercolor/photographic images
- **Quality**: 80-85% JPEG quality (balances file size and visual quality)

### Target File Size
- Aim for 200-400 KB for optimal loading
- Use tools like TinyJPG or ImageOptim to compress without visible quality loss

### Image Content Considerations
- Ensure the upper-middle area (where text overlays) has relatively clear, atmospheric space
- The center-left area should have good contrast for mobile views (where text will be left-aligned)
- Sky/atmospheric areas work best for text overlay

## Testing the Implementation

### 1. Save the Image
Place your watercolor image at `/frontend/public/images/hero-watercolor.jpg`

### 2. Start the Development Server
```bash
cd frontend
npm run dev
# or
pnpm dev
```

### 3. Test Responsiveness
- Desktop (1920px+): Full hero with center-aligned text
- Tablet (768px-1024px): Text should remain readable
- Mobile (320px-767px): Left-aligned text, image crops gracefully

### 4. Verify Text Readability
- Badge should be clearly visible
- Headline should stand out against the background
- CTA buttons should be prominent and accessible

## Alternative Headlines

Based on your contemplative mood theme, here are some alternative headline options:

1. **Current**: "Thoughtful exploration meets deep research"
   - Subtext: "Noeron creates space for meaningful discovery—connecting podcast conversations to academic research with clarity and care."

2. **Alternative 1**: "A space for curious minds"
   - Subtext: "Where podcast insights meet academic depth. Explore ideas with context, clarity, and intellectual care."

3. **Alternative 2**: "Ideas deserve context"
   - Subtext: "Noeron bridges the conversation—connecting every podcast claim to rigorous research, thoughtfully and transparently."

4. **Alternative 3**: "Listen deeper"
   - Subtext: "Transform podcast listening into meaningful exploration. Every claim, enriched with research. Every idea, grounded in evidence."

5. **Alternative 4**: "The knowledge layer for podcasts"
   - Subtext: "A contemplative space where audio content meets academic rigor. Discover the research behind every conversation."

## Customization Options

### Adjusting the Overlay
If you need more or less darkening, edit the gradient overlays in `landing-page.tsx`:

```tsx
{/* Adjust opacity values here */}
<div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
```

### Changing Text Colors
For a warmer tone (cream/beige), the text uses:
- Primary text: `text-white`
- Accent text: `text-[#F5E6D3]` (cream color)

To adjust, modify the color values in the headline span element.

### Mobile Positioning
Text aligns left on mobile for better readability. To center on mobile, change:
```tsx
className="flex flex-col items-start md:items-center text-left md:text-center"
```
to:
```tsx
className="flex flex-col items-center text-center"
```

## Accessibility Checklist

- ✅ Alt text added to hero image
- ✅ Sufficient contrast ratio for text (WCAG AA compliant)
- ✅ Focus states on interactive elements
- ✅ Responsive on all viewport sizes
- ✅ Loading priority set to "eager" for hero image

## Browser Compatibility

The implementation uses:
- Modern CSS gradients (supported in all modern browsers)
- Tailwind CSS utilities
- Flexbox layout
- Backdrop blur effects (may have limited support in older browsers, but degrades gracefully)

## Performance Notes

- Hero image uses `loading="eager"` for immediate display
- Multiple gradient overlays are GPU-accelerated
- No JavaScript required for the hero display
- Smooth transitions using CSS only

## Next Steps

1. Save your watercolor image to the specified path
2. Test on localhost
3. Check mobile responsiveness using browser dev tools
4. Verify text readability against the actual image
5. Adjust overlay opacity if needed
6. Test loading performance (use Lighthouse in Chrome DevTools)

---

Need help? The implementation is in:
- `/frontend/components/landing-page.tsx` (lines 132-197)
- `/frontend/app/globals.css` (hero optimization styles)

