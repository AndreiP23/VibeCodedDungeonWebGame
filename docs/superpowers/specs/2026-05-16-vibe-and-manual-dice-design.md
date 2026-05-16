# Design: Pixel-fantasy vibe reskin + manual dice rolling

**Date:** 2026-05-16
**Status:** Approved
**Scope:** Reskin the existing app to match `landing.html` visual language, add manual dice rolling with the full D&D set (D4–D20), fix chat/sidebar layout so the sidebar stays put, and stop the DM from paraphrasing NPC dialogue.

The story (3 locations, 4 NPCs, 1 main quest) remains hardcoded — sufficient for the demo.

---

## 1. Visual reskin

Reuse landing.html's design tokens and fonts across the existing pages (`/`, `/character`, `/game`). No new pages, no rescue of `landing.html` as the home page — it stays as a separate marketing asset.

### 1.1 Theme tokens (replace existing `:root` in `src/app/globals.css`)

```css
:root {
  --bg: #06060f;          /* page background */
  --sky: #0d1b3e;         /* secondary surface */
  --torch: #ff9d00;       /* primary CTA / dice glow */
  --torch2: #ffcc44;      /* gold accent */
  --fire: #ff4500;        /* critical / damage */
  --gold: #ffd700;        /* loot / quest completed */
  --text: #ffe4b5;        /* parchment text */
  --text-dim: #c4a882;    /* secondary text */
  --hp: #e74c3c;          /* HP bar */
  --mp: #3498db;          /* mana (unused for now, reserved) */
  --xp: #2ecc71;          /* success */
  --gem-blue: #00cfff;
  --gem-red: #ff3355;
  --gem-purple: #bb44ff;
  --gem-green: #44ff99;
}
```

Map these to the shadcn-style HSL variables the existing components consume (`--background`, `--foreground`, `--primary`, `--card`, `--destructive`, `--muted`, `--accent`, `--ring`) so existing component code keeps working without rewrites.

### 1.2 Fonts

Add to `src/app/layout.tsx` via `next/font/google`:
- `Press Start 2P` → exposed as `--font-display` (titles, button labels, badges, dice numbers)
- `VT323` → exposed as `--font-body` (chat narrative, NPC dialogue, descriptions, input)

Tailwind config: extend `fontFamily.display` and `fontFamily.body`. Set `font-body` as page default; `font-display` applied per-element.

### 1.3 Component reskins (no logic changes)

- **`ChatMessage`**: bubble with 4px solid pixel border + 4px hard black shadow (`box-shadow: 4px 4px 0 rgba(0,0,0,0.8)`), no border-radius. Roles colorized via tokens:
  - `player` → border `--torch`, text `--text`
  - `dm` → border `--text-dim`, text `--text` (italic for narrator beats)
  - `npc` → border `--gem-purple`, text `--text`; speaker label in `--font-display` above the bubble
  - `system` → border `--gem-green`, used for "for-fun" dice rolls

- **`StatsSidebar`**: section headers in `--font-display` with `--torch` color + glow text-shadow. HP bar uses `--hp` gradient with inner shadow. Inventory grid keeps 4-column layout, each cell with pixel border. Active quests in `--torch`, completed quests in `--gold` with `--xp` ✓ badge.

- **`Button`** (shadcn): add `pixel` variant — `bg-[--torch] text-[--bg]`, font `--font-display`, no border-radius, 4px hard shadow, hover translates 2px down-right (shadow shrinks).

- **`Badge`**: refactor `success`/`danger` variants to use pixel borders + glow. New variants `gold`, `gem-purple` for quests/NPC labels.

- **`EndStateOverlay`**: full-screen pixel border + torch glow background; title in `--font-display` with `text-shadow: 0 0 20px var(--torch), 0 0 40px rgba(255,157,0,0.3), 4px 4px 0 #000`.

### 1.4 Page-level decoration

Add to the body of `layout.tsx` (so all pages inherit):
- A repeating subtle stone-wall gradient on `body` (`repeating-linear-gradient` low-opacity black stripes over `--bg`)
- Two `.torch-glow` divs absolutely positioned top-left and top-right, with `radial-gradient(rgba(255,157,0,0.18) → transparent)` and a `glow-pulse` keyframe (2s ease-in-out infinite, opacity 0.6 → 1.0 → 0.6). Defined as utility classes in `globals.css`.

No new dependencies. All animation via CSS keyframes.

---

## 2. Layout: scrollable chat, sticky sidebar

Replace the current `/game/page.tsx` layout so the page itself never scrolls; only the chat does.

### 2.1 Structure

```
<div class="h-screen flex flex-col overflow-hidden bg-[--bg]">
  <header class="shrink-0">… title, New Game …</header>
  <main class="flex-1 flex overflow-hidden">
    <section class="flex-1 flex flex-col overflow-hidden">  <!-- chat column -->
      <div class="flex-1 overflow-y-auto" ref={chatScrollRef}>
        … messages …
      </div>
      <DiceTray class="shrink-0 sticky bottom-[input-height]" />
      <form class="shrink-0">… input + send …</form>
    </section>
    <aside class="w-[320px] shrink-0 overflow-y-auto border-l-4 border-[--torch]">
      <StatsSidebar />
    </aside>
  </main>
</div>
```

### 2.2 Auto-scroll

Inside the chat column, on `chat.length` change (and on streaming narration deltas), scroll `chatScrollRef.current` to `scrollHeight`. Use a small `useEffect` watching the chat array and the latest narration string. If the user has scrolled up manually (we detect by comparing `scrollTop + clientHeight < scrollHeight - 100`), don't force-scroll — just append. Show a "↓ jump to latest" pill when in this state.

### 2.3 Sidebar overflow

The sidebar gets its own `overflow-y-auto`. If inventory/quests overflow the viewport, the sidebar scrolls independently while the chat stays interactive on the left.

---

## 3. DM never paraphrases the NPC

### 3.1 Prompt changes (`src/lib/prompts/dmPrompt.ts`)

Strengthen constraint #4 ("When the player addresses or interacts with an NPC…") with these explicit rules:

> When the player addresses or interacts with an NPC:
> 1. Write AT MOST ONE short narration sentence describing the NPC's physical action, expression, or setting beat — NEVER what they say or imply.
> 2. Immediately call `getNPCResponse`. STOP narration after the tool call.
> 3. Do NOT add follow-up narration after the NPC speaks unless the scene physically changes (someone leaves, attacks, new arrival). Even then, max one sentence.
> 4. FORBIDDEN: quoting, paraphrasing, summarizing, or hinting at the NPC's words. The NPC speaks for themselves.
>
> Correct:
>   DM: "Borin ridică privirea peste halba de bere."
>   [getNPCResponse → Borin: "Nu te ajut fără aur, străine."]
>
> Forbidden:
>   DM: "Borin se uită la tine și spune că nu te ajută fără aur."
>   [getNPCResponse → Borin: "Nu te ajut fără aur, străine."]

### 3.2 Stream ordering guarantee

The agent already produces narration deltas before calling tools. To make the UI ordering rock-solid, the stream consumer in `gameStore.ts` commits any in-flight DM message to `chat` *before* pushing the `npc` message. Implementation:

- Maintain `currentDmDraft: string` while collecting `narration-delta` events.
- On `npc` event: if `currentDmDraft` is non-empty, push it as a finalized `dm` message, then push the `npc` message. Reset `currentDmDraft`.
- On `done`: flush any remaining `currentDmDraft`.

This way, even if a delta arrives slightly after an `npc` event due to network buffering, the visual order is always DM-then-NPC for a given turn.

---

## 4. Manual dice system (D4–D20)

The player rolls every die the DM asks for. The DM never produces a numeric result on its own.

### 4.1 Dice set and uses

| Die | Use |
|-----|-----|
| D4  | Rogue damage (dagger), small healing |
| D6  | Mage damage (firebolt), generic |
| D8  | Warrior damage (sword), generic |
| D10 | Heavy damage (rare) |
| D12 | Greataxe (rare) |
| D20 | ALL skill checks + attack rolls |

### 4.2 New tool: `requestPlayerRoll`

Replaces the current `rollDice` tool in the DM agent's tool list. Definition:

```ts
{
  name: "requestPlayerRoll",
  description: "Ask the player to roll a die. Use for skill checks (D20 + modifier vs DC), attack rolls (D20 + modifier vs target AC), and damage (D4–D12 without a difficulty). NEVER decide the outcome yourself — wait for the tool_result with the player's roll.",
  input_schema: {
    type: "object",
    properties: {
      sides: { enum: [4, 6, 8, 10, 12, 20] },
      modifier: { type: "number" },
      checkType: { enum: ["Combat", "Stealth", "Persuasion", "Perception", "Athletics", "Damage", "Attack"] },
      difficulty: { type: "number", description: "DC for checks / AC for attacks. Omit for Damage." }
    },
    required: ["sides", "modifier", "checkType"]
  }
}
```

The existing `rollDice` function in `src/lib/tools/dice.ts` stays as a pure utility (used client-side for the "for-fun" tray rolls) — only the DM-agent tool wiring changes.

### 4.3 DM-prompt additions for combat & damage

Add to "Game mechanics" in `dmPrompt.ts`:

> - Damage dice per class: Warrior=D8 (sword), Mage=D6 (firebolt), Rogue=D4 (dagger). Apply STR modifier for melee, INT for spells.
> - Combat order: 1) `requestPlayerRoll` with `checkType=Attack`, `sides=20`, `modifier=<stat mod>`, `difficulty=<NPC armorClass>`. 2) If success, `requestPlayerRoll` with `checkType=Damage`, `sides=<class die>`, `modifier=<stat mod>` (no difficulty). 3) Then `updateGameState` to apply damage to the NPC.
> - One `requestPlayerRoll` per tool block. Do not call it twice before receiving the first result.

### 4.4 `DiceRollResult` type extension

In `src/lib/game/types.ts`:

```ts
export type DiceRollResult = {
  checkType: SkillType | "Damage" | "Attack"
  sides: 4 | 6 | 8 | 10 | 12 | 20
  roll: number
  modifier: number
  total: number
  difficulty: number | null   // null = damage roll
  success: boolean | null     // null = damage roll
}
```

---

## 5. Architecture: suspend/resume agent for player rolls

### 5.1 Pending-roll state

New module `src/lib/agents/pendingRolls.ts`:

```ts
type PendingRollState = {
  sessionId: string
  messages: Anthropic.MessageParam[]  // full agent context up to the pending tool_use
  pendingToolUseId: string
  rollRequest: {
    sides: 4 | 6 | 8 | 10 | 12 | 20
    modifier: number
    checkType: SkillType | "Damage" | "Attack"
    difficulty?: number
  }
  createdAt: number
}

const store = new Map<string, PendingRollState>()

export const pendingRolls = {
  set(state: PendingRollState): void,
  get(sessionId: string): PendingRollState | undefined,
  delete(sessionId: string): void,
  cleanup(): void  // remove entries older than TTL_MS
}
```

- TTL: 10 minutes. `cleanup()` called inside `set()` to amortize.
- In-memory only (Map). This matches the existing dual-mode persistence approach — fine for demo, lost on Vercel cold start. Acceptable per scope.

### 5.2 API route changes (`src/app/api/game/route.ts`)

Add a third action and a new event type:

```ts
type Action = "init" | "turn" | "roll"

// stream events (existing + new):
// "narration-delta", "npc", "dice", "done", "error"  (existing)
// "roll-request"  (new)
```

#### `action="turn"` (updated)

Run the DM agent's tool-use loop as today, BUT when the model produces a `tool_use` block with name `requestPlayerRoll`:
1. Capture: full `messages` array including the assistant message with the `tool_use`, the `tool_use_id`, and the input params.
2. Call `pendingRolls.set({ sessionId, messages, pendingToolUseId, rollRequest, createdAt: Date.now() })`.
3. Emit stream event `roll-request` with `{ sides, modifier, checkType, difficulty?, toolUseId }`.
4. Emit `done` and close the stream.

The agent loop must NOT continue calling Claude after a `requestPlayerRoll` tool_use — it yields control.

#### `action="roll"` (new)

Payload: `{ sessionId, toolUseId, roll: number }`.

1. Load `pendingRolls.get(sessionId)`. If absent → 400 "no pending roll".
2. Verify `toolUseId === state.pendingToolUseId`. If mismatch → 400.
3. Validate `roll` is `1..sides`. If invalid → 400.
4. Compute `total = roll + modifier`. If `difficulty` set, compute `success = total >= difficulty`; else `success = null`.
5. Build `tool_result` content block: stringified `{ roll, total, success, difficulty }`.
6. Append to messages: `{ role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content: <stringified result> }] }`.
7. Also emit a `dice` stream event (same shape as today) so the UI can show the result badge.
8. Resume the agent loop with the updated `messages`. Continue streaming narration, possibly into another `roll-request` cycle.
9. On final `done`: `pendingRolls.delete(sessionId)`.

### 5.3 Refusing concurrent turns while a roll is pending

If `action="turn"` arrives but `pendingRolls.get(sessionId)` exists → respond 409 "roll pending, submit roll first". The UI already disables the input in this state; this is a defense-in-depth check.

---

## 6. Client-side changes

### 6.1 `src/store/gameStore.ts`

Add state:
```ts
pendingRoll: {
  sides: 4|6|8|10|12|20
  modifier: number
  checkType: SkillType | "Damage" | "Attack"
  difficulty?: number
  toolUseId: string
} | null
```

Add stream-parser handling for `roll-request` event: set `pendingRoll`.

Add action `submitRoll(rollValue: number)`:
- Validates `pendingRoll` exists
- POST `/api/game` with `{ action: "roll", sessionId, toolUseId, roll: rollValue }`
- Streams response with same handlers as `playTurn`
- On `done`: clear `pendingRoll`

Add action `rollForFun(sides)`: pure client-side `rollDice` call, push a `system` message to `chat` (e.g., `🎲 D6 = 4`). Does not contact the API.

### 6.2 New component `DiceTray`

Path: `src/components/DiceTray.tsx`.

Props: none (reads `pendingRoll`, `submitRoll`, `rollForFun` from store).

Renders six pixel-bordered buttons (D4 D6 D8 D10 D12 D20). For each:
- If `pendingRoll` is null → button active, click triggers `rollForFun(sides)`.
- If `pendingRoll.sides === this.sides` → highlighted, pulsing torch glow, scaled 1.1, click triggers `submitRoll(rollValue)` (with animation).
- If `pendingRoll` is non-null but `sides` differs → disabled (opacity 0.4).

When `pendingRoll` is non-null, above the tray show: "Aruncă **D{sides} + {modifier}** pentru **{checkType}**{difficulty ? ` (DC ${difficulty})` : ''}".

Roll animation: ~1s of "shaking" the die. The rolled value is computed once at click time (`Math.floor(Math.random() * sides) + 1`). During the 1s animation, a `setInterval` swaps the displayed face every 80ms through random values; on the final tick, it settles to the real rolled value. A short CSS shake/jitter keyframe runs in parallel on the die container for visual feedback.

### 6.3 `DiceRoll.tsx` refactor

Keep the component for rendering a finalized result badge (success/failure variant, total, breakdown). Remove the internal animation cycle (animation now lives in `DiceTray`). Adjust props to accept the extended `DiceRollResult` shape (with `null` success/difficulty for damage — render as "Damage: 6" instead of "Success/Fail").

### 6.4 Input gating

In `/game/page.tsx`, disable the message input + send button while `pendingRoll !== null`. Show inline hint: "Aruncă zarul de mai jos pentru a continua."

---

## 7. Edge cases & decisions

- **Refresh during pending roll:** The pending-roll state lives server-side and persists across the refresh. On mount, `/game/page.tsx` checks if any pending roll exists for the session (new GET endpoint `/api/game?sessionId=…` returning `{ pendingRoll }`) and restores `pendingRoll` in the store. Without this, the UI would let the user type but the API would 409. Adding this check is in scope.
- **DM emits more than one `requestPlayerRoll` in a single tool_use block:** Forbidden by prompt. As a safety net, the API only honors the first tool_use of that name per round and ignores any siblings.
- **For-fun rolls are not in DM context:** Pragmatic choice — preventing the agent from being confused by "the player rolled a 17 randomly." Confirmed scope decision.
- **Locale:** All UI strings stay Romanian (existing convention). Tool/check names stay English in code (existing convention).
- **D&D advanced rules out of scope:** No advantage/disadvantage, no critical multiplier on damage, no D100. The existing "natural 1 = consequence, natural 20 = bonus" rule in `dmPrompt` stays as DM-narrative flair, not mechanical change.
- **Persistence of `pendingRolls` to file (local dev):** Not required. The existing `gameState.ts` file persistence handles game state; pending-roll is ephemeral. If the local dev server restarts mid-roll, the user must start a new turn — acceptable.

---

## 8. File touchpoints

New:
- `src/lib/agents/pendingRolls.ts`
- `src/components/DiceTray.tsx`
- `docs/superpowers/specs/2026-05-16-vibe-and-manual-dice-design.md` (this file)

Modified:
- `src/app/globals.css` — theme tokens, torch-glow utilities, body decoration
- `src/app/layout.tsx` — fonts (Press Start 2P, VT323), torch-glow decoration divs
- `tailwind.config.ts` — font families
- `src/app/page.tsx` — pixel reskin
- `src/app/character/page.tsx` — pixel reskin
- `src/app/game/page.tsx` — new layout (h-screen + flex), input gating, DiceTray placement, jump-to-latest pill
- `src/components/ChatMessage.tsx` — pixel borders, role colors
- `src/components/StatsSidebar.tsx` — header fonts, HP bar restyle
- `src/components/EndStateOverlay.tsx` — pixel reskin
- `src/components/DiceRoll.tsx` — remove internal animation; extended result shape
- `src/components/ui/button.tsx` — `pixel` variant
- `src/components/ui/badge.tsx` — pixel variants + new `gold`/`gem-purple`
- `src/store/gameStore.ts` — `pendingRoll` state, `submitRoll`, `rollForFun`, stream-parser update, DM-draft-before-NPC commit
- `src/lib/agents/dungeonMaster.ts` — tool list (`requestPlayerRoll` replaces `rollDice`), suspend on that tool_use
- `src/lib/prompts/dmPrompt.ts` — NPC-no-paraphrase rules, damage-die per class, combat order, `requestPlayerRoll` directive
- `src/lib/game/types.ts` — extended `DiceRollResult`, new check types
- `src/app/api/game/route.ts` — `action="roll"` handler, `roll-request` event, GET endpoint for pending-roll recovery

Unchanged:
- `src/lib/tools/dice.ts` `rollDice` utility (now used only client-side)
- `src/lib/agents/npcBrain.ts` (location guard already correct)
- `data/locations.json`, `data/npcs.json` (story stays hardcoded)
- `landing.html` (kept as marketing asset)

---

## 9. Success criteria

1. Opening `/`, `/character`, `/game` shows the pixel-fantasy palette (deep black bg, torch amber CTAs, Press Start 2P headings, VT323 body) with at least one torch-glow decoration.
2. On `/game`, scrolling the chat does not move the sidebar; the sidebar overflows independently if needed.
3. When the DM needs a roll, the corresponding die in the tray pulses; the message input is disabled; clicking the die animates ~1s and produces a result that the DM acknowledges in continued narration.
4. Player can click any die in the tray when no roll is pending; a system message shows the result; the DM does not react to it.
5. All six dice types are reachable in normal play (D20 for checks/attacks; D8/D6/D4 for warrior/mage/rogue damage; D10/D12 demonstrable via prompt example or rare event).
6. When the player addresses an NPC, the DM emits at most one setup sentence before the NPC speaks, and never paraphrases or pre-quotes the NPC's words. Order in the chat is always DM-then-NPC.
7. Existing flow (init → character review → game → quest completion) still works end-to-end.
