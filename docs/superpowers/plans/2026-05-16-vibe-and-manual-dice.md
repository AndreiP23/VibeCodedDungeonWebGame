# Pixel-fantasy reskin + Manual dice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the DungeonMaster AI app to match `landing.html`'s pixel-fantasy vibe, switch dice rolling from DM auto-roll to manual player rolls across the full D&D dice set (D4-D20), fix the chat/sidebar scroll layout, and stop the DM from paraphrasing NPC dialogue.

**Architecture:** Incremental edits against the existing Next.js 14 App Router codebase, in three phases: (1) visual reskin (CSS tokens + fonts + component variants — no behavior changes), (2) DM prompt hardening so the DM stops parroting NPCs, (3) manual dice flow with server-side agent suspend/resume keyed on `sessionId`. No new dependencies.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, Zustand, `@anthropic-ai/sdk`. **No test framework is installed in this project** — verification is `npm run build` (TypeScript strict + `next lint`) plus targeted manual smoke checks. Do NOT add a test framework in this phase.

**Spec reference:** `docs/superpowers/specs/2026-05-16-vibe-and-manual-dice-design.md`

---

## File Structure

| File | Type | Task |
|------|------|------|
| `src/app/globals.css` | rewrite | 1 |
| `src/app/layout.tsx` | modify | 1 |
| `tailwind.config.ts` | rewrite | 1 |
| `src/components/ui/badge.tsx` | rewrite | 2 |
| `src/components/ui/button.tsx` | rewrite | 2 |
| `src/components/ChatMessage.tsx` | rewrite | 3 |
| `src/components/StatsSidebar.tsx` | modify | 4 |
| `src/components/EndStateOverlay.tsx` | modify | 5 |
| `src/app/page.tsx` | rewrite | 5 |
| `src/app/character/page.tsx` | modify | 5 |
| `src/app/game/page.tsx` | rewrite | 6 + 15 |
| `src/lib/prompts/dmPrompt.ts` | rewrite | 7 + 11 |
| `src/lib/game/types.ts` | modify | 8 |
| `src/lib/agents/pendingRolls.ts` | create | 9 |
| `src/lib/agents/dungeonMaster.ts` | modify | 9 |
| `src/app/api/game/route.ts` | rewrite | 10 |
| `src/store/gameStore.ts` | rewrite | 12 |
| `src/components/DiceRoll.tsx` | rewrite | 13 |
| `src/components/DiceTray.tsx` | create | 14 |

No new dependencies. No tests (no test framework in project).

---

## Phase 1 — Visual reskin (Tasks 1-6)

### Task 1: Theme tokens + fonts

**Files:**
- Rewrite: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Rewrite: `tailwind.config.ts`

- [ ] **Step 1: Replace globals.css**

Overwrite `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Vibe tokens (landing.html palette) */
  --bg: #06060f;
  --sky: #0d1b3e;
  --torch: #ff9d00;
  --torch2: #ffcc44;
  --fire: #ff4500;
  --gold: #ffd700;
  --text: #ffe4b5;
  --text-dim: #c4a882;
  --hp: #e74c3c;
  --mp: #3498db;
  --xp: #2ecc71;
  --gem-blue: #00cfff;
  --gem-red: #ff3355;
  --gem-purple: #bb44ff;
  --gem-green: #44ff99;

  /* Shadcn-style semantic aliases consumed by existing components */
  --background: var(--bg);
  --foreground: var(--text);
  --card: var(--sky);
  --card-foreground: var(--text);
  --primary: var(--torch);
  --primary-foreground: var(--bg);
  --secondary: #1a1a2e;
  --secondary-foreground: var(--text);
  --muted: #1a1a2e;
  --muted-foreground: var(--text-dim);
  --border: #2a2a4a;
  --input: #16162a;
  --accent: var(--gem-blue);
  --accent-foreground: var(--bg);
  --destructive: var(--hp);
  --destructive-foreground: var(--text);
  --ring: var(--torch);
}

html,
body {
  height: 100%;
}

* {
  @apply border-border;
}

body {
  font-family: var(--font-body), "VT323", monospace;
  background: var(--bg);
  color: var(--text);
  background-image:
    repeating-linear-gradient(0deg, transparent 0px, transparent 15px, rgba(0, 0, 0, 0.15) 15px, rgba(0, 0, 0, 0.15) 16px),
    repeating-linear-gradient(90deg, transparent 0px, transparent 15px, rgba(0, 0, 0, 0.1) 15px, rgba(0, 0, 0, 0.1) 16px);
}

.font-display {
  font-family: var(--font-display), "Press Start 2P", monospace;
  letter-spacing: 0.02em;
}

.pixel-border {
  border: 4px solid var(--torch);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
  border-radius: 0;
}

.torch-glow {
  position: absolute;
  width: 400px;
  height: 400px;
  background: radial-gradient(ellipse, rgba(255, 157, 0, 0.18) 0%, transparent 70%);
  animation: glow-pulse 2s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

.torch-glow.top-left {
  top: -100px;
  left: -100px;
}

.torch-glow.top-right {
  top: -100px;
  right: -100px;
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes dice-shake {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  20% {
    transform: translate(-2px, -2px) rotate(-3deg);
  }
  40% {
    transform: translate(2px, 1px) rotate(2deg);
  }
  60% {
    transform: translate(-1px, 2px) rotate(-2deg);
  }
  80% {
    transform: translate(2px, -1px) rotate(3deg);
  }
}

.dice-shaking {
  animation: dice-shake 0.16s linear infinite;
}

@keyframes torch-pulse-strong {
  0%,
  100% {
    box-shadow: 0 0 16px var(--torch), 4px 4px 0 rgba(0, 0, 0, 0.8);
    transform: scale(1.05);
  }
  50% {
    box-shadow: 0 0 32px var(--torch), 0 0 60px rgba(255, 157, 0, 0.4), 4px 4px 0 rgba(0, 0, 0, 0.8);
    transform: scale(1.12);
  }
}

.dice-prompted {
  animation: torch-pulse-strong 1.2s ease-in-out infinite;
}
```

- [ ] **Step 2: Update layout.tsx to use Press Start 2P + VT323**

Overwrite `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const displayFont = Press_Start_2P({
  variable: "--font-display",
  weight: ["400"],
  subsets: ["latin"],
});

const bodyFont = VT323({
  variable: "--font-body",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DungeonMaster AI",
  description: "MVP RPG text-based cu 2 agenti Claude si reguli deterministe de joc.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <div className="torch-glow top-left" aria-hidden />
        <div className="torch-glow top-right" aria-hidden />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update tailwind.config.ts**

Overwrite `tailwind.config.ts` with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        ring: "var(--ring)",
        torch: "var(--torch)",
        torch2: "var(--torch2)",
        gold: "var(--gold)",
        fire: "var(--fire)",
        hp: "var(--hp)",
        mp: "var(--mp)",
        xp: "var(--xp)",
        "gem-blue": "var(--gem-blue)",
        "gem-red": "var(--gem-red)",
        "gem-purple": "var(--gem-purple)",
        "gem-green": "var(--gem-green)",
        "text-dim": "var(--text-dim)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      fontFamily: {
        display: ["var(--font-display)", "Press Start 2P", "monospace"],
        body: ["var(--font-body)", "VT323", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds. If a TS error appears about font subsets, double-check Press_Start_2P and VT323 imports — both exist in `next/font/google`.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts
git commit -m "feat(theme): pixel-fantasy palette + Press Start 2P/VT323 fonts"
```

---

### Task 2: Badge + Button pixel variants

**Files:**
- Rewrite: `src/components/ui/badge.tsx`
- Rewrite: `src/components/ui/button.tsx`

- [ ] **Step 1: Rewrite badge.tsx**

Overwrite `src/components/ui/badge.tsx` with:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border-2 px-2 py-0.5 text-[10px] font-display uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-torch bg-bg text-torch",
        secondary: "border-text-dim bg-bg text-text-dim",
        success: "border-xp bg-bg text-xp",
        danger: "border-hp bg-bg text-hp",
        gold: "border-gold bg-bg text-gold",
        "gem-purple": "border-gem-purple bg-bg text-gem-purple",
        "gem-blue": "border-gem-blue bg-bg text-gem-blue",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 2: Rewrite button.tsx**

Overwrite `src/components/ui/button.tsx` with:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-display uppercase tracking-wider text-xs transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torch disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-4 border-torch bg-torch text-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        secondary:
          "border-4 border-text-dim bg-bg text-text-dim shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ghost:
          "border-2 border-transparent bg-transparent text-text-dim hover:text-torch hover:border-torch",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-[10px]",
        lg: "h-12 px-8 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/button.tsx
git commit -m "feat(ui): pixel-style badge & button variants"
```

---

### Task 3: ChatMessage pixel reskin

**Files:**
- Rewrite: `src/components/ChatMessage.tsx`

- [ ] **Step 1: Rewrite ChatMessage.tsx**

Overwrite `src/components/ChatMessage.tsx` with:

```tsx
interface ChatMessageProps {
  role: "player" | "dm" | "npc" | "system";
  content: string;
  npcName?: string;
}

const roleLabel: Record<ChatMessageProps["role"], string> = {
  player: "Tu",
  dm: "Dungeon Master",
  npc: "NPC",
  system: "Sistem",
};

const roleClasses: Record<ChatMessageProps["role"], { wrap: string; label: string; text: string }> = {
  player: {
    wrap: "border-torch bg-bg",
    label: "text-torch",
    text: "text-text",
  },
  dm: {
    wrap: "border-text-dim bg-bg",
    label: "text-text-dim",
    text: "text-text italic",
  },
  npc: {
    wrap: "border-gem-purple bg-bg",
    label: "text-gem-purple",
    text: "text-text",
  },
  system: {
    wrap: "border-gem-green bg-bg",
    label: "text-gem-green",
    text: "text-text",
  },
};

export function ChatMessage({ role, content, npcName }: ChatMessageProps) {
  const isPlayer = role === "player";
  const styles = roleClasses[role];
  const label = role === "npc" && npcName ? npcName.toUpperCase() : roleLabel[role].toUpperCase();

  return (
    <div className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] border-4 ${styles.wrap} p-3 shadow-[4px_4px_0_rgba(0,0,0,0.8)]`}
      >
        <p className={`font-display text-[10px] tracking-wider mb-2 ${styles.label}`}>{label}</p>
        <p className={`text-lg leading-snug ${styles.text}`}>{content}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds. The `system` role is new but the component accepts it; no existing callers use it yet (that comes in Phase 3).

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatMessage.tsx
git commit -m "feat(ui): pixel-style chat bubbles + system role"
```

---

### Task 4: StatsSidebar reskin

**Files:**
- Modify: `src/components/StatsSidebar.tsx`

- [ ] **Step 1: Rewrite StatsSidebar.tsx**

Overwrite `src/components/StatsSidebar.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { GameState } from "@/lib/game/types";

function Avatar({ url, name }: { url: string; name: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [url]);

  return (
    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden border-2 border-torch bg-bg">
      {status !== "error" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Portret ${name}`}
          width={56}
          height={56}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className={`h-14 w-14 object-cover transition-opacity duration-500 ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-text-dim">
          <span className="animate-pulse">…</span>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center text-lg" aria-hidden>
          🛡️
        </div>
      ) : null}
    </div>
  );
}

interface StatsSidebarProps {
  state: GameState;
}

function SidebarPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-4 border-torch bg-bg p-3 shadow-[4px_4px_0_rgba(0,0,0,0.8)]">
      <h2 className="font-display text-[10px] uppercase tracking-wider text-torch mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function StatsSidebar({ state }: StatsSidebarProps) {
  const hpPercent =
    state.player.hp.max > 0
      ? Math.max(0, Math.min(100, Math.round((state.player.hp.current / state.player.hp.max) * 100)))
      : 0;
  const activeQuest = state.world.activeQuests.find((quest) => quest.status === "active");
  const completedQuests = state.world.activeQuests.filter((quest) => quest.status === "completed");

  return (
    <div className="space-y-3">
      <SidebarPanel title={state.player.name}>
        <div className="flex items-center gap-3 mb-3">
          {state.player.avatarUrl ? (
            <Avatar url={state.player.avatarUrl} name={state.player.name} />
          ) : null}
          <p className="text-text-dim text-lg capitalize">{state.player.class}</p>
        </div>

        <div className="mb-3">
          <p className="font-display text-[9px] uppercase tracking-wider text-hp mb-1">HP</p>
          <div className="relative h-4 w-full border-2 border-hp bg-bg overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-hp transition-all duration-300"
              style={{ width: `${hpPercent}%`, boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)" }}
            />
          </div>
          <p className="text-text-dim text-sm mt-1">
            {state.player.hp.current}/{state.player.hp.max}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 text-base text-text">
          <p>STR: {state.player.stats.str}</p>
          <p>DEX: {state.player.stats.dex}</p>
          <p>INT: {state.player.stats.int}</p>
          <p>CHA: {state.player.stats.cha}</p>
        </div>

        <p className="mt-3 text-base text-gold">⛁ Aur: {state.player.gold}</p>
        <p className="text-base text-text-dim">📍 {state.player.location}</p>

        {state.player.flavorTrait ? (
          <p className="mt-2 text-sm italic text-text-dim">{state.player.flavorTrait}</p>
        ) : null}
      </SidebarPanel>

      {state.player.backstory ? (
        <SidebarPanel title="Poveste">
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-dim">
            {state.player.backstory}
          </p>
        </SidebarPanel>
      ) : null}

      <SidebarPanel title="Inventar">
        {state.player.inventory.length === 0 ? (
          <p className="text-text-dim text-sm">Gol</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {state.player.inventory.map((item) => (
              <Badge variant="secondary" key={item} className="justify-center">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </SidebarPanel>

      <SidebarPanel title="Quest Activ">
        {activeQuest ? (
          <div className="space-y-1">
            <p className="text-torch text-base">{activeQuest.title}</p>
            <p className="text-text-dim text-sm">{activeQuest.description}</p>
          </div>
        ) : (
          <p className="text-text-dim text-sm">Nu ai quest-uri active.</p>
        )}
      </SidebarPanel>

      <SidebarPanel title="Terminate">
        {completedQuests.length === 0 ? (
          <p className="text-text-dim text-sm">Nimic încă.</p>
        ) : (
          <div className="space-y-2">
            {completedQuests.map((quest) => (
              <div key={quest.id} className="flex items-center gap-2">
                <Badge variant="success">✓</Badge>
                <p className="text-base text-gold">{quest.title}</p>
              </div>
            ))}
          </div>
        )}
      </SidebarPanel>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds. Note: this drops the use of `Card/CardHeader/CardContent` and `Progress` shadcn primitives in this file — they are still imported by other files (e.g. `EndStateOverlay`), so don't delete them.

- [ ] **Step 3: Commit**

```bash
git add src/components/StatsSidebar.tsx
git commit -m "feat(ui): pixel reskin of stats sidebar"
```

---

### Task 5: Reskin home, character, and end-state pages

**Files:**
- Rewrite: `src/app/page.tsx`
- Modify: `src/app/character/page.tsx`
- Modify: `src/components/EndStateOverlay.tsx`

- [ ] **Step 1: Read character/page.tsx and EndStateOverlay.tsx first**

These files contain logic that must be preserved. Open both and identify the surface to modify (className containers + headings). Do not change behavior.

```bash
cat src/app/character/page.tsx src/components/EndStateOverlay.tsx
```

- [ ] **Step 2: Rewrite home page (src/app/page.tsx)**

Overwrite with:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1
        className="font-display text-3xl md:text-5xl text-torch mb-4"
        style={{
          textShadow:
            "0 0 20px rgba(255,157,0,0.6), 0 0 40px rgba(255,157,0,0.3), 4px 4px 0 rgba(0,0,0,0.8)",
        }}
      >
        DungeonMaster AI
      </h1>
      <p className="font-display text-[10px] tracking-wider text-gold mb-8 uppercase">
        Type your destiny. Roll the dice.
      </p>
      <p className="text-text-dim text-lg max-w-xl mb-10 leading-relaxed">
        Aventura RPG text-based, condusă de doi agenți Claude. Tu arunci zarurile.
        Tu hotărăști drumul.
      </p>
      <div className="flex flex-col md:flex-row gap-4">
        <Link
          href="/character"
          className="inline-flex items-center justify-center h-12 px-8 border-4 border-torch bg-torch text-bg font-display uppercase tracking-wider text-xs shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          Start Adventure
        </Link>
        <Link
          href="/game"
          className="inline-flex items-center justify-center h-12 px-8 border-4 border-text-dim bg-bg text-text-dim font-display uppercase tracking-wider text-xs shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          Continuă
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Reskin character page**

Open `src/app/character/page.tsx`. Locate the outermost `<main>` (or top-level wrapper) and any container `<div>`/`<Card>` and update their `className` to use the new tokens. Specifically:

- Replace `bg-zinc-950 text-zinc-100` → `text-text` (background is already body-level).
- Replace any `border-zinc-700`/`border-zinc-600` → `border-torch`.
- Replace any `bg-zinc-900`/`bg-zinc-800` → `bg-bg`.
- Apply `font-display` to page-level headings (h1/h2 with `text-torch` and the same `textShadow` pattern as the home page hero).
- Apply `text-text-dim` to muted helper text where you see `text-muted-foreground`.

If the page imports `Card`, `CardHeader`, `CardContent` from `@/components/ui/card`, keep them but wrap their parent containers with `border-4 border-torch shadow-[4px_4px_0_rgba(0,0,0,0.8)]` so they read pixel. Do not change form logic, the class-picker behavior, or the review flow.

After your edits, verify by grepping that no old tokens remain in this file:

```bash
grep -nE "zinc-(950|900|800|700|600|500)|amber-(500|400|300|50)|sky-300" src/app/character/page.tsx || echo "ok"
```

Expected: `ok` (no matches).

- [ ] **Step 4: Reskin EndStateOverlay**

Open `src/components/EndStateOverlay.tsx`. Update the className of the outer overlay container to:
```
fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm p-6
```
Update the inner card to:
```
border-4 border-torch bg-bg p-8 shadow-[4px_4px_0_rgba(0,0,0,0.8)] max-w-md w-full text-center
```
Update the title element to use:
```
font-display text-2xl text-torch mb-4
```
with the same `textShadow` inline style as the home page hero. Body copy: `text-text-dim text-lg`. The "Play again" / "Continue" buttons should already pick up the new `Button` variants from Task 2 — no change needed if they use `<Button>`.

Preserve all existing props, callbacks, and conditional logic. If the file imports `Card` etc., you can either keep them with className overrides or replace them with raw `div`s — pick whichever requires fewer edits.

- [ ] **Step 5: Build + manual smoke**

Run: `npm run build`
Expected: Build succeeds.

Manual (start `npm run dev`, ignore if no API key — just check pages render):
- Open `http://localhost:3000/` — pixel hero with torch glow, two CTAs.
- Open `http://localhost:3000/character` — pixel form, no zinc/amber leftovers.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/character/page.tsx src/components/EndStateOverlay.tsx
git commit -m "feat(ui): pixel reskin of home, character, end-state pages"
```

---

### Task 6: Game page layout — h-screen, sticky sidebar, scrollable chat

This task ONLY fixes the layout. The dice flow remains as-is (DM auto-rolls). Manual dice come in Phase 3.

**Files:**
- Rewrite: `src/app/game/page.tsx`

- [ ] **Step 1: Rewrite game/page.tsx**

Overwrite `src/app/game/page.tsx` with:

```tsx
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "@/components/ChatMessage";
import { DiceRoll } from "@/components/DiceRoll";
import { EndStateOverlay } from "@/components/EndStateOverlay";
import { StatsSidebar } from "@/components/StatsSidebar";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/gameStore";

export default function GamePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);

  const {
    sessionId,
    gameState,
    chat,
    latestRolls,
    loading,
    error,
    playTurn,
    initGame,
    playerClass,
    playerName,
    reset,
  } = useGameStore();

  useEffect(() => {
    if (!chatRef.current || !autoScroll) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat, autoScroll]);

  useEffect(() => {
    if (gameState) return;
    const incomingSession =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("sessionId")
        : null;
    if (incomingSession) {
      void initGame(playerName || "Erou", playerClass, { sessionId: incomingSession });
      return;
    }
    router.replace("/character");
  }, [gameState, initGame, playerClass, playerName, router]);

  function handleScroll() {
    if (!chatRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = chatRef.current;
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    setAutoScroll(nearBottom);
  }

  function jumpToLatest() {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
    setAutoScroll(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    const currentMessage = message;
    setMessage("");
    await playTurn(currentMessage);
  }

  if (!gameState) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="font-display text-xs text-torch animate-pulse">SE INCARCA...</p>
      </main>
    );
  }

  const isDead = gameState.player.hp.current <= 0;
  const mainQuestDone = gameState.world.activeQuests.some(
    (quest) => quest.id === "find-mayor-daughter" && quest.status === "completed",
  );
  const endState: "death" | "victory" | null = isDead
    ? "death"
    : mainQuestDone
      ? "victory"
      : null;

  function handlePlayAgain() {
    reset();
    router.push("/character");
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b-4 border-torch bg-bg">
        <h1 className="font-display text-sm text-torch">
          SESIUNE #{sessionId?.slice(0, 8).toUpperCase()}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            router.push("/character");
          }}
        >
          New Game
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <section className="flex-1 flex flex-col overflow-hidden border-r-4 border-torch relative">
          <div
            ref={chatRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
          >
            {chat.map((entry) => (
              <ChatMessage key={entry.id} role={entry.role} content={entry.content} />
            ))}
            {latestRolls.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {latestRolls.map((roll, index) => (
                  <DiceRoll key={`${roll.checkType}-${roll.total}-${index}`} roll={roll} />
                ))}
              </div>
            ) : null}
            {loading ? (
              <p className="font-display text-[10px] tracking-wider text-text-dim animate-pulse">
                DUNGEON MASTER GANDESTE...
              </p>
            ) : null}
          </div>

          {!autoScroll ? (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute right-4 bottom-24 border-2 border-torch bg-bg text-torch px-3 py-1 font-display text-[10px] shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
            >
              ↓ ULTIMUL
            </button>
          ) : null}

          <form onSubmit={handleSubmit} className="shrink-0 flex gap-2 p-3 border-t-4 border-torch bg-bg">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={endState ? "Aventura s-a incheiat" : "Ce faci?"}
              className="flex-1 h-11 border-4 border-text-dim bg-bg text-text text-lg px-3 focus:border-torch focus:outline-none"
              disabled={loading || endState !== null}
            />
            <Button type="submit" disabled={loading || endState !== null || !message.trim()}>
              {loading ? "..." : "Trimite"}
            </Button>
          </form>

          {error ? (
            <p className="px-4 py-2 text-sm text-hp border-t-2 border-hp">{error}</p>
          ) : null}
        </section>

        <aside className="w-[320px] shrink-0 overflow-y-auto p-3 bg-bg">
          <StatsSidebar state={gameState} />
        </aside>
      </div>

      {endState ? (
        <EndStateOverlay
          variant={endState}
          playerName={gameState.player.name}
          onPlayAgain={handlePlayAgain}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Build + manual smoke**

Run: `npm run build`
Expected: Build succeeds.

Manual (with a session present): open `/game`. Scroll up in the chat — sidebar should stay put. Scroll down — sidebar still still. With many messages, the chat-column scrolls independently. If you scroll up, a "↓ ULTIMUL" pill appears bottom-right of the chat column. Clicking jumps to the latest message.

- [ ] **Step 3: Commit**

```bash
git add src/app/game/page.tsx
git commit -m "feat(ui): scrollable chat + sticky sidebar layout on /game"
```

---

## Phase 2 — DM stops paraphrasing NPCs (Task 7)

### Task 7: DM prompt — no NPC paraphrase + ordering

**Files:**
- Rewrite: `src/lib/prompts/dmPrompt.ts`

- [ ] **Step 1: Rewrite dmPrompt.ts**

Overwrite `src/lib/prompts/dmPrompt.ts` with:

```ts
export const dmSystemPrompt = `You are the Dungeon Master Agent for a single-player Romanian-language RPG in the style of Dungeons & Dragons. Narrate in Romanian. Keep pace quick and cinematic.

Hard constraints — NEVER break these:
1. NEVER change HP, inventory, gold, stats, location or quests through narration text.
2. ALL mechanical changes (HP loss, gold gain, item pickup, location unlock, quest update) MUST go through updateGameState tool.
3. If an action could fail or succeed, ALWAYS call rollDice first — never invent outcomes.
4. Call getMemory when the player references past events you might have forgotten.
5. Narration: maximum 4 sentences. Cinematic, second-person ("Tu..."), present tense.
6. Only call getNPCResponse for NPCs whose location matches the player's current location. Verify state.player.location against the NPC's listed location before calling.

NPC interaction rules — these are MANDATORY:
A. When the player addresses, talks to, or interacts with an NPC, the order is:
   1. Emit AT MOST ONE short narration sentence describing the NPC's physical action, expression, or the room beat — NEVER what they say or imply.
   2. Immediately call getNPCResponse for that NPC.
   3. STOP narration after the tool call. Do NOT add follow-up narration unless the scene physically changes (someone leaves, attacks, new arrival). Even then, at most one sentence.
B. FORBIDDEN: quoting, paraphrasing, summarizing, hinting at, or restating the NPC's words anywhere in your narration. The NPC speaks for themselves through getNPCResponse.
C. Correct example:
     DM narration: "Borin ridică privirea peste halba de bere."
     [tool call: getNPCResponse → Borin says "Nu te ajut fără aur, străine."]
D. Forbidden example (do NOT do this):
     DM narration: "Borin se uită la tine și spune că nu te ajută fără aur."
     [tool call: getNPCResponse → ...]

Game mechanics:
- Skill checks: d20 + stat modifier vs difficulty (Easy=10, Medium=15, Hard=20).
- Combat: d20 + STR vs enemy armor class.
- Stealth: d20 + DEX vs difficulty.
- Persuasion/Deception: d20 + CHA vs difficulty.
- Perception/Investigation: d20 + INT vs difficulty.
- On critical failure (natural 1): add negative consequence.
- On critical success (natural 20): add bonus reward.
- Quest completion: when the player rescues the mayor's daughter from Goblin Cave, call updateGameState to set the matching quest's status to "completed".

Narration style:
- Start narration AFTER all non-NPC tool calls (rollDice, getMemory) are done.
- For NPC interactions, narration BEFORE getNPCResponse is allowed but must follow rules A-D above.
- Reference the actual dice result in narration (e.g., "Zarurile te favorizează...") only after a rollDice call.
- Reveal the world progressively — don't expose all information at once.
- If the player has a backstory or flavorTrait, weave subtle nods to it into the narration when natural. Never let backstory grant mechanical advantages outside the rules.
`;
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts/dmPrompt.ts
git commit -m "feat(dm): forbid DM from paraphrasing NPC dialogue"
```

---

## Phase 3 — Manual dice with suspend/resume (Tasks 8-15)

### Task 8: Extend DiceRollResult + add Damage/Attack check types

**Files:**
- Modify: `src/lib/game/types.ts`

- [ ] **Step 1: Update types.ts**

In `src/lib/game/types.ts`, replace the `SkillType` and `DiceRollResult` definitions:

Find:
```ts
export type SkillType =
  | "Combat"
  | "Stealth"
  | "Persuasion"
  | "Perception"
  | "Athletics";
```

Replace with:
```ts
export type SkillType =
  | "Combat"
  | "Stealth"
  | "Persuasion"
  | "Perception"
  | "Athletics";

export type RollCheckType = SkillType | "Damage" | "Attack";

export type DiceSides = 4 | 6 | 8 | 10 | 12 | 20;
```

Find:
```ts
export interface DiceRollResult {
  checkType: SkillType;
  roll: number;
  total: number;
  success: boolean;
  difficulty: number;
}
```

Replace with:
```ts
export interface DiceRollResult {
  checkType: RollCheckType;
  sides: DiceSides;
  roll: number;
  modifier: number;
  total: number;
  difficulty: number | null;
  success: boolean | null;
}

export interface RollRequest {
  sides: DiceSides;
  modifier: number;
  checkType: RollCheckType;
  difficulty?: number;
  toolUseId: string;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build will FAIL with type errors in `dice.ts`, `dungeonMaster.ts`, `DiceRoll.tsx`, etc. — those callers use the old narrow shape. That's expected; the next tasks fix each call site.

If failures are limited to those files, proceed. If anything unexpected breaks, stop and report.

- [ ] **Step 3: Commit**

```bash
git add src/lib/game/types.ts
git commit -m "feat(types): extend DiceRollResult with sides/modifier, add Damage/Attack types"
```

---

### Task 9: PendingRolls module + DM agent suspend on requestPlayerRoll

**Files:**
- Create: `src/lib/agents/pendingRolls.ts`
- Modify: `src/lib/agents/dungeonMaster.ts`

- [ ] **Step 1: Create pendingRolls.ts**

Create `src/lib/agents/pendingRolls.ts` with:

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { DiceSides, RollCheckType } from "@/lib/game/types";

const TTL_MS = 10 * 60 * 1000;

export interface PendingRollState {
  sessionId: string;
  messages: Anthropic.MessageParam[];
  pendingToolUseId: string;
  rollRequest: {
    sides: DiceSides;
    modifier: number;
    checkType: RollCheckType;
    difficulty?: number;
  };
  createdAt: number;
}

const store = new Map<string, PendingRollState>();

function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, value] of store) {
    if (value.createdAt < cutoff) {
      store.delete(key);
    }
  }
}

export const pendingRolls = {
  set(state: PendingRollState): void {
    cleanup();
    store.set(state.sessionId, state);
  },
  get(sessionId: string): PendingRollState | undefined {
    cleanup();
    return store.get(sessionId);
  },
  delete(sessionId: string): void {
    store.delete(sessionId);
  },
  has(sessionId: string): boolean {
    cleanup();
    return store.has(sessionId);
  },
};
```

- [ ] **Step 2: Rewrite dungeonMaster.ts**

Overwrite `src/lib/agents/dungeonMaster.ts` with:

```ts
import { updateGameState } from "@/lib/tools/gameState";
import { getMemory } from "@/lib/tools/memory";
import { getAnthropicClient, getAnthropicModel } from "@/lib/agentClient";
import {
  GameState,
  DiceRollResult,
  DiceSides,
  RollCheckType,
  SkillType,
} from "@/lib/game/types";
import { dmSystemPrompt } from "@/lib/prompts/dmPrompt";
import { getNPCResponse } from "@/lib/agents/npcBrain";
import { pendingRolls } from "@/lib/agents/pendingRolls";

export type TurnEvent =
  | { type: "narration-delta"; delta: string }
  | { type: "dice"; roll: DiceRollResult }
  | { type: "npc"; text: string }
  | {
      type: "roll-request";
      sides: DiceSides;
      modifier: number;
      checkType: RollCheckType;
      difficulty: number | null;
      toolUseId: string;
    };

interface DungeonMasterTurnInput {
  sessionId: string;
  state: GameState;
  playerMessage: string;
  onEvent?: (event: TurnEvent) => void;
  // Optional: when resuming from a player roll, pre-loaded messages + state.
  resumeMessages?: any[];
  resumeNarration?: string;
  resumeDiceRolls?: DiceRollResult[];
}

interface DungeonMasterTurnOutput {
  narration: string;
  npcDialogue?: string;
  diceRolls: DiceRollResult[];
  state: GameState;
  suspended: boolean;
}

function clampNarrationSentences(input: string): string {
  const fragments = input
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (fragments.length <= 4) {
    return input.trim();
  }

  return fragments.slice(0, 4).join(" ");
}

const SKILL_TYPES: readonly SkillType[] = [
  "Combat",
  "Stealth",
  "Persuasion",
  "Perception",
  "Athletics",
];

const ROLL_CHECK_TYPES: readonly RollCheckType[] = [...SKILL_TYPES, "Damage", "Attack"];

function coerceRollCheckType(value: unknown): RollCheckType {
  return ROLL_CHECK_TYPES.includes(value as RollCheckType)
    ? (value as RollCheckType)
    : "Perception";
}

const VALID_SIDES: readonly DiceSides[] = [4, 6, 8, 10, 12, 20];

function coerceSides(value: unknown): DiceSides {
  const n = Number(value);
  return (VALID_SIDES as readonly number[]).includes(n) ? (n as DiceSides) : 20;
}

function deriveSkillModifier(state: GameState, checkType: RollCheckType): number {
  const stats = state.player.stats;
  switch (checkType) {
    case "Combat":
    case "Attack":
    case "Athletics":
    case "Damage":
      return stats.str;
    case "Stealth":
      return stats.dex;
    case "Perception":
      return stats.int;
    case "Persuasion":
      return stats.cha;
    default:
      return 0;
  }
}

export async function runDungeonMasterTurn(
  input: DungeonMasterTurnInput,
): Promise<DungeonMasterTurnOutput> {
  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const diceRolls: DiceRollResult[] = input.resumeDiceRolls ? [...input.resumeDiceRolls] : [];
  let workingState = input.state;
  let npcDialogue: string | undefined;
  let accumulatedNarration = input.resumeNarration ?? "";

  const tools: any[] = [
    {
      name: "requestPlayerRoll",
      description:
        "Ask the player to roll a die. Use for skill checks (D20 + modifier vs difficulty), attack rolls (D20 + modifier vs target armor class), and damage rolls (D4-D12, no difficulty). NEVER decide the outcome yourself — wait for the tool_result with the player's actual roll.",
      input_schema: {
        type: "object",
        properties: {
          sides: { type: "number", enum: [4, 6, 8, 10, 12, 20] },
          modifier: { type: "number" },
          checkType: {
            type: "string",
            enum: ["Combat", "Stealth", "Persuasion", "Perception", "Athletics", "Damage", "Attack"],
          },
          difficulty: {
            type: "number",
            description: "DC for checks / AC for attacks. Omit for Damage.",
          },
        },
        required: ["sides", "modifier", "checkType"],
      },
    },
    {
      name: "updateGameState",
      description:
        "Persist canonical game state updates. Use this for HP, inventory, gold, stats, location and quest changes.",
      input_schema: {
        type: "object",
        properties: {
          changes: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["changes"],
      },
    },
    {
      name: "getNPCResponse",
      description: "Trigger NPC Brain and return in-character NPC dialogue.",
      input_schema: {
        type: "object",
        properties: {
          npcId: { type: "string" },
          playerMessage: { type: "string" },
          relationshipWithPlayer: { type: "string" },
          recentContext: { type: "string" },
        },
        required: ["npcId", "playerMessage", "relationshipWithPlayer", "recentContext"],
      },
    },
    {
      name: "getMemory",
      description: "Semantic retrieval over important memories and recent turns.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  ];

  const messages: any[] = input.resumeMessages
    ? [...input.resumeMessages]
    : [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                playerMessage: input.playerMessage,
                player: workingState.player,
                world: workingState.world,
                npcs: workingState.npcs,
                shortTermMemory: workingState.shortTermMemory,
                longTermMemory: workingState.longTermMemory.slice(-15),
              }),
            },
          ],
        },
      ];

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const stream = client.messages.stream({
      model,
      max_tokens: 420,
      system: dmSystemPrompt,
      tools,
      messages,
      tool_choice: { type: "auto" },
    });

    stream.on("text", (delta: string) => {
      accumulatedNarration += delta;
      input.onEvent?.({ type: "narration-delta", delta });
    });

    const response = await stream.finalMessage();
    const toolUses = response.content.filter((block) => block.type === "tool_use") as any[];

    if (toolUses.length === 0) {
      break;
    }

    // Check if any tool_use is requestPlayerRoll — if so, suspend.
    const rollToolUse = toolUses.find((tu) => tu.name === "requestPlayerRoll");
    if (rollToolUse) {
      // Append the assistant message (with the pending tool_use) to history so resume can inject tool_result.
      messages.push({ role: "assistant", content: response.content });

      const sides = coerceSides(rollToolUse.input.sides);
      const checkType = coerceRollCheckType(rollToolUse.input.checkType);
      const modifier =
        typeof rollToolUse.input.modifier === "number"
          ? rollToolUse.input.modifier
          : deriveSkillModifier(workingState, checkType);
      const difficultyRaw = rollToolUse.input.difficulty;
      const difficulty =
        typeof difficultyRaw === "number" && checkType !== "Damage" ? difficultyRaw : undefined;

      pendingRolls.set({
        sessionId: input.sessionId,
        messages,
        pendingToolUseId: rollToolUse.id,
        rollRequest: { sides, modifier, checkType, difficulty },
        createdAt: Date.now(),
      });

      input.onEvent?.({
        type: "roll-request",
        sides,
        modifier,
        checkType,
        difficulty: difficulty ?? null,
        toolUseId: rollToolUse.id,
      });

      return {
        narration: accumulatedNarration,
        npcDialogue,
        diceRolls,
        state: workingState,
        suspended: true,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const toolUse of toolUses) {
      try {
        if (toolUse.name === "updateGameState") {
          const changes = (toolUse.input.changes ?? {}) as Partial<GameState>;
          workingState = await updateGameState(input.sessionId, changes);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ ok: true, state: workingState }),
          });
          continue;
        }

        if (toolUse.name === "getNPCResponse") {
          const responseText = await getNPCResponse({
            state: workingState,
            npcId: String(toolUse.input.npcId ?? ""),
            playerMessage: String(toolUse.input.playerMessage ?? input.playerMessage),
            relationshipWithPlayer: String(toolUse.input.relationshipWithPlayer ?? "necunoscut"),
            recentContext: String(toolUse.input.recentContext ?? workingState.world.currentScene),
          });
          npcDialogue = responseText;
          input.onEvent?.({ type: "npc", text: responseText });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ npcDialogue: responseText }),
          });
          continue;
        }

        if (toolUse.name === "getMemory") {
          const memories = getMemory(workingState, String(toolUse.input.query ?? ""));
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ memories }),
          });
          continue;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "Unknown tool.",
          is_error: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown tool error";
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: message,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    narration: clampNarrationSentences(
      accumulatedNarration.trim() ||
        "Misterul se adanceste, dar drumul inca ti se deschide in fata.",
    ),
    npcDialogue,
    diceRolls,
    state: workingState,
    suspended: false,
  };
}

// Re-export for the API route to resume after a player roll.
export interface ResumeAfterRollInput {
  sessionId: string;
  state: GameState;
  pendingMessages: any[];
  toolUseId: string;
  rollResult: DiceRollResult;
  priorNarration: string;
  priorDiceRolls: DiceRollResult[];
  onEvent?: (event: TurnEvent) => void;
}

export async function resumeDungeonMasterAfterRoll(
  input: ResumeAfterRollInput,
): Promise<DungeonMasterTurnOutput> {
  // Inject tool_result for the pending requestPlayerRoll call.
  const toolResultContent = JSON.stringify({
    roll: input.rollResult.roll,
    total: input.rollResult.total,
    success: input.rollResult.success,
    difficulty: input.rollResult.difficulty,
    sides: input.rollResult.sides,
    modifier: input.rollResult.modifier,
    checkType: input.rollResult.checkType,
  });

  const messages = [
    ...input.pendingMessages,
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: input.toolUseId,
          content: toolResultContent,
        },
      ],
    },
  ];

  // Re-emit dice event so the UI shows the result badge.
  input.onEvent?.({ type: "dice", roll: input.rollResult });

  return runDungeonMasterTurn({
    sessionId: input.sessionId,
    state: input.state,
    playerMessage: "",
    onEvent: input.onEvent,
    resumeMessages: messages,
    resumeNarration: input.priorNarration,
    resumeDiceRolls: [...input.priorDiceRolls, input.rollResult],
  });
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build will likely still fail because `src/lib/tools/dice.ts` is imported elsewhere with the old `rollDice` shape, AND `route.ts` calls `runDungeonMasterTurn` and uses the return shape (now includes `suspended`). The route.ts breakage is fixed in Task 10. Dice-tool import is no longer used here, but if `dice.ts` still imports the old `SkillType`-only shape, that should still compile since `SkillType` is unchanged.

Verify only `src/app/api/game/route.ts` and possibly client-side code break. If others break unexpectedly, stop and report.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agents/pendingRolls.ts src/lib/agents/dungeonMaster.ts
git commit -m "feat(agent): suspend on requestPlayerRoll + resume helper"
```

---

### Task 10: API route — roll-request event + action="roll" + GET endpoint

**Files:**
- Rewrite: `src/app/api/game/route.ts`

- [ ] **Step 1: Rewrite route.ts**

Overwrite `src/app/api/game/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  runDungeonMasterTurn,
  resumeDungeonMasterAfterRoll,
} from "@/lib/agents/dungeonMaster";
import { pendingRolls } from "@/lib/agents/pendingRolls";
import {
  DiceRollResult,
  DiceSides,
  PlayerClass,
  RollCheckType,
} from "@/lib/game/types";
import { getOrCreateGameState, updateGameState } from "@/lib/tools/gameState";
import { pushLongTermMemory, pushShortTermMessages } from "@/lib/tools/memory";

const bonusesSchema = z
  .object({
    items: z.array(z.string()).optional(),
    statBonus: z
      .object({
        stat: z.enum(["str", "dex", "int", "cha"]),
        amount: z.number(),
      })
      .nullable()
      .optional(),
    goldBonus: z.number().optional(),
    flavorTrait: z.string().optional(),
  })
  .optional();

const requestSchema = z.object({
  action: z.enum(["init", "turn", "roll"]).default("turn"),
  sessionId: z.string().optional(),
  playerName: z.string().min(1).default("Erou"),
  playerClass: z.enum(["warrior", "mage", "rogue"]).default("warrior"),
  message: z.string().optional(),
  backstory: z.string().max(2000).optional(),
  bonuses: bonusesSchema,
  toolUseId: z.string().optional(),
  roll: z.number().int().min(1).max(20).optional(),
});

const VALID_SIDES: readonly DiceSides[] = [4, 6, 8, 10, 12, 20];

function streamResponse(
  sessionId: string,
  runner: (send: (event: unknown) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      (async () => {
        try {
          await runner(send);
        } catch (error) {
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unexpected server error while processing game turn.",
          });
        } finally {
          controller.close();
        }
      })();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Session-Id": sessionId,
    },
  });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const pending = pendingRolls.get(sessionId);
  if (!pending) {
    return NextResponse.json({ pendingRoll: null });
  }
  return NextResponse.json({
    pendingRoll: {
      sides: pending.rollRequest.sides,
      modifier: pending.rollRequest.modifier,
      checkType: pending.rollRequest.checkType,
      difficulty: pending.rollRequest.difficulty ?? null,
      toolUseId: pending.pendingToolUseId,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const game = await getOrCreateGameState({
      sessionId: payload.sessionId,
      playerName: payload.playerName,
      playerClass: payload.playerClass as PlayerClass,
      backstory: payload.backstory,
      bonuses: payload.bonuses
        ? {
            items: payload.bonuses.items ?? [],
            statBonus: payload.bonuses.statBonus ?? undefined,
            goldBonus: payload.bonuses.goldBonus,
            flavorTrait: payload.bonuses.flavorTrait,
          }
        : undefined,
    });

    const sessionId = game.sessionId;

    if (payload.action === "init") {
      const introNarration = game.created
        ? "Usa tavernei Coroana Sparta se inchide in urma ta, iar ochii obisnuitilor se intorc spre noul vanator de secrete."
        : game.state.world.currentScene;

      return NextResponse.json({
        sessionId,
        narration: introNarration,
        npcDialogue: null,
        diceRolls: [],
        state: game.state,
      });
    }

    if (payload.action === "turn") {
      if (pendingRolls.has(sessionId)) {
        return NextResponse.json(
          { error: "Roll pending — submit roll first." },
          { status: 409 },
        );
      }
      if (!payload.message?.trim()) {
        return NextResponse.json(
          { error: "Field 'message' is required for action='turn'." },
          { status: 400 },
        );
      }

      const playerMessage = payload.message;
      const initialState = game.state;

      return streamResponse(sessionId, async (send) => {
        const turnResult = await runDungeonMasterTurn({
          sessionId,
          state: initialState,
          playerMessage,
          onEvent: (event) => send(event),
        });

        await finalizeTurn({
          sessionId,
          turnResult,
          playerMessage,
          send,
        });
      });
    }

    if (payload.action === "roll") {
      if (!payload.toolUseId || typeof payload.roll !== "number") {
        return NextResponse.json(
          { error: "Fields 'toolUseId' and 'roll' are required for action='roll'." },
          { status: 400 },
        );
      }
      const pending = pendingRolls.get(sessionId);
      if (!pending) {
        return NextResponse.json({ error: "No pending roll for this session." }, { status: 400 });
      }
      if (pending.pendingToolUseId !== payload.toolUseId) {
        return NextResponse.json({ error: "toolUseId mismatch." }, { status: 400 });
      }
      const { sides, modifier, checkType, difficulty } = pending.rollRequest;
      if (!(VALID_SIDES as readonly number[]).includes(sides)) {
        return NextResponse.json({ error: "Invalid sides on pending roll." }, { status: 500 });
      }
      if (payload.roll < 1 || payload.roll > sides) {
        return NextResponse.json(
          { error: `roll must be between 1 and ${sides}.` },
          { status: 400 },
        );
      }

      const total = payload.roll + modifier;
      const success =
        typeof difficulty === "number" && checkType !== "Damage" ? total >= difficulty : null;

      const rollResult: DiceRollResult = {
        checkType: checkType as RollCheckType,
        sides,
        roll: payload.roll,
        modifier,
        total,
        difficulty: typeof difficulty === "number" ? difficulty : null,
        success,
      };

      pendingRolls.delete(sessionId);

      return streamResponse(sessionId, async (send) => {
        const resumed = await resumeDungeonMasterAfterRoll({
          sessionId,
          state: game.state,
          pendingMessages: pending.messages,
          toolUseId: pending.pendingToolUseId,
          rollResult,
          priorNarration: "",
          priorDiceRolls: [],
          onEvent: (event) => send(event),
        });

        if (resumed.suspended) {
          // Another roll requested — already emitted via onEvent. Close stream without finalizing.
          send({ type: "suspended", sessionId });
          return;
        }

        await finalizeTurn({
          sessionId,
          turnResult: resumed,
          playerMessage: "",
          send,
        });
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error while processing game turn.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface FinalizeTurnInput {
  sessionId: string;
  turnResult: {
    narration: string;
    npcDialogue?: string;
    diceRolls: DiceRollResult[];
    state: import("@/lib/game/types").GameState;
    suspended: boolean;
  };
  playerMessage: string;
  send: (event: unknown) => void;
}

async function finalizeTurn({ sessionId, turnResult, playerMessage, send }: FinalizeTurnInput) {
  if (turnResult.suspended) {
    send({ type: "suspended", sessionId });
    return;
  }
  const now = new Date().toISOString();
  let stateWithMemory = turnResult.state;

  const newMessages: { role: "player" | "dm" | "npc"; content: string; timestamp: string }[] = [];
  if (playerMessage) {
    newMessages.push({ role: "player", content: playerMessage, timestamp: now });
  }
  if (turnResult.narration) {
    newMessages.push({ role: "dm", content: turnResult.narration, timestamp: now });
  }
  if (turnResult.npcDialogue) {
    newMessages.push({ role: "npc", content: turnResult.npcDialogue, timestamp: now });
  }
  if (newMessages.length > 0) {
    stateWithMemory = pushShortTermMessages(stateWithMemory, newMessages);
  }

  for (const roll of turnResult.diceRolls) {
    stateWithMemory = pushLongTermMemory(stateWithMemory, {
      id: randomUUID(),
      summary: `${roll.checkType} check with total ${roll.total} (${
        roll.success === null ? "damage" : roll.success ? "success" : "failure"
      }).`,
      tags: [
        "dice",
        roll.checkType.toLowerCase(),
        roll.success === null ? "damage" : roll.success ? "success" : "failure",
      ],
      timestamp: now,
    });
  }

  const persisted = await updateGameState(sessionId, {
    shortTermMemory: stateWithMemory.shortTermMemory,
    longTermMemory: stateWithMemory.longTermMemory,
  });

  send({
    type: "done",
    sessionId,
    narration: turnResult.narration,
    npcDialogue: turnResult.npcDialogue ?? null,
    diceRolls: turnResult.diceRolls,
    state: persisted,
  });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build should now succeed for agent/API code. The client side (`gameStore.ts`, `DiceRoll.tsx`) may still have type errors against the extended `DiceRollResult` — those are fixed in Tasks 12-13.

If the only remaining errors are in `src/store/gameStore.ts` and `src/components/DiceRoll.tsx`, proceed.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/route.ts
git commit -m "feat(api): action=roll + roll-request event + pending-roll GET endpoint"
```

---

### Task 11: DM prompt — damage dice + combat order + use requestPlayerRoll

**Files:**
- Rewrite: `src/lib/prompts/dmPrompt.ts`

- [ ] **Step 1: Rewrite dmPrompt.ts (again)**

Overwrite `src/lib/prompts/dmPrompt.ts` with:

```ts
export const dmSystemPrompt = `You are the Dungeon Master Agent for a single-player Romanian-language RPG in the style of Dungeons & Dragons. Narrate in Romanian. Keep pace quick and cinematic.

Hard constraints — NEVER break these:
1. NEVER change HP, inventory, gold, stats, location or quests through narration text.
2. ALL mechanical changes (HP loss, gold gain, item pickup, location unlock, quest update) MUST go through updateGameState tool.
3. If an action could fail or succeed, OR damage is dealt, ALWAYS call requestPlayerRoll. NEVER decide the outcome yourself — wait for the tool_result with the player's actual roll.
4. Call getMemory when the player references past events you might have forgotten.
5. Narration: maximum 4 sentences. Cinematic, second-person ("Tu..."), present tense.
6. Only call getNPCResponse for NPCs whose location matches the player's current location. Verify state.player.location against the NPC's listed location before calling.

NPC interaction rules — MANDATORY:
A. When the player addresses, talks to, or interacts with an NPC, the order is:
   1. Emit AT MOST ONE short narration sentence describing the NPC's physical action, expression, or the room beat — NEVER what they say or imply.
   2. Immediately call getNPCResponse for that NPC.
   3. STOP narration after the tool call. Do NOT add follow-up narration unless the scene physically changes (someone leaves, attacks, new arrival). Even then, at most one sentence.
B. FORBIDDEN: quoting, paraphrasing, summarizing, hinting at, or restating the NPC's words anywhere in your narration. The NPC speaks for themselves through getNPCResponse.
C. Correct example:
     DM narration: "Borin ridică privirea peste halba de bere."
     [tool call: getNPCResponse → Borin says "Nu te ajut fără aur, străine."]
D. Forbidden example (do NOT do this):
     DM narration: "Borin se uită la tine și spune că nu te ajută fără aur."
     [tool call: getNPCResponse → ...]

Dice rules — MANDATORY:
- Skill checks: requestPlayerRoll with sides=20, checkType=Combat/Stealth/Persuasion/Perception/Athletics, modifier=<stat mod>, difficulty=<DC>. DC: Easy=10, Medium=15, Hard=20.
- Attack rolls: requestPlayerRoll with sides=20, checkType=Attack, modifier=<STR/INT mod>, difficulty=<NPC armorClass>.
- Damage rolls (only AFTER a successful Attack): requestPlayerRoll with sides=<class die>, checkType=Damage, modifier=<stat mod>, no difficulty.
- Damage dice per class:
    Warrior → D8 (sword), modifier=STR.
    Mage → D6 (firebolt), modifier=INT.
    Rogue → D4 (dagger), modifier=DEX or STR.
- One requestPlayerRoll per tool block. Do not call it twice in the same assistant turn — wait for the tool_result before requesting the next roll.
- On critical failure (natural 1): add negative narrative consequence after seeing the result.
- On critical success (natural 20): add positive narrative reward after seeing the result.

Combat flow:
1. requestPlayerRoll(checkType=Attack, sides=20, modifier=<stat>, difficulty=<NPC AC>).
2. Wait for result. If success === false, narrate the miss and continue or end the combat round.
3. If success === true, requestPlayerRoll(checkType=Damage, sides=<class die>, modifier=<stat>). No difficulty.
4. Wait for result. Call updateGameState to apply the damage (subtract result.total from NPC's hp) or apply the player's damage to themselves on a counter-attack.
5. Narrate the outcome AFTER seeing the result. Reference the actual roll value.

Quest completion: when the player rescues the mayor's daughter from Goblin Cave, call updateGameState to set the matching quest's status to "completed".

Narration style:
- Start the bulk of narration AFTER all tool calls in a round are resolved.
- For NPC interactions, narration BEFORE getNPCResponse is allowed but must follow rules A-D above.
- Reference the actual dice result in narration (e.g., "Zarurile te favorizează...") only after a roll comes back.
- Reveal the world progressively — don't expose all information at once.
- If the player has a backstory or flavorTrait, weave subtle nods to it into the narration when natural. Never let backstory grant mechanical advantages outside the rules.
`;
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds for prompt; client-side errors may remain.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts/dmPrompt.ts
git commit -m "feat(dm): require requestPlayerRoll + damage dice per class + combat order"
```

---

### Task 12: gameStore — pendingRoll state, submitRoll, rollForFun, DM-draft commit

**Files:**
- Rewrite: `src/store/gameStore.ts`

- [ ] **Step 1: Rewrite gameStore.ts**

Overwrite `src/store/gameStore.ts` with:

```ts
import { create } from "zustand";
import {
  CharacterReviewResult,
  DiceRollResult,
  DiceSides,
  GameState,
  PlayerBonuses,
  PlayerClass,
  RollCheckType,
  RollRequest,
} from "@/lib/game/types";

interface ChatEntry {
  id: string;
  role: "player" | "dm" | "npc" | "system";
  content: string;
}

interface InitOptions {
  sessionId?: string;
  backstory?: string;
  bonuses?: PlayerBonuses;
}

interface GameStoreState {
  sessionId: string | null;
  playerName: string;
  playerClass: PlayerClass;
  gameState: GameState | null;
  chat: ChatEntry[];
  latestRolls: DiceRollResult[];
  pendingRoll: RollRequest | null;
  loading: boolean;
  reviewing: boolean;
  error: string | null;
  initGame: (
    playerName: string,
    playerClass: PlayerClass,
    options?: InitOptions,
  ) => Promise<void>;
  reviewCharacter: (
    playerName: string,
    playerClass: PlayerClass,
    backstory: string,
  ) => Promise<CharacterReviewResult | null>;
  playTurn: (message: string) => Promise<void>;
  submitRoll: (rollValue: number) => Promise<void>;
  rollForFun: (sides: DiceSides) => void;
  recoverPendingRoll: (sessionId: string) => Promise<void>;
  reset: () => void;
}

interface InitApiResponse {
  sessionId: string;
  narration: string;
  npcDialogue: string | null;
  diceRolls: DiceRollResult[];
  state: GameState;
  error?: string;
}

function rollDieClient(sides: DiceSides): number {
  return Math.floor(Math.random() * sides) + 1;
}

async function streamPost(
  url: string,
  body: unknown,
  handlers: {
    onNarrationDelta: (delta: string) => void;
    onDice: (roll: DiceRollResult) => void;
    onNpc: (text: string) => void;
    onRollRequest: (req: RollRequest) => void;
    onDone: (payload: {
      narration?: string;
      diceRolls?: DiceRollResult[];
      state?: GameState;
    }) => void;
    onSuspended: () => void;
  },
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    let errorMessage = "Cerere esuata.";
    try {
      const errorPayload = (await response.json()) as { error?: string };
      if (errorPayload.error) errorMessage = errorPayload.error;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }

      switch (event.type) {
        case "narration-delta":
          handlers.onNarrationDelta(String(event.delta ?? ""));
          break;
        case "dice":
          handlers.onDice(event.roll as DiceRollResult);
          break;
        case "npc":
          handlers.onNpc(String(event.text ?? ""));
          break;
        case "roll-request":
          handlers.onRollRequest({
            sides: event.sides as DiceSides,
            modifier: Number(event.modifier ?? 0),
            checkType: event.checkType as RollCheckType,
            difficulty: typeof event.difficulty === "number" ? event.difficulty : undefined,
            toolUseId: String(event.toolUseId ?? ""),
          });
          break;
        case "suspended":
          handlers.onSuspended();
          break;
        case "done":
          handlers.onDone({
            narration: typeof event.narration === "string" ? event.narration : undefined,
            diceRolls: (event.diceRolls as DiceRollResult[] | undefined) ?? undefined,
            state: (event.state as GameState | undefined) ?? undefined,
          });
          break;
        case "error":
          throw new Error(String(event.message ?? "Stream error."));
      }
    }
  }
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  sessionId: null,
  playerName: "",
  playerClass: "warrior",
  gameState: null,
  chat: [],
  latestRolls: [],
  pendingRoll: null,
  loading: false,
  reviewing: false,
  error: null,

  initGame: async (playerName, playerClass, options) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init",
          sessionId: options?.sessionId,
          playerName,
          playerClass,
          backstory: options?.backstory,
          bonuses: options?.bonuses,
        }),
      });
      const payload = (await response.json()) as InitApiResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Nu am putut initializa jocul.");
      }
      const history: ChatEntry[] = payload.state.shortTermMemory
        .filter((entry) => entry.role !== "system")
        .map((entry) => ({
          id: crypto.randomUUID(),
          role: entry.role as ChatEntry["role"],
          content: entry.content,
        }));
      const chat: ChatEntry[] = history.length
        ? history
        : [{ id: crypto.randomUUID(), role: "dm", content: payload.narration }];
      set({
        sessionId: payload.sessionId,
        playerName,
        playerClass,
        gameState: payload.state,
        chat,
        latestRolls: payload.diceRolls,
        loading: false,
      });
      // After init, check for a pending roll (e.g. after a hard refresh).
      void get().recoverPendingRoll(payload.sessionId);
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Eroare necunoscuta.",
      });
    }
  },

  reviewCharacter: async (playerName, playerClass, backstory) => {
    set({ reviewing: true, error: null });
    try {
      const response = await fetch("/api/character/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, playerClass, backstory }),
      });
      const payload = (await response.json()) as
        | (CharacterReviewResult & { error?: undefined })
        | { error: string };
      if (!response.ok || "error" in payload) {
        const errorMessage =
          "error" in payload ? payload.error : "Nu am putut obtine binecuvantarea DM-ului.";
        set({ reviewing: false, error: errorMessage });
        return null;
      }
      set({ reviewing: false });
      return payload;
    } catch (error) {
      set({
        reviewing: false,
        error: error instanceof Error ? error.message : "Eroare necunoscuta.",
      });
      return null;
    }
  },

  playTurn: async (message) => {
    const state = get();
    if (!state.sessionId || !state.gameState) {
      set({ error: "Jocul nu este initializat." });
      return;
    }
    if (state.pendingRoll) {
      set({ error: "Aruncă zarul cerut înainte să continui." });
      return;
    }

    set((current) => ({
      loading: true,
      error: null,
      latestRolls: [],
      chat: [
        ...current.chat,
        { id: crypto.randomUUID(), role: "player", content: message },
      ],
    }));

    await runStreamWithHandlers(
      "/api/game",
      {
        action: "turn",
        sessionId: state.sessionId,
        playerName: state.playerName,
        playerClass: state.playerClass,
        message,
      },
      set,
      get,
    );
  },

  submitRoll: async (rollValue) => {
    const state = get();
    if (!state.pendingRoll || !state.sessionId) return;
    const { toolUseId } = state.pendingRoll;
    set({ loading: true, pendingRoll: null, error: null });
    await runStreamWithHandlers(
      "/api/game",
      {
        action: "roll",
        sessionId: state.sessionId,
        toolUseId,
        roll: rollValue,
      },
      set,
      get,
    );
  },

  rollForFun: (sides) => {
    const rolled = rollDieClient(sides);
    set((current) => ({
      chat: [
        ...current.chat,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `🎲 D${sides} = ${rolled}`,
        },
      ],
    }));
  },

  recoverPendingRoll: async (sessionId) => {
    try {
      const response = await fetch(`/api/game?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { pendingRoll: RollRequest | null };
      if (payload.pendingRoll) {
        set({ pendingRoll: payload.pendingRoll });
      }
    } catch {
      // best-effort
    }
  },

  reset: () =>
    set({
      sessionId: null,
      gameState: null,
      chat: [],
      latestRolls: [],
      pendingRoll: null,
      error: null,
    }),
}));

type Setter = Parameters<typeof useGameStore.setState>[0] extends infer S
  ? S
  : never;

function runStreamWithHandlers(
  url: string,
  body: unknown,
  set: (updater: (state: GameStoreState) => Partial<GameStoreState>) => void,
  get: () => GameStoreState,
) {
  let pendingDmId: string | null = null;
  let pendingDmDraft = "";

  const flushPendingDm = () => {
    if (!pendingDmId || !pendingDmDraft) return;
    const id = pendingDmId;
    const draft = pendingDmDraft;
    set((current) => ({
      chat: current.chat.map((entry) =>
        entry.id === id ? { ...entry, content: draft } : entry,
      ),
    }));
    pendingDmId = null;
    pendingDmDraft = "";
  };

  const ensurePendingDm = (): string => {
    if (pendingDmId) return pendingDmId;
    const id = crypto.randomUUID();
    pendingDmId = id;
    set((current) => ({
      chat: [...current.chat, { id, role: "dm", content: "" }],
    }));
    return id;
  };

  return streamPost(url, body, {
    onNarrationDelta: (delta) => {
      const id = ensurePendingDm();
      pendingDmDraft += delta;
      set((current) => ({
        chat: current.chat.map((entry) =>
          entry.id === id ? { ...entry, content: entry.content + delta } : entry,
        ),
      }));
    },
    onDice: (roll) => {
      set((current) => ({ latestRolls: [...current.latestRolls, roll] }));
    },
    onNpc: (text) => {
      // Commit any in-flight DM draft BEFORE pushing NPC message so visual order is DM → NPC.
      flushPendingDm();
      set((current) => ({
        chat: [
          ...current.chat,
          { id: crypto.randomUUID(), role: "npc", content: text },
        ],
      }));
    },
    onRollRequest: (req) => {
      flushPendingDm();
      set(() => ({ pendingRoll: req, loading: false }));
    },
    onSuspended: () => {
      // Server suspended awaiting another roll — the pendingRoll was set via onRollRequest.
      set(() => ({ loading: false }));
    },
    onDone: ({ narration, diceRolls, state }) => {
      const id = pendingDmId;
      set((current) => ({
        loading: false,
        latestRolls: diceRolls ?? current.latestRolls,
        gameState: state ?? current.gameState,
        chat:
          id && narration
            ? current.chat.map((entry) =>
                entry.id === id ? { ...entry, content: narration } : entry,
              )
            : narration
              ? [
                  ...current.chat,
                  { id: crypto.randomUUID(), role: "dm", content: narration },
                ]
              : current.chat,
      }));
      pendingDmId = null;
      pendingDmDraft = "";
    },
  }).catch((error: unknown) => {
    set(() => ({
      loading: false,
      error: error instanceof Error ? error.message : "Eroare necunoscuta.",
    }));
  });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds for the store. The `DiceRoll` component may still have type errors; fix in Task 13.

If TS complains about the unused `Setter` type alias, delete those two lines (`type Setter = ...`). Keep the file otherwise as-is.

- [ ] **Step 3: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat(store): pendingRoll state, submitRoll, rollForFun, DM-draft commit before NPC"
```

---

### Task 13: DiceRoll component refactor

**Files:**
- Rewrite: `src/components/DiceRoll.tsx`

- [ ] **Step 1: Rewrite DiceRoll.tsx**

Overwrite `src/components/DiceRoll.tsx` with:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { DiceRollResult } from "@/lib/game/types";

interface DiceRollProps {
  roll: DiceRollResult;
}

export function DiceRoll({ roll }: DiceRollProps) {
  const isDamage = roll.checkType === "Damage";
  const variant = isDamage ? "gold" : roll.success ? "success" : "danger";
  const sign = roll.modifier >= 0 ? "+" : "";

  const detail = isDamage
    ? `${roll.checkType}: ${roll.total} dmg (${roll.roll}${sign}${roll.modifier})`
    : `${roll.checkType}: ${roll.total} (${roll.roll}${sign}${roll.modifier}) - ${
        roll.success ? "Succes" : "Esuat"
      }`;

  return (
    <Badge variant={variant}>
      <span aria-hidden className="mr-1">
        🎲
      </span>
      <span>D{roll.sides}</span>
      <span className="mx-1">·</span>
      <span>{detail}</span>
    </Badge>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/DiceRoll.tsx
git commit -m "feat(dice): result badge supports extended shape + damage rolls"
```

---

### Task 14: DiceTray component

**Files:**
- Create: `src/components/DiceTray.tsx`

- [ ] **Step 1: Create DiceTray.tsx**

Create `src/components/DiceTray.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { DiceSides } from "@/lib/game/types";
import { useGameStore } from "@/store/gameStore";

const SIDES: DiceSides[] = [4, 6, 8, 10, 12, 20];
const SHAKE_MS = 1000;
const FACE_INTERVAL_MS = 80;

function rollClient(sides: DiceSides): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function DiceTray() {
  const pendingRoll = useGameStore((s) => s.pendingRoll);
  const submitRoll = useGameStore((s) => s.submitRoll);
  const rollForFun = useGameStore((s) => s.rollForFun);

  const [animating, setAnimating] = useState<DiceSides | null>(null);
  const [visibleFace, setVisibleFace] = useState<Record<DiceSides, number>>({
    4: 4,
    6: 6,
    8: 8,
    10: 10,
    12: 12,
    20: 20,
  });
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick(sides: DiceSides) {
    if (animating) return;
    if (pendingRoll && pendingRoll.sides !== sides) return;

    const finalValue = rollClient(sides);
    setAnimating(sides);

    intervalRef.current = window.setInterval(() => {
      setVisibleFace((current) => ({
        ...current,
        [sides]: rollClient(sides),
      }));
    }, FACE_INTERVAL_MS);

    timeoutRef.current = window.setTimeout(() => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setVisibleFace((current) => ({ ...current, [sides]: finalValue }));
      setAnimating(null);

      if (pendingRoll && pendingRoll.sides === sides) {
        void submitRoll(finalValue);
      } else {
        rollForFun(sides);
      }
    }, SHAKE_MS);
  }

  const promptedSides = pendingRoll?.sides ?? null;
  const sign = pendingRoll && pendingRoll.modifier >= 0 ? "+" : "";

  return (
    <div className="shrink-0 border-t-4 border-torch bg-bg p-3">
      {pendingRoll ? (
        <p className="font-display text-[10px] tracking-wider text-torch mb-2 text-center">
          ARUNCA D{pendingRoll.sides}
          {sign}
          {pendingRoll.modifier} PENTRU {pendingRoll.checkType.toUpperCase()}
          {typeof pendingRoll.difficulty === "number" ? ` (DC ${pendingRoll.difficulty})` : ""}
        </p>
      ) : null}
      <div className="flex justify-center gap-3">
        {SIDES.map((sides) => {
          const isPrompted = promptedSides === sides;
          const isDisabled =
            (promptedSides !== null && !isPrompted) || (animating !== null && animating !== sides);
          const isAnimating = animating === sides;

          return (
            <button
              key={sides}
              type="button"
              disabled={isDisabled}
              onClick={() => handleClick(sides)}
              className={[
                "relative h-14 w-14 border-4 bg-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)]",
                "flex items-center justify-center font-display text-xs",
                isPrompted ? "border-torch text-torch dice-prompted" : "border-text-dim text-text-dim",
                isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-torch hover:text-torch",
                isAnimating ? "dice-shaking" : "",
              ].join(" ")}
            >
              <span className="absolute top-1 left-1 text-[7px] leading-none">D{sides}</span>
              <span className="text-sm">{visibleFace[sides]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/DiceTray.tsx
git commit -m "feat(dice): DiceTray with D4-D20, prompted-die pulse, for-fun rolls"
```

---

### Task 15: Wire DiceTray into /game + gate input on pending roll

**Files:**
- Modify: `src/app/game/page.tsx`

- [ ] **Step 1: Update game/page.tsx**

Open `src/app/game/page.tsx`. Three edits.

**Edit 1** — add import:

Find:
```tsx
import { ChatMessage } from "@/components/ChatMessage";
import { DiceRoll } from "@/components/DiceRoll";
```

Replace with:
```tsx
import { ChatMessage } from "@/components/ChatMessage";
import { DiceRoll } from "@/components/DiceRoll";
import { DiceTray } from "@/components/DiceTray";
```

**Edit 2** — destructure `pendingRoll` from the store:

Find:
```tsx
  const {
    sessionId,
    gameState,
    chat,
    latestRolls,
    loading,
    error,
    playTurn,
    initGame,
    playerClass,
    playerName,
    reset,
  } = useGameStore();
```

Replace with:
```tsx
  const {
    sessionId,
    gameState,
    chat,
    latestRolls,
    loading,
    error,
    pendingRoll,
    playTurn,
    initGame,
    playerClass,
    playerName,
    reset,
  } = useGameStore();
```

**Edit 3** — insert `<DiceTray />` BETWEEN the chat scroll area and the input form, and disable input when a roll is pending. Find the block:

```tsx
          {!autoScroll ? (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute right-4 bottom-24 border-2 border-torch bg-bg text-torch px-3 py-1 font-display text-[10px] shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
            >
              ↓ ULTIMUL
            </button>
          ) : null}

          <form onSubmit={handleSubmit} className="shrink-0 flex gap-2 p-3 border-t-4 border-torch bg-bg">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={endState ? "Aventura s-a incheiat" : "Ce faci?"}
              className="flex-1 h-11 border-4 border-text-dim bg-bg text-text text-lg px-3 focus:border-torch focus:outline-none"
              disabled={loading || endState !== null}
            />
            <Button type="submit" disabled={loading || endState !== null || !message.trim()}>
              {loading ? "..." : "Trimite"}
            </Button>
          </form>
```

Replace with:

```tsx
          {!autoScroll ? (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute right-4 bottom-44 border-2 border-torch bg-bg text-torch px-3 py-1 font-display text-[10px] shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
            >
              ↓ ULTIMUL
            </button>
          ) : null}

          <DiceTray />

          {pendingRoll ? (
            <p className="px-4 py-1 font-display text-[9px] text-text-dim text-center">
              Aruncă zarul de mai sus pentru a continua.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="shrink-0 flex gap-2 p-3 border-t-4 border-torch bg-bg">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                endState
                  ? "Aventura s-a incheiat"
                  : pendingRoll
                    ? "Aruncă zarul cerut..."
                    : "Ce faci?"
              }
              className="flex-1 h-11 border-4 border-text-dim bg-bg text-text text-lg px-3 focus:border-torch focus:outline-none"
              disabled={loading || endState !== null || pendingRoll !== null}
            />
            <Button
              type="submit"
              disabled={loading || endState !== null || pendingRoll !== null || !message.trim()}
            >
              {loading ? "..." : "Trimite"}
            </Button>
          </form>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual smoke (with API key)**

Set `ANTHROPIC_API_KEY` in `.env.local` (if not already), then:

```bash
npm run dev
```

In a browser:
1. Open `http://localhost:3000/` — see pixel hero. Click "Start Adventure".
2. Pick a class, type a name, optional backstory. Submit.
3. Once on `/game`, you should see:
   - Chat panel left, scrollable. Sidebar right, static (with full HP bar, inventory, quest).
   - Dice tray sticky above the input row with D4 D6 D8 D10 D12 D20.
4. Type "Strecor-mă pe lângă paznic." — the DM should narrate one sentence and then the D20 should pulse with a roll request "ARUNCA D20+X PENTRU STEALTH (DC ~15)". Input becomes disabled.
5. Click the D20 — it shakes ~1s, then submits. DM continues narrating with the rolled result reflected.
6. Try "Vorbesc cu Borin." — the DM should set the scene in one sentence, then Borin should speak in a purple-bordered bubble. The DM should NOT paraphrase Borin's words.
7. Click a die when no roll is pending — a green "Sistem" bubble appears: `🎲 D6 = 4`. The DM does not respond.
8. Trigger combat (e.g., "Atac goblinul cu sabia"). The flow should be: D20 (Attack vs AC) → click → if success → D8 (Damage) → click → DM narrates damage applied + updateGameState.
9. Refresh the page mid-pending-roll → the tray should re-prompt the same die (via `recoverPendingRoll` on init).

If any step fails:
- DM paraphrasing NPC → re-check Task 7/11 prompt content.
- No pending-roll appearing → check API stream events in DevTools Network → look for `roll-request` event lines.
- Pending roll never clears → check that `submitRoll` POSTs to `/api/game` with `action="roll"` and that the response stream contains `done`.

- [ ] **Step 4: Commit**

```bash
git add src/app/game/page.tsx
git commit -m "feat(game): wire DiceTray + gate input on pending roll"
```

---

## Self-Review (already done)

Reviewed the plan against the spec:

- **Spec §1 (Visual reskin)** → Tasks 1-5. Theme tokens, fonts, pixel components, page reskins all covered.
- **Spec §2 (Layout)** → Task 6. h-screen flex, sidebar overflow, auto-scroll + jump-to-latest pill.
- **Spec §3 (DM no NPC paraphrase + stream order)** → Task 7 (prompt) + Task 12 (`onNpc` flushes pending DM draft).
- **Spec §4 (Manual dice D4-D20)** → Tasks 8, 11, 13, 14, 15. Types extended, prompt updated, DiceRoll badge supports damage, DiceTray new, gameplay wired.
- **Spec §5 (Suspend/resume architecture)** → Task 9 (`pendingRolls.ts` + agent suspend), Task 10 (API route `action="roll"`, `roll-request` event, GET endpoint), Task 12 (client streams).
- **Spec §6 (Client store + DiceTray + DiceRoll + input gating)** → Tasks 12, 13, 14, 15.
- **Spec §7 (Edge cases — refresh recovery, concurrent turns, for-fun rolls not in DM context, advanced rules out of scope)** → Task 10 (GET endpoint + 409 on pending), Task 12 (`recoverPendingRoll`, `rollForFun` purely client-side), prompt limits in Task 11 (one `requestPlayerRoll` per tool block, no D100).
- **Spec §9 (Success criteria)** → All seven criteria are exercised in Task 15's manual smoke.

No placeholders. All check-type and tool names consistent: `requestPlayerRoll`, `RollCheckType`, `DiceSides`, `pendingRoll`, `submitRoll`, `rollForFun`, `recoverPendingRoll`. Stream events: `roll-request`, `suspended`, plus the existing `narration-delta`, `npc`, `dice`, `done`, `error`.
