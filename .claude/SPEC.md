# Frontend Design Specification

## Overview

Redesign SurvAgent's frontend to deliver a premium, intentional, and polished experience. The current UI lacks cohesion—this spec defines a unified design system inspired by Linear.app, Cursor.com, and Factory.ai.

---

## Design Philosophy

### Visual Identity
- **Style**: Stripe/Linear aesthetic—bold gradients, tasteful glassmorphism, purposeful micro-interactions
- **Tone**: Premium but approachable, professional but not sterile
- **Logo**: Text wordmark ("SurvAgent" or "Surveyor")—no graphic mark currently

### Target User
Startup founders who are technically literate but time-poor. They expect:
- Fast setup, minimal friction
- Clear value demonstration
- Tools that feel modern and trustworthy

---

## Design System

### Color Palette
**Fresh palette** inspired by current theme but refined for premium feel. Derive from Linear/Cursor aesthetic:
- Rich, saturated primary colors
- Complementary gradients for depth
- Neutral grays with subtle warmth or coolness
- High-contrast text for readability

### Typography
- **Scale**: Moderate hierarchy—clear differentiation without extreme size jumps
- **Feel**: Professional, readable, modern sans-serif
- Ensure sufficient contrast at all sizes

### Gradients
Apply **strategically** based on page importance:
- **Hero sections/headers**: Background gradients for impact
- **CTAs/accent elements**: Gradient buttons, borders, icons
- **Content areas**: Solid backgrounds to maintain readability

### Glass Effects
**Accent only**—avoid overdoing glassmorphism:
- ✅ Modals, tooltips, floating elements
- ✅ Dropdown menus, popovers
- ❌ Main content cards (keep solid)
- ❌ Background areas

### Interactions
**Clear feedback** on all interactive elements:
- Obvious hover state changes (color shifts, shadows)
- Scale transforms on click/tap
- Visible focus states for accessibility
- Smooth transitions (200-300ms ease)

---

## Animation & Performance

### Approach
- **Progressive enhancement**: Detect device capability, show simpler animations on weaker hardware
- **Implementation**: Choose appropriate library (Framer Motion for complex animations, CSS/Tailwind for simple transitions)
- Avoid heavy JS animations that block main thread

### Key Animation Moments
1. **AI Streaming**: Word-by-word text appearance (ChatGPT-style) for both question generation AND transcript analysis
2. **Page transitions**: Subtle fade/slide between views
3. **Loading states**: Skeleton screens with shimmer
4. **Micro-interactions**: Button presses, card hovers, toggle switches

### No Audio
Purely visual feedback—no sound effects or notification sounds.

---

## AI Presence ("AI as Hero")

Claude should feel like a prominent, impressive collaborator:

### Streaming Text Display
- Show output appearing word-by-word in real-time
- Subtle cursor/caret animation at insertion point
- Gentle typing rhythm (not instant, not too slow)

### Visual Indicators
- "Claude is generating questions..." with animated indicator
- "Analyzing transcript..." with progress visualization
- Consider animated AI avatar/icon during processing

### Result Presentation
- Make AI-generated content feel valuable
- Clear delineation between user input and AI output
- Subtle animations when content appears

---

## Navigation & Information Architecture

### Hybrid Wizard → Dashboard

**First-time users**: Guided wizard flow
1. Create Brief → 2. Review Questions → 3. Share Interview → 4. View Results

**Returning users**: Dashboard hub with:
- Session cards showing status
- Quick actions for common tasks
- Recent activity

### Mode Switching
- **Auto-unlock**: Dashboard available after first complete cycle
- **User control**: Can switch back to wizard view anytime
- Persist preference

---

## Page-Specific Requirements

**Investment level**: All pages equally premium—consistent quality throughout.

### Brief Creation Page
- **Form UX**: Contextual tips (helper text, character counts, examples on focus)
- Clean, spacious input fields
- Smart sectioning of research brief components
- Encouraging empty state if starting fresh

### Question Review Page
- **Full editing capability**: Drag-reorder, inline edit, add/remove questions
- Clear visual hierarchy for sections vs. individual questions
- AI regeneration option for specific questions or entire script
- Preview mode to see interview flow

### Interview Sharing
- **Shareable links**: Generate unique URLs (PIN hidden in URL parameter)
- **Link expiry**: Never expire (valid until manually disabled)
- Copy-to-clipboard with feedback
- QR code generation option

### Live Session Status
- **Real-time counter**: Live count of completed interviews, updating automatically
- Visual indication of active interviews
- Timestamp of last activity

### Scorecard/Results Page
- **Insight-led display**: Synthesized takeaways first
- Expandable sections to reveal supporting quotes
- **Single session focus**: Deep dive into one research session
- Export/share options for insights

### Interview Experience (Respondent-Facing)
- **Simplified version**: Same color palette but reduced visual complexity
- Focus on the conversation, minimal UI chrome
- Clear audio/recording indicators
- Accessible and distraction-free

---

## Empty States

**Tone**: Encouraging and motivational
- "Your insights await!"
- Clear primary CTA to start
- Brief explanation of what happens next
- Optional illustration (not required)

---

## Error Handling

**Tone**: Friendly recovery
- "Oops! Let's try that again"
- Non-alarming, casual language
- Clear recovery action
- Avoid technical jargon in error messages
- Inline errors where possible (avoid modal interruptions)

---

## Responsive Design

### Desktop (Primary)
Full functionality, optimized layouts

### Mobile (Read-Only)
- View results/insights ✅
- Check session status ✅
- Create/edit briefs ❌ (show desktop prompt)
- Edit questions ❌ (show desktop prompt)
- Clear messaging: "For the best experience, create research briefs on desktop"

---

## Accessibility

**Standard**: WCAG 2.1 AA compliance
- Sufficient color contrast ratios
- Keyboard navigable
- Focus indicators
- Alt text for meaningful images
- Semantic HTML structure
- Screen reader compatible

---

## Technical Constraints

### Dark Mode
**Light only**—no dark mode implementation needed. Simplifies development and testing.

### Animation Library
Implementer's choice based on requirements:
- Complex sequences → Framer Motion
- Simple transitions → CSS/Tailwind
- Balance bundle size vs. capability

### Onboarding
**None needed**—UI should be intuitive. If users struggle, that's a design problem to fix, not an onboarding problem to bandage.

---

## Design References

Study these products for inspiration:
1. **Linear.app** - Clean layouts, smooth animations, professional feel
2. **Cursor.com** - AI-forward design, premium dark aesthetic elements (adapt for light theme)
3. **Factory.ai** - Modern AI product design patterns

---

## Implementation Priority

All pages should feel equally polished, but if sequencing is needed:

1. **Design system foundation** - Colors, typography, spacing, components
2. **Brief creation** - First user touchpoint
3. **Question review** - Core editing experience
4. **Scorecard** - Value demonstration
5. **Interview experience** - Respondent-facing
6. **Dashboard view** - Returning user experience

---

## Success Criteria

The redesign is successful when:
- [ ] First impression feels premium and intentional
- [ ] Visual cohesion across all pages
- [ ] AI moments feel impressive and valuable
- [ ] Startup founders can complete flows without confusion
- [ ] Mobile users can meaningfully view results
- [ ] No accessibility regressions
- [ ] Performance remains acceptable on mid-range devices
