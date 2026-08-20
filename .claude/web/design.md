# ZFlap Web — Design Reference

A single source of truth for visual and interaction decisions. Update this when something changes; don't drift from it silently.

---

## 1. Design Tokens

All tokens live in `src/index.css` as CSS custom properties on `:root`.

### Color

| Token | Value | Use |
|---|---|---|
| `--orange` | `#F97316` | Primary accent, CTAs, active states |
| `--orange-dark` | `#EA6C0A` | Button hover, darker accent |
| `--orange-deeper` | `#C2540A` | Pressed states |
| `--orange-light` | `#FFF7ED` | Tinted backgrounds (pills, active cells) |
| `--orange-glow` | `rgba(249,115,22,0.08)` | Halos behind active elements |
| `--orange-border` | `rgba(249,115,22,0.22)` | Borders on orange-tinted surfaces |
| `--bg` | `#FAF9F7` | Page background |
| `--bg-card` | `#FFFFFF` | Panel / card surfaces |
| `--bg-card-hover` | `#F7F5F2` | Card hover fill |
| `--bg-input` | `#F3F1ED` | Input field fill, inactive cells |
| `--bg-sunken` | `#F0EDE8` | Recessed areas (tape background) |
| `--border` | `#E6E2DA` | Default borders |
| `--border-light` | `#D9D4CB` | Hover borders |
| `--text` | `#1A1814` | Body text |
| `--text-muted` | `#6B6459` | Secondary text, labels |
| `--text-dim` | `#AAA49A` | Placeholder, hints, disabled |
| `--green` | `#16A34A` | Accept / success |
| `--green-bg` | `rgba(22,163,74,0.07)` | Accept background tint |
| `--red` | `#DC2626` | Reject / error |
| `--red-bg` | `rgba(220,38,38,0.07)` | Reject background tint |
| `--blue` | `#2563EB` | Running / neutral info state |

### Shape

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `6px` | Buttons, badges, cells |
| `--radius-md` | `10px` | Larger buttons, inputs |
| `--radius-lg` | `16px` | Cards, demo panels |
| `--radius-xl` | `22px` | Sheet-level containers |

### Typography

| Use | Font | Weight | Size |
|---|---|---|---|
| Body | Inter | 400 | 16px base |
| UI labels | Inter | 500–600 | 12–14px |
| Headings | Inter | 700–800 | varies |
| Code / monospace | JetBrains Mono | 400–500 | 12–16px |

---

## 2. Component Patterns

### Buttons

Four variants — all defined in `HomePage.module.css` via `composes`:

| Class | Size | Use |
|---|---|---|
| `.btnPrimary` | sm (14px, 10/20px pad) | Default CTA |
| `.btnPrimaryLg` | lg (16px, 13/28px pad) | Hero CTA |
| `.btnGhost` | sm | Secondary action |
| `.btnGhostLg` | lg | Secondary hero action |

Primary buttons carry an orange box-shadow `0 1px 3px rgba(249,115,22,0.25), 0 4px 12px rgba(249,115,22,0.15)`.

### Badges

Small monospace labels that identify automaton type (DFA, TM, etc.):

```css
font-size: 10px; font-weight: 700; font-family: JetBrains Mono;
padding: 2px 8px; border-radius: 4px;
```

Accent color per type:

| Type | Color | Background | Border |
|---|---|---|---|
| DFA / NFA | `#2563EB` (blue) | `rgba(37,99,235,0.08)` | `rgba(37,99,235,0.2)` |
| PDA | `#34D399` (green) | `rgba(52,211,153,0.08)` | `rgba(52,211,153,0.2)` |
| TM | `#92570A` (warm gold) | `rgba(240,207,96,0.15)` | `rgba(240,207,96,0.4)` |

### State path chips

Monospace chips showing the state trail during simulation:

```css
font-family: JetBrains Mono; font-size: 12px; padding: 2px 8px; border-radius: 4px;
background: var(--bg-input); border: 1px solid var(--border); color: var(--text-muted);
```

Current state gets `--orange-light` fill, `--orange-border` border, `--orange-dark` text.

### Result banners

Accept / reject notifications with full-width layout inside a bordered section:

```css
font-size: 13px; font-weight: 600; font-family: JetBrains Mono;
padding: 7px 12px; border-radius: var(--radius-sm); animation: slideIn 0.15s ease;
```

Use `--green` / `--green-bg` for accept; `--red` / `--red-bg` for reject.

### Cards / panels

Default surface: `background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg)`.
Box shadow for elevated panels: `0 1px 4px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08)`.

---

## 3. SVG Diagram Colors (light theme)

The DfaDemo currently renders with hardcoded dark-background colors (`rgba(255,255,255,...)`, `#13151E`). When building the real editor canvas, use these values instead:

| Element | Default | Visited | Active |
|---|---|---|---|
| State fill | `var(--bg-card)` | `var(--orange-light)` | `var(--orange-light)` |
| State stroke | `var(--border)` | `var(--orange-border)` | `var(--orange)` |
| State label | `var(--text-muted)` | `var(--orange-dark)` | `var(--orange-dark)` |
| Final outer ring | `var(--border)` | `var(--orange-border)` | `var(--orange)` |
| Edge / arrow | `var(--border-light)` | — | `var(--orange)` |
| Edge label | `var(--text-dim)` | — | `var(--orange-dark)` |
| Initial arrow | `var(--text-dim)` | — | — |
| Arrowhead fill | `var(--border-light)` | — | `var(--orange)` |
| Active glow | — | — | `var(--orange-glow)` |

State radius: `28px`. Font: Inter 14px 600 for labels.

---

## 4. Editor Page Layout

Route: `/editor`  
Behavior: full viewport height, no page scroll. All scrolling happens inside panels.

```
┌────────────────────────────────────────────────────────────────┐
│  TOPBAR  (60px, sticky)                                        │
│  [Zed logo + name] [automaton name — editable] [type badge]   │
│  ──────────────────────────────────────────────────────────── │
│  [Select][Add State][Add Trans][Delete]   [Undo][Redo]        │
│                                           [Save][Load][Export] │
├──────────────────┬─────────────────────────────────────────────┤
│  LEFT PANEL      │                                             │
│  (280px, fixed)  │             CANVAS                          │
│                  │             (flex 1, overflow hidden)        │
│  ┌─ Alphabet ──┐ │                                             │
│  │ (a, b, c)  │ │   · SVG with pan + zoom                     │
│  └────────────┘ │   · States as draggable circles              │
│                  │   · Transitions as bezier arcs              │
│  ┌─ States ───┐ │   · Initial arrow + final double ring        │
│  │ q0 ● init │ │   · Active state/edge highlighted orange     │
│  │ q1 ◎ final│ │                                             │
│  └────────────┘ │                                             │
│                  │                                             │
│  ┌─ Test ─────┐ │                                             │
│  │ input w =  │ │                                             │
│  │ [result]   │ │                                             │
│  └────────────┘ │                                             │
│                  │                                             │
│  ┌─ Examples ─┐ │                                             │
│  │ aab ✓      │ │                                             │
│  │ ab  ✓      │ │                                             │
│  └────────────┘ │                                             │
├──────────────────┴─────────────────────────────────────────────┤
│  STATUSBAR  (36px)                                             │
│  [type chip]  [n states]  [m transitions]  [alphabet]          │
│                                       [● valid / ✗ no init]   │
└────────────────────────────────────────────────────────────────┘
```

### Topbar (60px)

Same height and style as the nav on the landing page.  
Background: `rgba(250,249,247,0.92)` + `backdrop-filter: blur(14px)`.  
Border bottom: `1px solid var(--border)`.

Sections (left → right):
- **Brand**: ZedMascot (32px) + "ZFlap" wordmark — links back to `/`
- **Automaton name**: inline editable text, no visible border until focused
- **Type badge**: e.g. `DFA` or `TM` — click opens type selector dropdown
- **Divider** (`1px solid var(--border)`)
- **Tool buttons**: Select, Add State, Add Transition, Delete — icon buttons, active tool gets orange fill
- **Spacer** (flex 1)
- **Undo / Redo**: icon buttons, disabled when stack is empty
- **Divider**
- **Save** (ghost sm), **Load** (ghost sm), **Export** (primary sm)

### Left Panel (280px)

Three sections separated by `1px solid var(--border)` dividers, each collapsible with a chevron:

1. **Alphabet** — shows `(a, b, …)` parsed display, inline edit field, error message if invalid
2. **States** — scrollable list; each row: state name + [initial marker] + [final toggle] + [rename] + [delete]
3. **Simulate** — text input for `w`, step controls (← play/pause →), result banner, and "Generated examples" list below

### Canvas

- Background: `var(--bg)` with faint dot-grid (same pattern as hero `::after`)
- Pan: drag on empty space (cursor `grab` / `grabbing`)
- Zoom: scroll wheel; range 0.3×–2.5×; zoom-to-cursor
- Grid snap: optional, 20px grid, toggled from toolbar
- No outer border — it's the page background

**Interaction modes** (one active at a time, set from toolbar):

| Mode | Cursor | Click canvas | Click state | Drag state | Click transition |
|---|---|---|---|---|---|
| Select | default | deselect all | select / move | move | select |
| Add State | crosshair | place new state | — | — | — |
| Add Transition | crosshair | — | start drag; release on target to create | — | — |
| Delete | not-allowed | — | delete state + attached transitions | — | delete transition |

**Selection visual**: selected state gets a `2px dashed var(--orange)` stroke and a small resize handle dot. Selected transition path turns orange with a small delete icon near midpoint.

**Double-click**: on a state opens an inline rename field directly on the canvas; on a transition edge opens a popover to edit the label.

### Status Bar (36px)

Background: `var(--bg-card)`. Border top: `1px solid var(--border)`.

```
[DFA]  5 states  8 transitions  Σ = {0, 1}        ● DFA — deterministic
```

- Type badge on the left
- Counts in `var(--text-muted)` at 12px
- Right side: colored dot + short classification message
  - Green dot: accepted classification (DFA, PDA, TM)
  - Orange dot: NFA, ε-NFA
  - Red dot: no initial state, or invalid alphabet
  - Dim: empty automaton

---

## 5. Interaction & Animation Rules

- **State transitions** (CSS): `all 0.2s ease` for color changes on SVG elements
- **Flash**: active edge/state highlight lasts 400ms, fades to resting color
- **Result banners**: `slideIn` — `opacity 0 + translateY(4px)` → normal, 150ms
- **Panel collapse**: height 0 → auto, 200ms ease
- **Tooltip delay**: 400ms before showing; immediate hide on mouse leave
- **No layout shift**: canvas size is fixed; panels don't reflow the canvas

---

## 6. What Still Needs Updating

| File | Issue |
|---|---|
| `DfaDemo.tsx` | SVG colors hardcoded for dark bg (`rgba(255,255,255,...)`, `#13151E`, `#F0CF60`) — acceptable for the landing demo, but the real editor canvas must use the token table from §3 |
| Landing page DfaDemo | Will eventually be replaced by an embedded read-only snapshot of the real editor canvas |
