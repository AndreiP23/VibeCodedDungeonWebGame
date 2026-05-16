# Design: Image Prompt Agent for player avatars and item art

**Date:** 2026-05-17
**Status:** Approved
**Scope:** Add a third Claude-driven agent that writes 8-bit pixel-art prompts for player avatars and inventory items. Image hosting stays on the existing free pollinations.ai endpoint. Player avatars are generated (and re-rollable) on character creation; item images are generated on-demand when the player hovers an inventory entry, with server-side caching keyed by item name + rarity.

Current state: `src/lib/tools/avatar.ts` already builds painterly avatar URLs from a deterministic template at session-init time and stores the URL in `state.player.avatarUrl`. This work adds an LLM-driven prompt layer, switches the style to 8-bit pixel art, exposes a re-roll affordance, and extends the same pipeline to inventory items.

---

## 1. Third agent: Image Prompt Agent

New module `src/lib/agents/imagePrompt.ts` exposes a single function:

```ts
type ImagePromptInput =
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

interface GeneratedImage {
  url: string;
  prompt: string;
  seed: number;
}

export async function generateImage(input: ImagePromptInput): Promise<GeneratedImage>;
```

### 1.1 System prompt (`src/lib/prompts/imagePromptAgent.ts`)

Hard-coded style mandate: 8-bit pixel art, NES/SNES-inspired, plain dark background, head-and-shoulders for avatars, centered isometric or side view for items. Returns ONLY the image prompt string — no commentary, no markdown.

Style suffix the agent must always append:
```
8-bit pixel art sprite, NES JRPG style, 32x32 grid implied, 16-color palette, sharp pixel edges, plain dark background, centered composition, no text
```

For avatars: integrate backstory cues (scars, accessories, hair, expression) into the subject description in 1-2 short sentences before the style suffix.

For items: integrate rarity into the visual description — `common` → "plain, well-used"; `uncommon` → "subtle ornamentation"; `rare` → "fine craftsmanship, faint glow"; `epic` → "elaborate detailing, magical aura"; `legendary` → "golden glow, ornate, otherworldly".

Max output tokens: 200. Hard cap so the call is fast and predictable.

### 1.2 Agent implementation

The agent:
1. Builds a user-message payload (JSON-serialized `ImagePromptInput`).
2. Calls Claude (model from `getAnthropicModel()`, same as DM and NPC agents).
3. Extracts the text content from the response. If empty or the call throws, falls back to the deterministic template logic in `src/lib/tools/avatar.ts` (avatars) or a built-in item-template fallback (items).
4. Sanitizes the prompt: strip newlines, collapse whitespace, slice to 400 chars max.
5. Generates a random `seed` (1..1_000_000).
6. Returns `{ prompt, seed, url }` where `url` is the pollinations.ai URL constructed from `prompt` and `seed`.

### 1.3 URL builder (shared helper inside imagePrompt.ts)

```ts
function buildPollinationsUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=256&height=256&nologo=true&seed=${seed}`;
}
```

---

## 2. Server-side cache (`src/lib/tools/imageCache.ts`)

Keyed `Map<string, GeneratedImage>` deduplicates item generations across sessions. Avatars are NOT cached (each character should get its own fresh portrait; re-roll explicitly generates a new one).

### 2.1 Key format

```
item:<lowercased-trimmed-name>:<rarity>
```

Examples: `item:longsword:uncommon`, `item:health potion:common`.

### 2.2 Persistence

Dual-mode mirroring the existing `gameState.ts` pattern:

- **Local dev:** writes to `data/image-cache.json` (created on first miss). Read on each lookup, write on each set.
- **Vercel (`process.env.VERCEL` set):** in-memory `Map` only. Cache is per-instance and lost on cold start. Acceptable for demo.

### 2.3 API

```ts
export const imageCache = {
  get(key: string): Promise<GeneratedImage | undefined>,
  set(key: string, value: GeneratedImage): Promise<void>,
  buildItemKey(name: string, rarity: ItemRarity): string,
};
```

No TTL — entries are deterministic from (name, rarity) so they remain valid forever. If the entry list grows past a soft cap (~500 entries) in the file-backed mode, we log a warning. No eviction logic for the demo.

### 2.4 Error handling

- File missing → start with empty `Map`. No error logged.
- File corrupted JSON → catch, log warning, start empty.
- Concurrent writes → simple last-write-wins; we don't expect bursts in single-player demo.

---

## 3. API endpoint: `src/app/api/image/route.ts`

### 3.1 POST handler

Request body (validated with zod):
```ts
type Body =
  | { kind: "avatar"; playerClass: PlayerClass; backstory?: string; nameHint?: string }
  | { kind: "item"; itemName: string; rarity: ItemRarity };
```

Flow:
1. Parse and validate. On error → 400 with details.
2. If `kind === "item"`:
   - Build cache key.
   - `imageCache.get(key)` → hit returns `{url, prompt, seed}` immediately.
   - Miss → call `generateImage(input)` → `imageCache.set(key, result)` → return.
3. If `kind === "avatar"`: skip cache, call `generateImage(input)` directly, return.

Response: `{ url: string; prompt: string; seed: number }`.

### 3.2 Rate limiting

Out of scope for demo. Single-player local app, no exposure.

---

## 4. Types extension (`src/lib/game/types.ts`)

Add the exported `GeneratedImage` interface (shared between agent, cache, and API):

```ts
export interface GeneratedImage {
  url: string;
  prompt: string;
  seed: number;
}
```

No change to `GameState` shape — `player.avatarUrl: string | undefined` already exists.

Extend `BuildInitialStateOptions` in `gameState.ts`:
```ts
interface BuildInitialStateOptions {
  playerName: string;
  playerClass: PlayerClass;
  backstory?: string;
  bonuses?: PlayerBonuses;
  avatarUrl?: string;   // NEW — when client pre-generated avatar via /api/image
}
```

If `avatarUrl` is provided, use it. Otherwise call `buildAvatarSpec` (existing deterministic fallback) as a fast-path bootstrap.

Also extend `getOrCreateGameState` input options similarly, and forward to `buildInitialState`.

---

## 5. Existing `avatar.ts` update

Keep `buildAvatarSpec` as the deterministic fallback. Only change: update `STYLE_SUFFIX` to 8-bit pixel so the visual style is consistent across the LLM path and the template path:

```ts
const STYLE_SUFFIX =
  "8-bit pixel art sprite, NES JRPG style, 16-color palette, " +
  "sharp pixel edges, head and shoulders, plain dark background, centered composition";
```

No other behavior change in this file.

---

## 6. Frontend changes

### 6.1 Character page (`src/app/character/page.tsx`)

State additions:
- `avatarPreview: GeneratedImage | null`
- `avatarRolling: boolean`

UI additions (rendered after the review verdict block, before "Start the adventure"):
- `<AvatarPreview image={avatarPreview} rolling={avatarRolling} onReroll={handleReroll} />`

Behavior:
- `handleReroll` POSTs to `/api/image` with `kind: "avatar"`, `playerClass`, `backstory: backstory.trim() || undefined`, `nameHint: name.trim()`. Sets `avatarRolling: true` during fetch; on response sets `avatarPreview`.
- The button shows initial "🎲 Generate Avatar" if `avatarPreview` is null, and "🎲 Re-roll Avatar" after the first generation.
- "Start the adventure" passes `avatarPreview?.url` to `initGame` via the existing options bag (need to add an option `avatarUrl?`). If null (player skipped reroll), the server falls back to the deterministic template.

### 6.2 `AvatarPreview` component (`src/components/AvatarPreview.tsx`)

Props:
```ts
interface AvatarPreviewProps {
  image: GeneratedImage | null;
  rolling: boolean;
  onReroll: () => void;
}
```

Render:
- 256×256 image container with pixel border (`border-4 border-torch shadow-[4px_4px_0_rgba(0,0,0,0.8)]`).
- If `rolling`: show pulsing torch overlay + "FORGING PORTRAIT…" text.
- If `image` and not rolling: show the `<img>`.
- If `!image` and not rolling: show placeholder text "No portrait yet. Click below to generate."
- Below the image: pixel Button "🎲 Re-roll Avatar" (or "🎲 Generate Avatar" first time), disabled while `rolling`.

### 6.3 `ItemPopover` component (`src/components/ItemPopover.tsx`)

Props:
```ts
interface ItemPopoverProps {
  item: InventoryItem;
  triggerRef: React.RefObject<HTMLElement>;
  open: boolean;
}
```

A controlled popover that:
- Positions itself absolutely above the trigger element (or below if not enough space above).
- Renders a 128×128 image, item name in font-display, rarity label colored by rarity.
- Lazy-fetches the image: on first `open === true`, POSTs `/api/image` with `kind: "item", itemName, rarity`. Stores result in a module-level `Map<string, GeneratedImage>` (client-side cache, separate from server cache for instant re-show).
- While fetching: skeleton box with `dice-shaking` animation reused.
- On fetch error: shows "?" placeholder with the rarity-colored border.

### 6.4 Sidebar integration (`src/components/StatsSidebar.tsx`)

The inventory grid wraps each `Badge` in a hover-trigger:

```tsx
{state.player.inventory.map((entry, idx) => {
  const item = toItem(entry);
  return (
    <ItemBadgeWithPreview key={`${item.name}-${idx}`} item={item} />
  );
})}
```

`ItemBadgeWithPreview` is a small wrapper inside `StatsSidebar.tsx` (not a new file):
- Tracks `open` state with 150ms enter-delay (anti-flicker on quick mouse pass).
- Manages `triggerRef`.
- Renders the existing `Badge` + an `<ItemPopover>` mounted in a portal.

### 6.5 Store changes (`src/store/gameStore.ts`)

Extend `InitOptions`:
```ts
interface InitOptions {
  sessionId?: string;
  backstory?: string;
  bonuses?: PlayerBonuses;
  avatarUrl?: string;   // NEW
}
```

Forward `avatarUrl` to the `/api/game` POST body. Server-side `getOrCreateGameState` passes it into `buildInitialState`.

---

## 7. Failure modes & fallbacks

| Failure | Fallback |
|---|---|
| LLM call throws (missing key, network) | Use `buildAvatarSpec` template for avatars; use a built-in item template (`"<rarity> <name> as 8-bit pixel art..."`) for items. App keeps working. |
| pollinations.ai 4xx/5xx or slow | `<img onError>` shows placeholder (🛡️ for avatar, badge-only text for items). No retry. |
| Client cancels navigation during avatar generation | The fetch is fire-and-forget after the click; if user navigates away, the request is aborted but the server cache fill (if it happened) is still useful. |
| Cache file corrupted | Catch JSON parse, treat as empty cache, log warning, continue. |

Sanitization:
- Backstory passes through existing `sanitizeBackstory` (strip newlines, alphanumeric+punct, ≤120 chars).
- Item names from character review are already clamped to ≤30 chars; DM-emitted item names go through the same `normalizeInventoryItem` (already in place).

---

## 8. File touchpoints

**New:**
- `src/lib/agents/imagePrompt.ts`
- `src/lib/prompts/imagePromptAgent.ts`
- `src/lib/tools/imageCache.ts`
- `src/app/api/image/route.ts`
- `src/components/AvatarPreview.tsx`
- `src/components/ItemPopover.tsx`
- `data/image-cache.json` (created at runtime on first cache write)
- `docs/superpowers/specs/2026-05-17-image-prompt-agent-design.md` (this file)

**Modified:**
- `src/lib/game/types.ts` — add `GeneratedImage`
- `src/lib/tools/avatar.ts` — update `STYLE_SUFFIX` to 8-bit
- `src/lib/tools/gameState.ts` — accept `avatarUrl` in init options
- `src/app/api/game/route.ts` — accept `avatarUrl` field in init payload
- `src/store/gameStore.ts` — extend `InitOptions` with `avatarUrl`, forward to API
- `src/app/character/page.tsx` — AvatarPreview + reroll integration + pass URL on start
- `src/components/StatsSidebar.tsx` — wrap item badges with `ItemBadgeWithPreview`

**Unchanged:**
- DM agent, NPC agent, character review agent (this is a parallel pipeline)
- DM prompt (rarity guidance is already there from the loot rarity work)

---

## 9. Success criteria

1. Opening `/character`, providing a backstory like "scarred veteran with raven hair", clicking "🎲 Generate Avatar" produces a recognizable 8-bit pixel portrait that visibly reflects at least one of: the class, the scars, the hair color.
2. Clicking "🎲 Re-roll Avatar" 3 times produces 3 visibly different portraits.
3. Clicking "Start the adventure" navigates to `/game` and the StatsSidebar shows the previewed avatar (same URL — no regeneration).
4. Hovering an item like "longsword" in the inventory shows an 8-bit pixel art image of a sword within ~5s the first time; subsequent hovers show it instantly from cache.
5. The same item name + rarity across two different sessions produces THE SAME image URL (server cache hit).
6. Stopping the dev server, restarting, hovering "longsword" again → instant from cache (file-backed persistence).
7. With `ANTHROPIC_API_KEY` unset: clicking generate still produces an avatar (via template fallback) and hovering items still produces an image (via template fallback). The app does not crash.
