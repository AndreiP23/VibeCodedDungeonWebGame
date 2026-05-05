# DungeonMaster AI — Faza A Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the demo-blocking bugs and UX gaps in the DungeonMaster AI MVP so the project is end-to-end playable for the MPA 2026 presentation.

**Architecture:** Chirurgical fixes against the existing Next.js 14 App Router codebase. No refactor, no new dependencies, no new files outside docs. Each fix is a localized edit. Verification is `npm run build` (TypeScript strict + lint via `next lint`) plus targeted greps. Live-API smoke tests are deferred — the user does not yet have an `ANTHROPIC_API_KEY` configured.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, Zustand, `@anthropic-ai/sdk`. No test framework currently installed (do NOT add one in this phase).

**Spec reference:** `docs/superpowers/specs/2026-05-05-dungeon-master-fixes-design.md`

---

## File Structure

| File | Type | Touched in |
|------|------|------------|
| `src/lib/agentClient.ts` | modify | Task 1 (F1) |
| `README.md` | modify | Task 1 (F1) |
| `src/lib/tools/dice.ts` | modify | Task 2 (F2) |
| `src/lib/agents/dungeonMaster.ts` | modify | Task 2 (F2) |
| `src/components/ui/badge.tsx` | modify | Task 3 (F3) |
| `src/lib/agents/npcBrain.ts` | modify | Task 4 (F4) |
| `src/lib/prompts/dmPrompt.ts` | modify | Task 4 (F4) + Task 5 (F5) |
| `src/components/StatsSidebar.tsx` | modify | Task 5 (F5) |
| `src/app/game/page.tsx` | modify | Task 6 (F6) + Task 8 (Bonus) |
| `src/store/gameStore.ts` | modify | Task 8 (Bonus) |
| `src/lib/tools/gameState.ts` | modify | Task 7 (F7) |

No new files. No new dependencies. No test files (no test framework installed).

---

## Task 1: F1 — Model name correct

**Files:**
- Modify: `src/lib/agentClient.ts:20`
- Modify: `README.md` (the line with `ANTHROPIC_MODEL=claude-sonnet-4-5`)

- [ ] **Step 1: Update default model in agentClient.ts**

Open `src/lib/agentClient.ts`. Replace the line:

```ts
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
```

with:

```ts
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
```

- [ ] **Step 2: Update README example**

Open `README.md`. Find the line:

```
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Replace with:

```
ANTHROPIC_MODEL=claude-sonnet-4-6
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build succeeds (existing baseline). If TypeScript or lint fails for any pre-existing unrelated reason, stop and report — do not auto-fix unrelated issues.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agentClient.ts README.md
git commit -m "fix(agent): default model to claude-sonnet-4-6"
```

---

## Task 2: F2 — rollDice real-random

**Files:**
- Modify: `src/lib/tools/dice.ts` (full rewrite of the file's logic)
- Modify: `src/lib/agents/dungeonMaster.ts:190-196` (drop `seed` arg)

- [ ] **Step 1: Rewrite dice.ts**

Open `src/lib/tools/dice.ts`. Replace the entire file content with:

```ts
import { SkillType } from "@/lib/game/types";

export interface DiceToolInput {
  sides: number;
  modifier: number;
  checkType: SkillType;
  difficulty: number;
}

export interface DiceToolResult {
  checkType: SkillType;
  roll: number;
  total: number;
  success: boolean;
  difficulty: number;
}

export function rollDice(input: DiceToolInput): DiceToolResult {
  const sides = Math.max(2, input.sides);
  const roll = Math.floor(Math.random() * sides) + 1;
  const total = roll + input.modifier;

  return {
    checkType: input.checkType,
    roll,
    total,
    success: total >= input.difficulty,
    difficulty: input.difficulty,
  };
}
```

This drops `hashSeed`, drops the `seed` field from `DiceToolInput`, and uses `Math.random()` for a uniform roll.

- [ ] **Step 2: Update the rollDice call in dungeonMaster.ts**

Open `src/lib/agents/dungeonMaster.ts`. Find the block (around line 184-203):

```ts
        if (toolUse.name === "rollDice") {
          const checkType = String(toolUse.input.checkType ?? "Perception") as SkillType;
          const modifier =
            typeof toolUse.input.modifier === "number"
              ? toolUse.input.modifier
              : deriveSkillModifier(workingState, checkType);
          const result = rollDice({
            sides: Number(toolUse.input.sides ?? 20),
            checkType,
            difficulty: Number(toolUse.input.difficulty ?? 10),
            modifier,
            seed: `${input.sessionId}:${workingState.shortTermMemory.length}:${input.playerMessage}`,
          });
          diceRolls.push(result);
```

Replace with (drop the `seed:` line):

```ts
        if (toolUse.name === "rollDice") {
          const checkType = String(toolUse.input.checkType ?? "Perception") as SkillType;
          const modifier =
            typeof toolUse.input.modifier === "number"
              ? toolUse.input.modifier
              : deriveSkillModifier(workingState, checkType);
          const result = rollDice({
            sides: Number(toolUse.input.sides ?? 20),
            checkType,
            difficulty: Number(toolUse.input.difficulty ?? 10),
            modifier,
          });
          diceRolls.push(result);
```

- [ ] **Step 3: Verify no other callers reference `seed`**

Run a grep to confirm no other consumer relies on `seed`:

Run (Grep tool): pattern `seed:` in `src/**/*.ts`
Expected: zero hits in production code outside this task.

If hits exist outside the lines you just edited, stop and report.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tools/dice.ts src/lib/agents/dungeonMaster.ts
git commit -m "fix(dice): real random rolls via Math.random; drop deterministic seed"
```

---

## Task 3: F3 — Badge variants `success` / `danger`

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Read the current badge.tsx structure**

Use Read on `src/components/ui/badge.tsx`. Locate the `cva(...)` call and the `variants.variant` object.

- [ ] **Step 2: Add the two variants**

Inside the `variants.variant` object in the `cva` call, add the following two entries (after whichever variant comes last in the existing object, before the closing brace):

```ts
        success:
          "border-transparent bg-emerald-500 text-white hover:bg-emerald-500/80",
        danger:
          "border-transparent bg-rose-500 text-white hover:bg-rose-500/80",
```

Do not modify any other variant. Do not change the `defaultVariants`.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build succeeds. The TS error from `DiceRoll.tsx` referencing `variant="success"` / `variant="danger"` should now resolve.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "fix(ui): add success and danger variants to Badge"
```

---

## Task 4: F4 — NPC location filter

**Files:**
- Modify: `src/lib/agents/npcBrain.ts`
- Modify: `src/lib/prompts/dmPrompt.ts`

- [ ] **Step 1: Add location guard in npcBrain.ts**

Open `src/lib/agents/npcBrain.ts`. Find the block:

```ts
export async function getNPCResponse(input: NPCResponseInput): Promise<string> {
  const npc = input.state.npcs.find((candidate) => candidate.id === input.npcId);

  if (!npc) {
    return "Nu stiu despre cine vorbesti, strainule.";
  }

  const client = getAnthropicClient();
```

Replace with:

```ts
export async function getNPCResponse(input: NPCResponseInput): Promise<string> {
  const npc = input.state.npcs.find((candidate) => candidate.id === input.npcId);

  if (!npc) {
    return "Nu stiu despre cine vorbesti, strainule.";
  }

  if (npc.location !== input.state.player.location) {
    return `[NPC ${npc.name} este în ${npc.location}, jucătorul este în ${input.state.player.location}. NPC-ul nu poate vorbi cu jucătorul acum. Spune-i narativ jucătorului că nu vede pe nimeni cu acel nume aici.]`;
  }

  const client = getAnthropicClient();
```

- [ ] **Step 2: Add Hard constraint #7 to dmPrompt.ts**

Open `src/lib/prompts/dmPrompt.ts`. Find the constraints block:

```
Hard constraints — NEVER break these:
1. NEVER change HP, inventory, gold, stats, location or quests through narration text.
2. ALL mechanical changes (HP loss, gold gain, item pickup, location unlock, quest update) MUST go through updateGameState tool.
3. If an action could fail or succeed, ALWAYS call rollDice first — never invent outcomes.
4. When the player addresses or interacts with an NPC, ALWAYS call getNPCResponse before narrating.
5. Call getMemory when the player references past events you might have forgotten.
6. Narration: maximum 4 sentences. Cinematic, second-person ("Tu..."), present tense.
```

Append constraint 7 immediately after constraint 6 (before the blank line that separates the section from `Game mechanics:`):

```
7. Only call getNPCResponse for NPCs whose location matches the player's current location. Verify state.player.location against the NPC's listed location before calling.
```

The resulting block should have constraints 1 through 7.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agents/npcBrain.ts src/lib/prompts/dmPrompt.ts
git commit -m "fix(npc): refuse NPC dialogue when player is in different location"
```

---

## Task 5: F5 — Quest win-state visible

**Files:**
- Modify: `src/components/StatsSidebar.tsx`
- Modify: `src/lib/prompts/dmPrompt.ts`

- [ ] **Step 1: Add completed quests section in StatsSidebar.tsx**

Open `src/components/StatsSidebar.tsx`. Find the existing `Quest Activ` Card block. After its closing `</Card>` tag, add a new Card:

```tsx
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quest-uri terminate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.world.activeQuests.filter((quest) => quest.status === "completed").length === 0 ? (
            <p className="text-sm text-muted-foreground">Nimic încă.</p>
          ) : (
            state.world.activeQuests
              .filter((quest) => quest.status === "completed")
              .map((quest) => (
                <div key={quest.id} className="flex items-center gap-2">
                  <Badge variant="success">✓</Badge>
                  <p className="text-sm">{quest.title}</p>
                </div>
              ))
          )}
        </CardContent>
      </Card>
```

`Badge` is already imported at the top of the file. Do not duplicate the import.

- [ ] **Step 2: Add quest completion guidance to dmPrompt.ts**

Open `src/lib/prompts/dmPrompt.ts`. Find the `Game mechanics:` section. After the existing bullet:

```
- On critical success (natural 20): add bonus reward.
```

Append a new bullet:

```
- Quest completion: when the player rescues the mayor's daughter from Goblin Cave, call updateGameState to set the matching quest's status to "completed".
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/StatsSidebar.tsx src/lib/prompts/dmPrompt.ts
git commit -m "feat(ui): show completed quests; instruct DM to mark quest done"
```

---

## Task 6: F6 — Loading indicator „DM gândește…"

**Files:**
- Modify: `src/app/game/page.tsx`

- [ ] **Step 1: Add the loading indicator JSX**

Open `src/app/game/page.tsx`. Find the block (inside the chat `CardContent`):

```tsx
            <div className="flex flex-wrap gap-2">
              {latestRolls.map((roll, index) => (
                <DiceRoll key={`${roll.checkType}-${roll.total}-${index}`} roll={roll} />
              ))}
            </div>
```

Insert immediately ABOVE this block:

```tsx
            {loading ? (
              <p className="text-xs italic text-zinc-400">
                Dungeon Master gândește<span className="animate-pulse">...</span>
              </p>
            ) : null}
```

`loading` is already destructured from `useGameStore()` at the top of this component. Do not re-destructure.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/game/page.tsx
git commit -m "feat(ui): show 'DM gândește…' indicator while turn loads"
```

---

## Task 7: F7 — Vercel-compatible persistence

**Files:**
- Modify: `src/lib/tools/gameState.ts`

- [ ] **Step 1: Add module-level memory store + dual-mode helpers**

Open `src/lib/tools/gameState.ts`. Find the lines:

```ts
const SESSIONS_PATH = path.join(process.cwd(), "data", "game-sessions.json");

type SessionMap = Record<string, GameState>;
```

Replace with:

```ts
const SESSIONS_PATH = path.join(process.cwd(), "data", "game-sessions.json");

type SessionMap = Record<string, GameState>;

const useMemoryStore =
  !!process.env.VERCEL || process.env.IN_MEMORY_SESSIONS === "1";

const memorySessions = new Map<string, GameState>();
```

- [ ] **Step 2: Update readSessions to honor in-memory mode**

In the same file, find:

```ts
async function readSessions(): Promise<SessionMap> {
  try {
    const fileContent = await fs.readFile(SESSIONS_PATH, "utf8");
    return JSON.parse(fileContent) as SessionMap;
  } catch {
    return {};
  }
}
```

Replace with:

```ts
async function readSessions(): Promise<SessionMap> {
  if (useMemoryStore) {
    return Object.fromEntries(memorySessions);
  }

  try {
    const fileContent = await fs.readFile(SESSIONS_PATH, "utf8");
    return JSON.parse(fileContent) as SessionMap;
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: Update writeSessions to honor in-memory mode**

In the same file, find:

```ts
async function writeSessions(sessions: SessionMap): Promise<void> {
  await fs.writeFile(SESSIONS_PATH, JSON.stringify(sessions, null, 2), "utf8");
}
```

Replace with:

```ts
async function writeSessions(sessions: SessionMap): Promise<void> {
  if (useMemoryStore) {
    memorySessions.clear();
    for (const [key, value] of Object.entries(sessions)) {
      memorySessions.set(key, value);
    }
    return;
  }

  await fs.writeFile(SESSIONS_PATH, JSON.stringify(sessions, null, 2), "utf8");
}
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tools/gameState.ts
git commit -m "fix(persistence): in-memory store on Vercel; file store locally"
```

---

## Task 8: Bonus — New Game button

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/app/game/page.tsx`

- [ ] **Step 1: Add `reset` to the store interface**

Open `src/store/gameStore.ts`. Find the `GameStoreState` interface block:

```ts
interface GameStoreState {
  sessionId: string | null;
  playerName: string;
  playerClass: PlayerClass;
  gameState: GameState | null;
  chat: ChatEntry[];
  latestRolls: DiceRollResult[];
  loading: boolean;
  error: string | null;
  initGame: (playerName: string, playerClass: PlayerClass, sessionId?: string) => Promise<void>;
  playTurn: (message: string) => Promise<void>;
}
```

Add a new field at the end of the interface (before the closing brace):

```ts
  reset: () => void;
```

- [ ] **Step 2: Implement `reset` in the store**

In the same file, find the `playTurn` implementation. After its closing `}` (and before the closing `}))` of `create<GameStoreState>(...)`), insert:

```ts
  reset: () =>
    set({
      sessionId: null,
      gameState: null,
      chat: [],
      latestRolls: [],
      error: null,
    }),
```

Make sure the trailing comma matches the existing style of the surrounding object literal.

- [ ] **Step 3: Add the New Game button in game/page.tsx**

Open `src/app/game/page.tsx`. Find the `useGameStore()` destructure block:

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
    playTurn,
    initGame,
    playerClass,
    playerName,
    reset,
  } = useGameStore();
```

Then find the `CardHeader` block:

```tsx
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl">Sesiune #{sessionId?.slice(0, 8)}</CardTitle>
          </CardHeader>
```

Replace with:

```tsx
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-2xl">Sesiune #{sessionId?.slice(0, 8)}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                router.push("/character");
              }}
            >
              New Game
            </Button>
          </CardHeader>
```

`Button` is already imported at the top of the file. Do not duplicate the import.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/store/gameStore.ts src/app/game/page.tsx
git commit -m "feat(ui): add New Game button + reset method on store"
```

---

## Task 9: Final verification

**Files:** none modified.

- [ ] **Step 1: Final clean build**

Run: `npm run build`
Expected: build succeeds with no warnings related to changes in this plan.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: lint passes (no new errors). Pre-existing warnings unrelated to this plan are acceptable; do not fix them in this phase.

- [ ] **Step 3: Headless smoke test (no API calls)**

Start the dev server in the background:

Run: `npm run dev` (use the Bash tool's `run_in_background: true`)

Wait until the server is ready (look for the line containing `Local:` and `:3000` in the dev log).

Then issue these requests:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/character
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/game
```

Expected: each command prints `200`.

Then fetch the home page HTML and grep for the title string:

```bash
curl -s http://localhost:3000/ | grep -c "Aventura RPG text-based"
```

Expected: prints `1` (or higher).

None of these requests touch `/api/game`, so they do not require an `ANTHROPIC_API_KEY`.

Stop the dev server when done (kill the background bash shell).

(Optional, recommended after user review) — manual browser pass: open `http://localhost:3000`, click „Creeaza personaj", verify the 3 class cards highlight on click. Do NOT click „Incepe aventura" — it would call `/api/game` and require an API key.

- [ ] **Step 4: Confirm git state is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -10`
Expected: all 7-8 commits from this plan are present in order, on top of the spec doc commits.

- [ ] **Step 5: Final summary commit (skip if no changes left)**

This step is intentionally a no-op unless any uncommitted file remains. If `git status` showed uncommitted files in Step 4, investigate before committing.

---

## Out of scope (defer to Faza B or later)

- Streaming Claude responses
- Vector memory / embeddings reale
- Locații / quests / NPC-uri suplimentare
- Combat HP bidirecțional pentru NPC-uri
- Vercel KV / Upstash Redis
- Save / Load între sesiuni separate
- Live API smoke test (deferred until user provides `ANTHROPIC_API_KEY`)
- Business foundation, Landing page, Pitch deck (Faza B)
- Adăugare framework de teste (Jest / Vitest)
