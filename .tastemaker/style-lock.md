# Style lock - TaskTape

Established: 2026-07-14. Source: product brief plus starter scaffolding, adjusted for a native professional desktop tool.

## Palette

- Background: #F5F7F5
- Surface: #FFFFFF
- Surface subtle: #EEF3EF
- Primary: #176B4B
- Secondary: #DDEBE4
- Accent: #D55D3F
- Text primary: #172019 - 15.52:1 against background
- Text muted: #66716A
- Border: #D8DFDA
- Button label: #FFFFFF - 6.48:1 against Primary
- Dark mode: not in the initial product scope

## Typography

- Display and body: macOS system sans stack for a native desktop feel
- Data and technical details: SF Mono when introduced
- Scale: compact desktop hierarchy, 15px body and 1.2 heading ratio

## Shape language

- Radius: 5px controls, 8px framed tools
- Shadow: flat by default; one restrained shadow for captured-screen media
- Borders: 1px hairlines provide structure

## Density and spacing

- Base unit: 8px
- Overall density: quiet, efficient, and scannable

## Mood descriptors

Grounded, capable, transparent, native.

## Assets

- Anchor asset: the live recorder and workflow recipe UI
- Icons: Lucide, 1.5-2px outline stroke
- Logo: overlapping tape-frame mark constructed in CSS for the shell; exportable vector mark is pending
- Photography and illustrations: not appropriate for the focused desktop application surface

## Motion

- Feel: quick and restrained
- Entrance: 420ms with an 8px rise
- Easing: cubic-bezier(0.16, 1, 0.3, 1)
- Always respect reduced-motion preferences

## Do not

- No purple or blue gradient branding.
- No oversized marketing typography inside the desktop tool.
- No decorative cards, floating sections, or pill-shaped text controls.
- No opaque automation state; uncertainty and unavailable features stay visible.
