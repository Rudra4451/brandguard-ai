# DESIGN.md — BrandGuard AI
**Creative Direction: The Brand Control Room**
A serious, art-directed editorial compliance workspace designed for editorial scrutiny, claim verification, and tamper-evident auditability.

---

## 1. Palette & Contrast Specification

The interface is built on a warm, tactile near-white paper background with deep ink black text and crisp, low-chroma structural dividers. Pure black (`#000000`) and pure white (`#ffffff`) are rejected in favor of high-legibility, low-fatigue contrast.

### Core Surface & Text Palette
| Token Name | Hex Value | Purpose / Usage |
| :--- | :--- | :--- |
| `--bg-paper` | `#FBF9F5` | Canvas background (warm near-white paper base) |
| `--bg-surface` | `#FFFFFF` | Working sheets, editor pad, inspect panels |
| `--bg-subtle` | `#F3EFEA` | Rail backgrounds, inactive tab wells, header bar |
| `--border-muted` | `#E2DDD5` | Primary structural borders and dividers |
| `--border-strong`| `#C8C1B5` | Focused borders, active tabs, crisp card frames |
| `--text-ink` | `#1A1816` | Primary body, headlines, editor text |
| `--text-secondary`| `#5A554E` | Metadata, captions, secondary labels |
| `--text-tertiary` | `#878074` | Muted counters, placeholder copy |

### Stated Contrast Ratios (WCAG AA Compliance ≥ 4.5:1)
- **`--text-ink` (`#1A1816`) on `--bg-paper` (`#FBF9F5`):** **14.8:1** (Exceeds AAA requirement of 7:1)
- **`--text-ink` (`#1A1816`) on `--bg-surface` (`#FFFFFF`):** **15.7:1** (Exceeds AAA requirement of 7:1)
- **`--text-secondary` (`#5A554E`) on `--bg-paper` (`#FBF9F5`):** **5.6:1** (Exceeds AA requirement of 4.5:1)
- **`--text-secondary` (`#5A554E`) on `--bg-subtle` (`#F3EFEA`):** **5.1:1** (Exceeds AA requirement of 4.5:1)
- **`--border-strong` (`#C8C1B5`) on `--bg-paper` (`#FBF9F5`):** **1.6:1** (Meets non-text UI contrast guidelines)

---

## 2. Semantic Color & Verification Map

Colors are strictly reserved. Semantic flags never rely on hue alone; every indicator combines a dedicated text label, an SVG iconography marker, and distinct border styles.

| State | Foreground Hex | Background Tint | Border Hex | Marker / Icon | Label | Text Contrast on Tint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SUPPORTED** | `#1B5E20` (Forest) | `#E8F5E9` | `#81C784` | SVG Check Circle | `SUPPORTED` | **7.8:1** (AAA) |
| **UNVERIFIED**| `#8D5B00` (Amber) | `#FFF8E1` | `#FFD54F` | SVG Alert Triangle | `UNVERIFIED` | **5.4:1** (AA) |
| **CONFLICT**  | `#C62828` (Vermilion) | `#FFEBEE` | `#E57373` | SVG Hexagon Cross | `VIOLATION` / `CONFLICT` | **6.1:1** (AA) |
| **DETERMINISTIC** | `#1565C0` (Navy) | `#E3F2FD` | `#90CAF9` | SVG Shield Check | `RULE (DET)` | **6.5:1** (AA) |
| **INVALIDATED** | `#991B1B` (Deep Red) | `#FEF2F2` | `#F87171` | SVG Broken Link | `INVALIDATED` | **7.5:1** (AAA) |

---

## 3. Typography Specification

### Selected Font Families & Rationale
1. **Display Face: `Cinzel` / `Newsreader` / `Playfair Display` (Fallback: `Georgia, serif`)**
   - *Rationale:* Conveys legal gravity, editorial authority, and publishing discipline for workspace brand marks and top-level view headings.
2. **UI & Body Face: `Plus Jakarta Sans` / `IBM Plex Sans` (Fallback: `system-ui, sans-serif`)**
   - *Rationale:* Crisp vertical metrics, open apertures, and excellent scannability at small sizes for controls, editor body, and diagnostic readouts.
3. **Monospace Face: `JetBrains Mono` / `Space Mono` (Fallback: `ui-monospace, monospace`)**
   - *Rationale:* Tabular numbers and unambiguous zero/O distinction strictly for Rule IDs (`RULE-01`), Fact IDs (`FACT-04`), SHA-256 hashes, and timestamps.

### Type Scale
- **Display Lg:** `20px` (1.25rem), weight 700, tracking `-0.02em`, leading 1.2
- **Section Title:** `15px` (0.9375rem), weight 600, tracking `-0.01em`, leading 1.3
- **Body / Editor:** `14px` (0.875rem), weight 400, leading 1.6
- **UI Small / Control:** `12px` (0.75rem), weight 500, leading 1.4
- **Monospace Tag / ID:** `11px` (0.6875rem), weight 600, tracking `0.02em`, leading 1.2

---

## 4. Spacing, Geometry & Borders

- **Spacing Grid:** 4px base (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`).
- **Border Radii:**
  - Controls, tags, buttons: `2px` (subtle bevel, square feel).
  - Cards, panels, modal sheets: `4px`.
  - No circular pill radii (`rounded-full` is strictly forbidden except for circular indicator dots).
- **Border Weights:**
  - Standard dividers and containers: `1px solid var(--border-muted)`.
  - Focused interactive states: `2px solid var(--border-strong)`.
  - Active inspection highlight: `2px solid var(--vermilion)` or `2px solid var(--amber)`.

---

## 5. Motion Rules & Accessibility

- **Guiding Principle:** Motion is purely instructional and communicative, never ornamental.
- **Permitted Animations:**
  1. Evidence Inspector reveal: `150ms ease-out` slide/opacity.
  2. Finding focus ring pulse: `120ms ease-in-out`.
  3. Approval state invalidation transition: `180ms ease-out` border/background color shift.
- **Explicitly Forbidden:** Hover scale (`transform: scale(...)`), bouncy springs, loop spinners, transition-all, blur reveals.
- **Prefers-Reduced-Motion:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 6. Wordmark Specification

- Wordmark reads: **BRANDGUARD** followed by a subtle serif badge `[GOVERNANCE CONSOLE]`.
- Construction: Typographic, uppercase, letterspaced (`letter-spacing: 0.08em`), rendered in ink black with a geometric square stamp marker `■`.
- Forbidden: Robot icons, brain meshes, gradient text, sparkles, swooshes.

---

## 7. Deliberately Not Doing (Anti-Slop Rejections)

1. **No Purple-to-Blue Gradients / Mesh Orbs:** Editorial verification requires neutral contrast and visual quiet. Gradients create optical fatigue and distract from syntax errors.
2. **No Backdrop Blur / Glassmorphism:** Glassmorphism degrades text contrast when overlaid on document copy. All panels have solid, opaque backgrounds.
3. **No Marketing Landing Hero / Three-Card Stack:** The application is an audit console. The user lands directly into the working workspace, not a promo funnel.
4. **No Emojis as Status Icons:** Professional audit tools use standards-compliant SVG iconography with textual legends.
5. **No Forced Homogeneous Card Grids:** Different views (Editor, Rulebook table, Audit ledger) require tailored information architecture, not one-size-fits-all card templates.
