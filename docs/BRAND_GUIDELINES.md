# MyTools Admin — Brand Guidelines

## Brand Identity

**App Name:** MyTools Admin  
**Tagline:** Built for Performance  
**Product Type:** B2B Mobile App — Garage Management  
**Target Audience:** Garage owners and administrators (France)

---

## Logo

### Primary Logo
- File: `assets/images/logo_new.png`
- Usage: App icon, splash screen, marketing materials
- Minimum size: 32×32px (app header), 512×512px (App Store)

### Logo Clearance
- Minimum clear space: Equal to the height of the "M" in MYTOOLS on all sides
- Never place the logo on a light background without a dark container
- Never distort, rotate, or recolor the logo

---

## Color Palette

### Primary Colors

| Name         | Hex       | RGB              | Usage                           |
|--------------|-----------|------------------|---------------------------------|
| Brand Red    | `#DC2626` | rgb(220, 38, 38) | Primary actions, CTAs (light)   |
| Vivid Red    | `#EF4444` | rgb(239, 68, 68) | Primary actions, CTAs (dark)    |
| Accent Red   | `#F87171` | rgb(248, 113, 113)| Hover states, secondary accents |
| Deep Red     | `#B91C1C` | rgb(185, 28, 28) | Active states, dark mode        |

### Background Colors

| Name         | Hex       | Usage                        |
|--------------|-----------|------------------------------|
| Black Base   | `#0A0A0A` | Main background (dark mode)  |
| Dark Surface | `#161616` | Card/surface backgrounds     |
| Elevated     | `#1C1C1C` | Secondary surfaces           |
| Pure White   | `#F6F6F8` | Main background (light mode) |
| White Surface| `#FFFFFF` | Card/surface (light mode)    |

### Text Colors

| Name           | Hex       | Usage                     |
|----------------|-----------|---------------------------|
| Primary Text   | `#F0F0F0` | Headlines (dark mode)     |
| Secondary Text | `#A8A8A8` | Body text (dark mode)     |
| Tertiary Text  | `#666666` | Captions, labels          |
| Primary Text L | `#0A0A0A` | Headlines (light mode)    |
| Secondary Text L| `#444444`| Body text (light mode)   |

### Status Colors

| Name     | Hex       | Usage                        |
|----------|-----------|------------------------------|
| Success  | `#22C55E` | Paid, confirmed, active      |
| Warning  | `#F59E0B` | Pending, awaiting            |
| Error    | `#F87171` | Rejected, overdue, cancelled |
| Info     | `#3B82F6` | Neutral info states          |

---

## Typography

### Font Stack

```
Title / Brand: Michroma (Google Font — Regular 400)
Body:          Inter (Google Font — 400, 500, 600, 700)
Monospace:     SF Mono / Courier New (for code/IDs)
```

### Type Scale

| Level      | Font        | Size | Weight | Usage                        |
|------------|-------------|------|--------|------------------------------|
| Display    | Michroma    | 28px | 400    | App name, hero titles        |
| H1         | Inter       | 24px | 700    | Screen titles                |
| H2         | Inter       | 20px | 600    | Section headers              |
| H3         | Inter       | 17px | 600    | Card titles, list headers    |
| Body Large | Inter       | 16px | 400    | Primary body text            |
| Body       | Inter       | 14px | 400    | Standard body                |
| Caption    | Inter       | 12px | 500    | Labels, metadata, badges     |
| Micro      | Inter       | 11px | 600    | ALL CAPS section labels      |

### Typography Rules
- Section labels: UPPERCASE + letter-spacing: 0.8px + Inter 600 11px
- App name in UI: Michroma + spacing (e.g., "M Y T O O L S")
- Monospace for IDs, invoice numbers, client codes

---

## Spacing System

```
4px  — Micro gap (icon padding)
8px  — Tight gap (related elements)
12px — Small gap (list items, pills)
16px — Base unit (standard padding, card content)
20px — Medium (section padding)
24px — Large (screen margins, section gaps)
32px — XL (section separators)
48px — XXL (hero spacing, major sections)
```

---

## Border Radius

```
6px   — Small elements (badges, pills)
10px  — Inputs, small cards
12px  — Standard cards
14px  — Feature cards
16px  — Hero cards
20px  — Large panels
999px — Fully rounded buttons/tags
```

---

## Iconography

- **Library:** Ionicons (via @expo/vector-icons)
- **Stroke style:** Outline by default, filled for active/selected states
- **Size:** 20–24px in lists, 18px in buttons, 28–32px in hero sections
- **Color:** Inherits text color or primary red for accents

### Icon-to-feature mapping
```
document-text-outline → Quotes (Devis)
receipt-outline       → Invoices (Factures)
calendar-outline      → Reservations (Rendez-vous)
people-outline        → Clients
bar-chart-outline     → Analytics (Dashboard)
settings-outline      → Settings
car-outline           → Vehicle/Service
```

---

## Visual Tone & Style

- **Dark-first design** — optimized for night use in garage environments
- **Minimal, information-dense** — every pixel serves a purpose
- **iOS native feel** — grouped lists, SF-style layouts, no superfluous decoration
- **Red as power** — red signals action, urgency, and performance
- **Data-driven** — charts, KPIs, status badges are first-class citizens

### Do's
✅ Use bold, clear typography on dark backgrounds  
✅ Use red sparingly — only for primary CTAs and critical actions  
✅ Pair icon + text for actions in lists  
✅ Use subtle borders (1px) over heavy shadows  
✅ Show status via colored badges (paid/pending/overdue)

### Don'ts
❌ Never use red for decorative purposes  
❌ Never use white backgrounds with default dark components  
❌ Never use all-caps beyond micro labels  
❌ No gradients on functional UI elements  
❌ No drop shadows heavier than `0 2px 8px rgba(0,0,0,0.3)`

---

## Social & Marketing Colors

For marketing site and social media:
- Background: `#0A0A0A`
- Hero gradient: `linear-gradient(135deg, #0A0A0A 0%, #1A0505 50%, #0A0A0A 100%)`
- Glow effect: `radial-gradient(circle at 50% 40%, rgba(220,38,38,0.15) 0%, transparent 70%)`
- CTA button: `background: #DC2626`, hover: `#B91C1C`

---

## Brand Voice

- **Professional** — precise, confident, no fluff
- **French-first** — primary language is French (audience: France)
- **Automotive** — uses performance vocabulary
- **Authoritative** — "Built for Performance" conveys mastery
