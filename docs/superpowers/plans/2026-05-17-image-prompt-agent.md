# Image Prompt Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third Claude-driven agent that writes 8-bit pixel-art prompts for player avatars and inventory items, expose it via a new `/api/image` endpoint with server-side caching, and wire it into the character page (with a re-roll button) and the inventory sidebar (hover popover).

**Architecture:** New agent module (`imagePrompt.ts`) calls Claude with a hard-coded 8-bit style mandate and returns a `{url, prompt, seed}` triple where `url` is built on the existing free pollinations.ai endpoint. A small `imageCache.ts` deduplicates item generations across sessions using the existing dual-mode persistence pattern (file in dev, in-memory on Vercel). Frontend gets a generate/re-roll button on the character page and a lazy-loaded hover popover for inventory items. The existing deterministic `buildAvatarSpec` stays as a graceful fallback if the LLM is unavailable.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind, Zustand, `@anthropic-ai/sdk`, pollinations.ai (no key). **No test framework is installed in this project** — verification is `npm run build` (TypeScript strict + `next lint`) plus targeted manual smoke checks. Do NOT add a test framework in this phase.

**Spec reference:** `docs/superpowers/specs/2026-05-17-image-prompt-agent-design.md`

---

## File Structure

| File | Type | Task |
|------|------|------|
| `src/lib/game/types.ts` | modify | 1 |
| `src/lib/tools/avatar.ts` | modify | 1 |
| `src/lib/tools/imageCache.ts` | create | 2 |
| `src/lib/prompts/imagePromptAgent.ts` | create | 3 |
| `src/lib/agents/imagePrompt.ts` | create | 3 |
| `src/app/api/image/route.ts` | create | 4 |
| `src/lib/tools/gameState.ts` | modify | 5 |
| `src/app/api/game/route.ts` | modify | 5 |
| `src/store/gameStore.ts` | modify | 6 |
| `src/components/AvatarPreview.tsx` | create | 7 |
| `src/app/character/page.tsx` | modify | 8 |
| `src/components/ItemPopover.tsx` | create | 9 |
| `src/components/StatsSidebar.tsx` | modify | 10 |

No new dependencies. No tests.

---

## Phase 1 — Core pipeline (Tasks 1-4)

### Task 1: Types extension + 8-bit style suffix

**Files:**
- Modify: `src/lib/game/types.ts`
- Modify: `src/lib/tools/avatar.ts`

- [ ] **Step 1: Add `GeneratedImage` to types.ts**

Open `src/lib/game/types.ts`. Right after the existing `RollRequest` interface, add:

```ts
export interface GeneratedImage {
  url: string;
  prompt: string;
  seed: number;
}
```

- [ ] **Step 2: Update `STYLE_SUFFIX` in avatar.ts to 8-bit**

Open `src/lib/tools/avatar.ts`. Replace the existing `STYLE_SUFFIX` constant:

```ts
const STYLE_SUFFIX =
  "fantasy RPG character portrait, head and shoulders, painterly digital art, " +
  "soft volumetric lighting, vivid color, intricate detail, centered composition";
```

with:

```ts
const STYLE_SUFFIX =
  "8-bit pixel art sprite, NES JRPG style, 16-color palette, " +
  "sharp pixel edges, head and shoulders, plain dark background, centered composition, no text";
```

Leave the rest of the file unchanged.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/types.ts src/lib/tools/avatar.ts
git commit -m "feat(image): add GeneratedImage type + 8-bit style suffix"
```

---

### Task 2: imageCache module (file-backed + in-memory)

**Files:**
- Create: `src/lib/tools/imageCache.ts`

- [ ] **Step 1: Create imageCache.ts**

Create `src/lib/tools/imageCache.ts` with:

```ts
import { promises as fs } from "fs";
import path from "path";
import { GeneratedImage, ItemRarity } from "@/lib/game/types";

const CACHE_PATH = path.join(process.cwd(), "data", "image-cache.json");

const useMemoryStore = !!process.env.VERCEL;

const memoryStore = new Map<string, GeneratedImage>();

type StoreShape = Record<string, GeneratedImage>;

async function readStore(): Promise<StoreShape> {
  if (useMemoryStore) {
    return Object.fromEntries(memoryStore);
  }
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as StoreShape;
    }
    return {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    console.warn("[imageCache] failed to read cache; starting empty", error);
    return {};
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  if (useMemoryStore) {
    memoryStore.clear();
    for (const [k, v] of Object.entries(store)) {
      memoryStore.set(k, v);
    }
    return;
  }
  await fs.writeFile(CACHE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export const imageCache = {
  buildItemKey(name: string, rarity: ItemRarity): string {
    return `item:${normalize(name)}:${rarity}`;
  },

  async get(key: string): Promise<GeneratedImage | undefined> {
    const store = await readStore();
    return store[key];
  },

  async set(key: string, value: GeneratedImage): Promise<void> {
    const store = await readStore();
    store[key] = value;
    await writeStore(store);
  },
};
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tools/imageCache.ts
git commit -m "feat(image): dual-mode imageCache (file local, in-memory on Vercel)"
```

---

### Task 3: Image Prompt Agent (system prompt + agent)

**Files:**
- Create: `src/lib/prompts/imagePromptAgent.ts`
- Create: `src/lib/agents/imagePrompt.ts`

- [ ] **Step 1: Create the system prompt**

Create `src/lib/prompts/imagePromptAgent.ts` with:

```ts
export const imagePromptAgentSystemPrompt = `You are the Image Prompt Agent for a fantasy text RPG. You translate game-side requests into concise prompts for an image generator that always renders in 8-bit pixel-art style.

Output rules — NEVER break these:
1. Return ONLY the image prompt string. No commentary, no markdown fences, no greetings, no JSON.
2. The output is a single line, no more than 400 characters.
3. The output MUST end with this exact suffix (with the leading comma and space included):
   , 8-bit pixel art sprite, NES JRPG style, 32x32 grid implied, 16-color palette, sharp pixel edges, plain dark background, centered composition, no text
4. Do NOT include nudity, gore beyond cartoon scratches, real-person names, or copyrighted IP names.

For avatar requests (input.kind === "avatar"):
- Subject is the player character (head and shoulders).
- Use the playerClass to set silhouette and gear: warrior = heavy armor + sword/shield; mage = robe + staff or rune trinket; rogue = hood + dagger or leather; ranger = bow + cloak; cleric = symbol + mace.
- If backstory is provided, weave 1-2 concrete visible details from it (e.g. "scar across cheek", "white hair", "missing eye", "freckles"). Keep them visual, not narrative.
- nameHint, if any, is not displayed — use it only as light flavor.

For item requests (input.kind === "item"):
- Subject is a single inventory item rendered side-on or 3/4 view.
- Use rarity to set visual richness:
  common  → plain, well-used, dull metal
  uncommon → subtle ornamentation, polished
  rare → fine craftsmanship, faint glow accent
  epic → elaborate detailing, magical aura, gem
  legendary → strong golden glow, ornate engraving, otherworldly
- Use the itemName to determine the silhouette (sword, potion, scroll, shield, etc.). Infer category from the noun in the name.

Example correct outputs:
- "young human warrior with a deep scar across one cheek, auburn beard, steel circlet, plate armor pauldrons holding a longsword, 8-bit pixel art sprite, NES JRPG style, 32x32 grid implied, 16-color palette, sharp pixel edges, plain dark background, centered composition, no text"
- "ornate longsword with a faint blue glow along the blade, leather-wrapped hilt, gem in the pommel, 8-bit pixel art sprite, NES JRPG style, 32x32 grid implied, 16-color palette, sharp pixel edges, plain dark background, centered composition, no text"
`;
```

- [ ] **Step 2: Create the agent module**

Create `src/lib/agents/imagePrompt.ts` with:

```ts
import { getAnthropicClient, getAnthropicModel } from "@/lib/agentClient";
import {
  GeneratedImage,
  ItemRarity,
  PlayerClass,
} from "@/lib/game/types";
import { imagePromptAgentSystemPrompt } from "@/lib/prompts/imagePromptAgent";
import { buildAvatarSpec } from "@/lib/tools/avatar";

export type ImagePromptInput =
  | {
      kind: "avatar";
      playerClass: PlayerClass;
      backstory?: string;
      nameHint?: string;
    }
  | {
      kind: "item";
      itemName: string;
      rarity: ItemRarity;
    };

function sanitizePrompt(input: string): string {
  return input
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function buildPollinationsUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=256&height=256&nologo=true&seed=${seed}`;
}

function templateFallback(input: ImagePromptInput, seed: number): GeneratedImage {
  if (input.kind === "avatar") {
    const spec = buildAvatarSpec(input.playerClass, input.backstory);
    return { prompt: spec.prompt, seed: spec.seed, url: spec.url };
  }
  const rarity = input.rarity;
  const subject = `${rarity} ${input.itemName}`;
  const adjectives: Record<ItemRarity, string> = {
    common: "plain well-used",
    uncommon: "polished with subtle ornamentation",
    rare: "finely crafted with faint glow",
    epic: "elaborately detailed with magical aura",
    legendary: "ornate with strong golden glow",
  };
  const prompt = sanitizePrompt(
    `${subject}, ${adjectives[rarity]}, 8-bit pixel art sprite, NES JRPG style, 16-color palette, sharp pixel edges, plain dark background, centered composition, no text`,
  );
  return { prompt, seed, url: buildPollinationsUrl(prompt, seed) };
}

export async function generateImage(input: ImagePromptInput): Promise<GeneratedImage> {
  const seed = Math.floor(Math.random() * 1_000_000);

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    // No API key — fall back to template.
    return templateFallback(input, seed);
  }
  const model = getAnthropicModel();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 200,
      system: imagePromptAgentSystemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    if (!text) {
      return templateFallback(input, seed);
    }

    const prompt = sanitizePrompt(text);
    return { prompt, seed, url: buildPollinationsUrl(prompt, seed) };
  } catch (error) {
    console.warn("[imagePrompt] LLM call failed; using template fallback", error);
    return templateFallback(input, seed);
  }
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/prompts/imagePromptAgent.ts src/lib/agents/imagePrompt.ts
git commit -m "feat(image): third agent for 8-bit prompts with template fallback"
```

---

### Task 4: API endpoint /api/image

**Files:**
- Create: `src/app/api/image/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/image/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateImage } from "@/lib/agents/imagePrompt";
import { imageCache } from "@/lib/tools/imageCache";

const avatarSchema = z.object({
  kind: z.literal("avatar"),
  playerClass: z.enum(["warrior", "mage", "rogue"]),
  backstory: z.string().max(2000).optional(),
  nameHint: z.string().max(40).optional(),
});

const itemSchema = z.object({
  kind: z.literal("item"),
  itemName: z.string().min(1).max(60),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
});

const bodySchema = z.union([avatarSchema, itemSchema]);

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    if (input.kind === "item") {
      const key = imageCache.buildItemKey(input.itemName, input.rarity);
      const hit = await imageCache.get(key);
      if (hit) {
        return NextResponse.json(hit);
      }
      const result = await generateImage(input);
      await imageCache.set(key, result);
      return NextResponse.json(result);
    }

    const result = await generateImage(input);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error in /api/image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual smoke (optional, requires running dev server)**

Start the dev server (`npm run dev`) and in another terminal:

```bash
curl -sX POST http://localhost:3000/api/image \
  -H 'Content-Type: application/json' \
  -d '{"kind":"item","itemName":"rusty dagger","rarity":"common"}'
```

Expected: JSON body with `url`, `prompt`, `seed`. Re-running the same curl returns the IDENTICAL body (cache hit).

Then try without ANTHROPIC_API_KEY by temporarily unsetting it; the response should still come back (template fallback).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/image/route.ts
git commit -m "feat(api): /api/image endpoint with item-cache hit/miss"
```

---

## Phase 2 — Avatar UX (Tasks 5-8)

### Task 5: Server accepts pre-generated avatarUrl

**Files:**
- Modify: `src/lib/tools/gameState.ts`
- Modify: `src/app/api/game/route.ts`

- [ ] **Step 1: Add `avatarUrl` option in gameState.ts**

Open `src/lib/tools/gameState.ts`. Find the `BuildInitialStateOptions` interface:

```ts
interface BuildInitialStateOptions {
  playerName: string;
  playerClass: PlayerClass;
  backstory?: string;
  bonuses?: PlayerBonuses;
}
```

Replace with:

```ts
interface BuildInitialStateOptions {
  playerName: string;
  playerClass: PlayerClass;
  backstory?: string;
  bonuses?: PlayerBonuses;
  avatarUrl?: string;
}
```

In the same file, locate `buildInitialState` and find this line:

```ts
  const avatar = buildAvatarSpec(playerClass, finalBackstory);
```

Replace with:

```ts
  const avatar = options.avatarUrl
    ? { url: options.avatarUrl }
    : buildAvatarSpec(playerClass, finalBackstory);
```

Then find the `getOrCreateGameState` function signature:

```ts
export async function getOrCreateGameState(options: {
  sessionId?: string;
  playerName: string;
  playerClass: PlayerClass;
  backstory?: string;
  bonuses?: PlayerBonuses;
}): Promise<{ sessionId: string; state: GameState; created: boolean }> {
```

Replace with:

```ts
export async function getOrCreateGameState(options: {
  sessionId?: string;
  playerName: string;
  playerClass: PlayerClass;
  backstory?: string;
  bonuses?: PlayerBonuses;
  avatarUrl?: string;
}): Promise<{ sessionId: string; state: GameState; created: boolean }> {
```

Then inside the same function, find:

```ts
    sessions[sessionId] = buildInitialState({
      playerName: options.playerName,
      playerClass: options.playerClass,
      backstory: options.backstory,
      bonuses: options.bonuses,
    });
```

Replace with:

```ts
    sessions[sessionId] = buildInitialState({
      playerName: options.playerName,
      playerClass: options.playerClass,
      backstory: options.backstory,
      bonuses: options.bonuses,
      avatarUrl: options.avatarUrl,
    });
```

- [ ] **Step 2: Forward avatarUrl in `/api/game` route**

Open `src/app/api/game/route.ts`. Find the `requestSchema` definition and locate the existing fields. Add an `avatarUrl` field:

Find:
```ts
const requestSchema = z.object({
  action: z.enum(["init", "turn", "roll"]).default("turn"),
  sessionId: z.string().optional(),
  playerName: z.string().min(1).default("Hero"),
  playerClass: z.enum(["warrior", "mage", "rogue"]).default("warrior"),
  message: z.string().optional(),
  backstory: z.string().max(2000).optional(),
  bonuses: bonusesSchema,
  toolUseId: z.string().optional(),
  roll: z.number().int().min(1).max(20).optional(),
});
```

Replace with:
```ts
const requestSchema = z.object({
  action: z.enum(["init", "turn", "roll"]).default("turn"),
  sessionId: z.string().optional(),
  playerName: z.string().min(1).default("Hero"),
  playerClass: z.enum(["warrior", "mage", "rogue"]).default("warrior"),
  message: z.string().optional(),
  backstory: z.string().max(2000).optional(),
  bonuses: bonusesSchema,
  toolUseId: z.string().optional(),
  roll: z.number().int().min(1).max(20).optional(),
  avatarUrl: z.string().max(2048).optional(),
});
```

Then find the `getOrCreateGameState` call in the same file:

```ts
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
```

Replace with:

```ts
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
      avatarUrl: payload.avatarUrl,
    });
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tools/gameState.ts src/app/api/game/route.ts
git commit -m "feat(api): accept pre-generated avatarUrl in init payload"
```

---

### Task 6: gameStore plumbs avatarUrl through init

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Extend InitOptions and initGame**

Open `src/store/gameStore.ts`. Find the `InitOptions` interface:

```ts
interface InitOptions {
  sessionId?: string;
  backstory?: string;
  bonuses?: PlayerBonuses;
}
```

Replace with:

```ts
interface InitOptions {
  sessionId?: string;
  backstory?: string;
  bonuses?: PlayerBonuses;
  avatarUrl?: string;
}
```

Then in the `initGame` action, find the POST body:

```ts
        body: JSON.stringify({
          action: "init",
          sessionId: options?.sessionId,
          playerName,
          playerClass,
          backstory: options?.backstory,
          bonuses: options?.bonuses,
        }),
```

Replace with:

```ts
        body: JSON.stringify({
          action: "init",
          sessionId: options?.sessionId,
          playerName,
          playerClass,
          backstory: options?.backstory,
          bonuses: options?.bonuses,
          avatarUrl: options?.avatarUrl,
        }),
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat(store): forward avatarUrl through initGame to /api/game"
```

---

### Task 7: AvatarPreview component

**Files:**
- Create: `src/components/AvatarPreview.tsx`

- [ ] **Step 1: Create AvatarPreview.tsx**

Create `src/components/AvatarPreview.tsx` with:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { GeneratedImage } from "@/lib/game/types";

interface AvatarPreviewProps {
  image: GeneratedImage | null;
  rolling: boolean;
  onReroll: () => void;
}

export function AvatarPreview({ image, rolling, onReroll }: AvatarPreviewProps) {
  const buttonLabel = image ? "🎲 Re-roll Avatar" : "🎲 Generate Avatar";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-64 w-64 border-4 border-torch bg-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
        {image && !rolling ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt="Hero portrait"
            width={256}
            height={256}
            className="h-64 w-64 object-cover"
            style={{ imageRendering: "pixelated" }}
          />
        ) : null}

        {rolling ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/80">
            <div className="text-4xl animate-pulse" aria-hidden>🔥</div>
            <p className="font-display text-[10px] tracking-wider text-torch animate-pulse">
              FORGING PORTRAIT...
            </p>
          </div>
        ) : null}

        {!image && !rolling ? (
          <p className="font-display text-[9px] tracking-wider text-text-dim text-center px-4">
            NO PORTRAIT YET.<br />CLICK BELOW.
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={onReroll}
        disabled={rolling}
      >
        {rolling ? "..." : buttonLabel}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AvatarPreview.tsx
git commit -m "feat(ui): AvatarPreview with rolling overlay + re-roll button"
```

---

### Task 8: Character page integration

**Files:**
- Modify: `src/app/character/page.tsx`

- [ ] **Step 1: Add imports, state, and reroll handler**

Open `src/app/character/page.tsx`. After the existing imports, add:

```tsx
import { AvatarPreview } from "@/components/AvatarPreview";
import { GeneratedImage } from "@/lib/game/types";
```

Inside the `CharacterPage` component, after the existing `useState` calls:

```tsx
  const [review, setReview] = useState<CharacterReviewResult | null>(null);
```

Add:

```tsx
  const [avatar, setAvatar] = useState<GeneratedImage | null>(null);
  const [avatarRolling, setAvatarRolling] = useState(false);
```

- [ ] **Step 2: Add reroll handler and update handleStart**

Find the existing `handleStart` function:

```tsx
  async function handleStart() {
    await initGame(name.trim() || "Hero", playerClass, {
      backstory: backstory.trim() || undefined,
      bonuses: review?.approved ? review.bonuses : undefined,
    });
    router.push("/game");
  }
```

Replace with:

```tsx
  async function rerollAvatar() {
    setAvatarRolling(true);
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "avatar",
          playerClass,
          backstory: backstory.trim() || undefined,
          nameHint: name.trim() || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error("Avatar generation failed.");
      }
      const data = (await response.json()) as GeneratedImage;
      setAvatar(data);
    } catch (err) {
      console.warn("Avatar reroll failed:", err);
    } finally {
      setAvatarRolling(false);
    }
  }

  async function handleStart() {
    // If the player hasn't generated an avatar yet, generate one now so the
    // game starts with a real portrait (LLM-driven) rather than the template
    // fallback baked into buildAvatarSpec.
    let avatarUrl = avatar?.url;
    if (!avatarUrl) {
      setAvatarRolling(true);
      try {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "avatar",
            playerClass,
            backstory: backstory.trim() || undefined,
            nameHint: name.trim() || undefined,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as GeneratedImage;
          avatarUrl = data.url;
          setAvatar(data);
        }
      } catch {
        // Fall through — server will use deterministic fallback.
      } finally {
        setAvatarRolling(false);
      }
    }

    await initGame(name.trim() || "Hero", playerClass, {
      backstory: backstory.trim() || undefined,
      bonuses: review?.approved ? review.bonuses : undefined,
      avatarUrl,
    });
    router.push("/game");
  }
```

- [ ] **Step 3: Render AvatarPreview in the form**

Find the existing block that renders the "Start the adventure" Button. The button is wrapped in a `<Button>` element with `onClick={handleStart}`. Just BEFORE that button, insert the AvatarPreview:

Find:
```tsx
          <Button
            onClick={handleStart}
            disabled={loading || reviewing || !canStart}
            className="w-full"
          >
```

Replace with:
```tsx
          <AvatarPreview
            image={avatar}
            rolling={avatarRolling}
            onReroll={rerollAvatar}
          />

          <Button
            onClick={handleStart}
            disabled={loading || reviewing || avatarRolling || !canStart}
            className="w-full"
          >
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Manual smoke (with API key)**

`npm run dev` → open `/character`. Pick a class, type a backstory like "scarred veteran with raven hair", click "Cere binecuvantarea DM-ului", wait for approval. Then click "🎲 Generate Avatar" — within ~3-5s, an 8-bit portrait appears. Click "🎲 Re-roll Avatar" — a different portrait appears. Click "Start the adventure" — navigate to /game and confirm the sidebar shows the SAME portrait (URL unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/app/character/page.tsx
git commit -m "feat(character): avatar preview + re-roll + pass URL on start"
```

---

## Phase 3 — Item UX (Tasks 9-10)

### Task 9: ItemPopover component

**Files:**
- Create: `src/components/ItemPopover.tsx`

- [ ] **Step 1: Create ItemPopover.tsx**

Create `src/components/ItemPopover.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GeneratedImage, InventoryItem, ItemRarity } from "@/lib/game/types";

interface ItemPopoverProps {
  item: InventoryItem;
  anchorEl: HTMLElement | null;
  open: boolean;
}

// Module-level client cache so re-hovers in the same session are instant.
const clientImageCache = new Map<string, GeneratedImage>();

const RARITY_BORDER: Record<ItemRarity, string> = {
  common: "border-text-dim",
  uncommon: "border-xp",
  rare: "border-gem-blue",
  epic: "border-gem-purple",
  legendary: "border-gold",
};

const RARITY_TEXT: Record<ItemRarity, string> = {
  common: "text-text-dim",
  uncommon: "text-xp",
  rare: "text-gem-blue",
  epic: "text-gem-purple",
  legendary: "text-gold",
};

function cacheKey(item: InventoryItem): string {
  return `${item.name.trim().toLowerCase()}:${item.rarity}`;
}

export function ItemPopover({ item, anchorEl, open }: ItemPopoverProps) {
  const [image, setImage] = useState<GeneratedImage | null>(() =>
    clientImageCache.get(cacheKey(item)) ?? null,
  );
  const [error, setError] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const inflightRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    if (image || inflightRef.current) return;

    const cached = clientImageCache.get(cacheKey(item));
    if (cached) {
      setImage(cached);
      return;
    }

    inflightRef.current = true;
    fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "item",
        itemName: item.name,
        rarity: item.rarity,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Image fetch failed.");
        const data = (await res.json()) as GeneratedImage;
        clientImageCache.set(cacheKey(item), data);
        setImage(data);
      })
      .catch(() => setError(true))
      .finally(() => {
        inflightRef.current = false;
      });
  }, [open, item, image]);

  useEffect(() => {
    if (!open || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 180;
    const popoverHeight = 220;
    // Prefer above the anchor; fall back to below if not enough space.
    const fitsAbove = rect.top >= popoverHeight + 12;
    const top = fitsAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8;
    const left = Math.max(
      8,
      Math.min(window.innerWidth - popoverWidth - 8, rect.left + rect.width / 2 - popoverWidth / 2),
    );
    setCoords({ top, left });
  }, [open, anchorEl]);

  if (!mounted || !open || !coords) return null;

  const popover = (
    <div
      role="tooltip"
      className={`fixed z-50 w-[180px] border-4 ${RARITY_BORDER[item.rarity]} bg-bg p-2 shadow-[4px_4px_0_rgba(0,0,0,0.8)]`}
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="relative h-32 w-full border-2 border-text-dim bg-bg flex items-center justify-center overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={item.name}
            width={128}
            height={128}
            className="h-32 w-32 object-cover"
            style={{ imageRendering: "pixelated" }}
            onError={() => setError(true)}
          />
        ) : error ? (
          <span className="text-3xl text-text-dim" aria-hidden>?</span>
        ) : (
          <div className="dice-shaking text-3xl text-torch" aria-hidden>🎲</div>
        )}
      </div>
      <p className="mt-2 font-display text-[9px] tracking-wider text-text text-center break-words">
        {item.name.toUpperCase()}
      </p>
      <p className={`mt-1 font-display text-[8px] tracking-wider text-center ${RARITY_TEXT[item.rarity]}`}>
        {item.rarity.toUpperCase()}
      </p>
    </div>
  );

  return createPortal(popover, document.body);
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItemPopover.tsx
git commit -m "feat(ui): ItemPopover with lazy fetch + portal positioning"
```

---

### Task 10: StatsSidebar wraps inventory in hover trigger

**Files:**
- Modify: `src/components/StatsSidebar.tsx`

- [ ] **Step 1: Add imports + helper component**

Open `src/components/StatsSidebar.tsx`. Find the existing imports:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { GameState, InventoryItem, ItemRarity } from "@/lib/game/types";
```

Replace with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ItemPopover } from "@/components/ItemPopover";
import { GameState, InventoryItem, ItemRarity } from "@/lib/game/types";
```

Then find the `toItem` helper near the top of the file (it returns an `InventoryItem`). Immediately AFTER `toItem` (before `function Avatar(...)`), add:

```tsx
function ItemBadgeWithPreview({ item }: { item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const enterTimerRef = useRef<number | null>(null);

  const variant = RARITY_VARIANT[item.rarity];

  function handleEnter() {
    if (enterTimerRef.current !== null) {
      window.clearTimeout(enterTimerRef.current);
    }
    enterTimerRef.current = window.setTimeout(() => setOpen(true), 150);
  }

  function handleLeave() {
    if (enterTimerRef.current !== null) {
      window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    setOpen(false);
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      tabIndex={0}
    >
      <Badge variant={variant} className="justify-center w-full" title={item.rarity}>
        {item.name}
      </Badge>
      <ItemPopover item={item} anchorEl={triggerRef.current} open={open} />
    </div>
  );
}
```

- [ ] **Step 2: Replace the inventory rendering loop**

Find the existing inventory grid render block:

```tsx
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {state.player.inventory.map((entry, idx) => {
              const item = toItem(entry);
              return (
                <Badge
                  variant={RARITY_VARIANT[item.rarity]}
                  key={`${item.name}-${idx}`}
                  className="justify-center"
                  title={item.rarity}
                >
                  {item.name}
                </Badge>
              );
            })}
          </div>
        )}
```

Replace with:

```tsx
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {state.player.inventory.map((entry, idx) => {
              const item = toItem(entry);
              return (
                <ItemBadgeWithPreview key={`${item.name}-${idx}`} item={item} />
              );
            })}
          </div>
        )}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Manual smoke (with API key)**

`npm run dev` → open an in-progress `/game` session (or start a new one). In the sidebar, hover over an inventory item like "longsword". After ~150ms, a popover appears with a skeleton 🎲, then ~3-5s later loads an 8-bit image of a longsword with a torch-yellow rarity border. Move the mouse away; popover hides. Hover again; image returns INSTANTLY from the client cache.

Stop the dev server, restart, hover the same item; loads within ~200ms from the server file-backed cache.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatsSidebar.tsx
git commit -m "feat(sidebar): hover popover with item image preview"
```

---

## Self-Review (already done)

Spec coverage:

- **Spec §1 (Third agent: Image Prompt Agent)** → Task 3.
- **Spec §1.1 (system prompt with style mandate)** → Task 3 step 1.
- **Spec §1.2 (agent implementation with template fallback)** → Task 3 step 2.
- **Spec §1.3 (URL builder)** → Task 3 step 2 (`buildPollinationsUrl`).
- **Spec §2 (Server-side cache, dual-mode)** → Task 2.
- **Spec §2.3 (cache API: get/set/buildItemKey)** → Task 2 step 1.
- **Spec §3 (/api/image POST endpoint)** → Task 4.
- **Spec §4 (Types extension: GeneratedImage)** → Task 1 step 1.
- **Spec §4 (BuildInitialStateOptions extension)** → Task 5 step 1.
- **Spec §5 (avatar.ts STYLE_SUFFIX update)** → Task 1 step 2.
- **Spec §6.1 (character page integration)** → Task 8.
- **Spec §6.2 (AvatarPreview component)** → Task 7.
- **Spec §6.3 (ItemPopover component)** → Task 9.
- **Spec §6.4 (Sidebar integration)** → Task 10.
- **Spec §6.5 (Store changes)** → Task 6.
- **Spec §7 (Failure modes)** → Covered by template fallback in Task 3, onError in Task 7 and Task 9.

Placeholder scan: no TBD/TODO. Type consistency: `GeneratedImage` shape is `{url, prompt, seed}` everywhere. `ImagePromptInput` shape consistent between agent and API zod schemas. `InventoryItem`, `ItemRarity`, `PlayerClass` reused from existing types. Cache key format `item:<name>:<rarity>` consistent between server (`imageCache.buildItemKey`) and client (`cacheKey` helper in `ItemPopover`).
