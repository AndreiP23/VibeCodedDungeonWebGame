# DungeonMaster AI — Faza A: fix-uri demo playable

**Data:** 2026-05-05
**Autor:** brainstorming session
**Scope:** chirurgicale, fără refactor arhitectural
**Estimare totală:** ~2-2.5h
**Branch țintă:** `master` (commit unic la final, după ce trece `npm run build`)

---

## 1. Context

Repo-ul implementează deja ~80% din spec-ul tehnic (`proiect_mpa.pdf`):
arhitectură 2-agenți, tool use real (rollDice, updateGameState, getNPCResponse,
getMemory), persistență JSON, UI 70/30, 4 NPC-uri, 3 locații, 1 quest principal.

Această fază (A) elimină bug-urile blocante care împiedică un demo end-to-end
funcțional pentru prezentarea MPA 2026. Faza B (Business foundation, Landing
page, Pitch deck) va fi specificată separat după finalizarea A.

## 2. Principii

- **Chirurgical:** nu refactorez arhitectura existentă.
- **Touch minim:** modific doar liniile necesare.
- **Zero dependențe noi:** folosesc strict ce există în `package.json`.
- **Compatibil local + Vercel:** decizii care nu sparg `npm run dev` și nici deploy serverless.

## 3. Fix-uri

### F1 — Model name corect

**Fișier:** `src/lib/agentClient.ts:20`

**Problemă:** Default-ul `"claude-sonnet-4-5"` nu este model curent valid.

**Modificare:** schimb default-ul la `"claude-sonnet-4-6"`.

```ts
// înainte
return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
// după
return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
```

**Side-effects:** README updated să reflecte modelul curent. Env var override
păstrat — utilizatorul poate suprascrie cu `claude-haiku-4-5-20251001` pentru
costuri reduse în prezentare.

---

### F2 — rollDice real-random

**Fișier:** `src/lib/tools/dice.ts`

**Problemă:** funcția curentă folosește FNV-1a hash determinist pe seed; aceeași
combinație `(sessionId, lengthMemory, message, checkType, difficulty, modifier)`
produce aceeași valoare. Distribuție inegală pe d20 + jucătorul poate exploata
patternul.

**Modificare:**
- Înlocuiesc `hashSeed` + logica de seed cu `Math.floor(Math.random() * sides) + 1`.
- Elimin câmpul `seed` din `DiceToolInput`.
- Elimin parametrul `seed` din apelul în `src/lib/agents/dungeonMaster.ts:195`.

**Justificare:** spec-ul cere „funcție deterministă" în sensul că zarul NU este
generat prin LLM (care ar halucina), nu că aceeași intrare dă mereu aceeași
valoare. `Math.random()` este suficient pentru un MVP single-player.

---

### F3 — Badge variants `success` / `danger`

**Fișier:** `src/components/ui/badge.tsx`

**Problemă:** `src/components/DiceRoll.tsx:11` folosește `variant="success"` și
`variant="danger"`, dar shadcn/ui default nu definește aceste variante. Rezultat:
TS error sau fallback urât.

**Modificare:** adaug variantele în CVA-ul componentei:

```ts
success: "border-transparent bg-emerald-500 text-white hover:bg-emerald-500/80",
danger:  "border-transparent bg-rose-500 text-white hover:bg-rose-500/80",
```

**Side-effects:** zero — doar adaug variante noi.

---

### F4 — NPC location filter

**Fișiere:**
- `src/lib/agents/npcBrain.ts` (verificare runtime)
- `src/lib/prompts/dmPrompt.ts` (constraint preventiv în prompt)

**Problemă:** Agentul DM poate apela `getNPCResponse("grix", ...)` chiar și când
jucătorul este în tavernă; nimic nu împiedică.

**Modificare:**

În `npcBrain.ts`, la începutul `getNPCResponse`, după ce găsim NPC-ul:

```ts
if (npc.location !== input.state.player.location) {
  return `[NPC ${npc.name} nu este în locația curentă (${input.state.player.location}). Reformulează narațiunea.]`;
}
```

Tool result-ul ajunge la DM ca răspuns de NPC; DM-ul îl interpretează și
reformulează. Mecanismul reactiv e suficient.

În `dmPrompt.ts`, adaug în lista de Hard constraints:

```
8. Only call getNPCResponse for NPCs whose location matches the player's current
   location. Verify state.player.location vs the NPC's listed location before calling.
```

---

### F5 — Quest win-state vizibil

**Fișiere:**
- `src/components/StatsSidebar.tsx`
- `src/lib/prompts/dmPrompt.ts`

**Problemă:** quest-ul principal nu are feedback vizual când e completat.

**Modificare:**

În `StatsSidebar.tsx`, după Card-ul „Quest Activ", adaug un Card „Quest-uri
terminate" care iterează prin `state.world.activeQuests.filter(q => q.status === "completed")`
și afișează titlu + Badge `variant="success"`.

În `dmPrompt.ts`, adaug în secțiunea „Game mechanics":

```
- Quest completion: when the player rescues the mayor's daughter from Goblin Cave,
  call updateGameState to set the matching quest's status to "completed".
```

Nu adaug logică hardcoded — agentul decide când quest-ul e terminat, conform
narațiunii.

---

### F6 — Loading indicator „DM gândește…"

**Fișier:** `src/app/game/page.tsx`

**Problemă:** Latențele Claude sunt 3-8s; UX curent pare blocat fără feedback.

**Modificare:** Sub `<ScrollArea>` cu chat, înainte de `<div className="flex flex-wrap gap-2">`
cu zaruri, adaug:

```tsx
{loading ? (
  <p className="text-xs italic text-zinc-400">
    Dungeon Master gândește<span className="animate-pulse">...</span>
  </p>
) : null}
```

Folosesc `loading` deja expus de `useGameStore`. Zero modificări la store.

---

### F7 — Persistență Vercel-compatibilă

**Fișier:** `src/lib/tools/gameState.ts`

**Problemă:** filesystem-ul Vercel serverless e read-only; `fs.writeFile` aruncă
EROFS la deploy live.

**Strategie:** runtime detection + dual-mode store.

```ts
const useMemoryStore =
  !!process.env.VERCEL || process.env.IN_MEMORY_SESSIONS === "1";

const memorySessions = new Map<string, GameState>();

async function readSessions(): Promise<SessionMap> {
  if (useMemoryStore) {
    return Object.fromEntries(memorySessions);
  }
  // varianta curentă cu fs.readFile
}

async function writeSessions(sessions: SessionMap): Promise<void> {
  if (useMemoryStore) {
    memorySessions.clear();
    for (const [key, value] of Object.entries(sessions)) {
      memorySessions.set(key, value);
    }
    return;
  }
  // varianta curentă cu fs.writeFile
}
```

**Comportament:**
- Local (`npm run dev`): file persistence — refresh-ul păstrează jocul.
- Vercel: in-memory pe durata instanței — refresh = sesiune nouă (acceptabil
  pentru demo de pe landing page).

**Side-effects:** zero impact pe API. Modulul rămâne stateless din afară.

---

### Bonus — New Game button

**Fișiere:**
- `src/store/gameStore.ts` (adaug metoda `reset`)
- `src/app/game/page.tsx` (buton în header)

**Modificare:**

În `gameStore.ts`, adaug:

```ts
reset: () => set({
  sessionId: null,
  gameState: null,
  chat: [],
  latestRolls: [],
  error: null,
}),
```

În `game/page.tsx`, în `CardHeader`, adaug un Button (variant ghost / outline)
care apelează `reset()` apoi `router.push("/character")`.

---

## 4. Plan de testare

1. **Build static:** `npm run build` trebuie să treacă cu TS strict mode.
2. **Smoke test local (`npm run dev`):**
   - Creare personaj `rogue` cu numele „Arin".
   - Trimite 5+ ture conversaționale și de combat.
   - Verifică că Borin răspunde în character în tavernă.
   - Încearcă „atac pe Grix" din tavernă — DM-ul trebuie să refuze elegant
     (NPC nu e prezent).
   - Verifică că rolurile aceluiași skill check pe ture diferite dau valori
     diferite (F2 verification).
   - Verifică că badge-ul roll succes este verde, eșec este roșu (F3).
   - Verifică indicatorul „DM gândește…" pe latență (F6).
   - Apasă „New Game" → redirect la `/character`, store curățat (Bonus).
3. **(Opțional) `vercel dev`:**
   - Verifică că modul in-memory funcționează — sesiunea persistă într-o
     fereastră deschisă, dar refresh = sesiune nouă.

## 5. Out of scope (Faza A)

Următoarele NU intră în această fază (le tratăm în Faza B sau separat):
- Streaming Claude responses
- Vector memory / embeddings reale
- Locații / quests / NPC-uri suplimentare
- Combat HP bidirecțional pentru NPC-uri
- Vercel KV / Upstash Redis
- Save / Load între sesiuni separate
- Business foundation, Landing page, Pitch deck (toate intră în Faza B)

## 6. Risc-uri identificate

| Risc | Probabilitate | Mitigare |
|------|---------------|----------|
| `claude-sonnet-4-6` nu e disponibil pe contul utilizatorului | scăzut | env var override la `claude-haiku-4-5-20251001` |
| `npm run build` rupe TS strict | scăzut | rulez build după fiecare fix grup |
| `Map` modul-level pierdut între invocări serverless | mediu (Vercel cold start) | acceptabil pentru demo; documentat clar în README |
| Comportament nou NPC location filter strică narațiuni existente în memorie | scăzut | DM-ul reformulează automat din mesajul de eroare |
