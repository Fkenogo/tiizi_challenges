---
name: High-Energy Kinetic
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#5a4136'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#505f76'
  on-tertiary: '#ffffff'
  tertiary-container: '#8a9ab2'
  on-tertiary-container: '#223246'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  page-margin: 1.5rem
  card-padding: 1rem
  stack-gap: 0.75rem
  section-gap: 1.5rem
  touch-target: 3rem
---

## Brand & Style
The design system is engineered for a high-performance fitness community. It utilizes a **Corporate / Modern** aesthetic infused with high-energy accents to motivate and engage users. The primary goal is to provide a clear, data-driven environment that feels both professional and athletic. 

The visual language relies on a structured hierarchy of information, using card-based containers to compartmentalize complex data into digestible chunks. The interface should feel fast, responsive, and optimistic, balancing the reliability of dark slate typography with the urgency of a vibrant orange primary color.

## Colors
The palette is dominated by a light, clean background to maximize legibility and perceived space.
- **Primary:** A high-saturation orange (#FF6B00) used for key actions, progress indicators, and active states.
- **Secondary:** Dark Slate (#1E293B) provides strong contrast for primary text and headings, ensuring high readability.
- **Tertiary:** Medium Slate (#64748B) is reserved for secondary information, labels, and metadata.
- **Background:** Light Gray (#F8FAFC) serves as the base canvas, with pure white (#FFFFFF) used for elevated card surfaces.

## Typography
This design system uses **Plus Jakarta Sans** for its modern, approachable, and geometric qualities. 
- **Headlines:** Use Bold (700) weight for clear section identification.
- **Labels:** Small caps with increased letter spacing are used for tertiary headers (e.g., "CHALLENGE DETAIL") to provide a distinct stylistic break from body copy.
- **Readability:** Body text uses a standard 14px size for optimal mobile density, paired with a generous line height to prevent visual fatigue during data entry or reading.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for mobile-first consumption. 
- **Margins:** Global horizontal margins are set to 24px (1.5rem) to provide breathing room.
- **Gaps:** Elements within cards are spaced with a 12px (0.75rem) gap, while major sections or cards are separated by 24px (1.5rem).
- **Mobile Reflow:** For mobile, all primary buttons are full-width to provide an accessible touch target. Data grids (like participant stats) should collapse into a single column or scrollable horizontal list if they exceed 3 items.

## Elevation & Depth
Depth is created through **Tonal Layers** rather than heavy shadows. 
- **Level 0 (Background):** #F8FAFC.
- **Level 1 (Cards):** Pure White (#FFFFFF) with a very soft, 4px blur ambient shadow (5% opacity) to provide a subtle lift from the background.
- **Level 2 (In-Card Elements):** Light gray borders (#E2E8F0) or subtle fills are used to define sub-sections within a card, creating a "nested" look without adding vertical height.

## Shapes
The design system employs a **Rounded** corner strategy.
- **Primary Cards:** Use a 16px (1rem) radius to feel friendly and modern.
- **Secondary Elements:** Sub-containers and input fields also utilize a 16px radius for consistency across the UI.
- **Interactive Elements:** Buttons maintain a 12px to 16px radius, ensuring they harmonize with the container shapes.

## Components
- **Buttons:** 
  - *Primary:* Solid Orange (#FF6B00) background, White text, Bold.
  - *Secondary:* Light Slate (#F1F5F9) background, Dark Slate text.
  - *Danger:* Soft Red tint background, Dark Red text.
- **Cards:** White surfaces with 16px padding. Use a 1px border (#E2E8F0) for definition on light backgrounds.
- **Bottom Navigation:** Fixed to the bottom of the screen. Icons are centered. The (+) button should be visually distinct, perhaps using the Primary Orange color as a circular float or a prominent central icon.
- **Input Fields:** 16px rounded corners, 1px light border, with labels placed above in the `label-caps` style.
- **Chips/Badges:** Used for "Type" or "Status." Small, 12px rounded corners, using light tints of the primary or semantic colors.