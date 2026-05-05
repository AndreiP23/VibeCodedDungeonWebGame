# DungeonMaster AI

MVP RPG text-based single-player cu 2 agenți AI specializați, construit pentru un proiect universitar de Management de Produs Software.

- **Agent 1 — Dungeon Master**: orchestrator principal; interpretează intenția jucătorului, rulează zarul determinist, actualizează starea jocului și narează cinematografic.
- **Agent 2 — NPC Brain**: joacă rolul fiecărui personaj non-player în vocea lor distinctă, fără narațiune externă.

**Stack**: Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Anthropic Claude (tool use real) · Zustand · JSON persistence

---

## Setup rapid

### 1. Clonează și instalează

```bash
git clone <repo>
cd agentstest2
npm install
```

### 2. Configurează cheia API

```bash
cp .env.local.example .env.local
```

Editează `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### 3. Pornește

```bash
npm run dev
# http://localhost:3000
```

### 4. Verifică build pentru Vercel

```bash
npm run build
```

---

## Structura fișierelor

```
src/
  app/
    api/game/route.ts          ← endpoint principal POST /api/game
    game/page.tsx              ← ecranul de joc (layout 70/30)
    character/page.tsx         ← creare personaj
  lib/
    agents/
      dungeonMaster.ts         ← Agent 1: tool use loop Claude
      npcBrain.ts              ← Agent 2: dialog in-character
    prompts/
      dmPrompt.ts              ← prompt sistem Dungeon Master
      npcPrompt.ts             ← prompt sistem NPC Brain
    tools/
      dice.ts                  ← rollDice deterministă (seed-based)
      gameState.ts             ← getOrCreateGameState, updateGameState
      memory.ts                ← short/long term memory + semantic search
    game/types.ts              ← GameState, NPC, Quest, DiceRollResult
    agentClient.ts             ← wrapper Anthropic SDK
  components/
    ChatMessage.tsx            ← mesaj dm/player/npc cu stilizare distinctă
    StatsSidebar.tsx           ← HP, inventar, aur, locație, quest activ
    DiceRoll.tsx               ← badge 🎲 cu rezultat zar
  store/
    gameStore.ts               ← Zustand: sessionId, chat, gameState, turns
data/
  npcs.json                    ← fișele celor 4 NPC-uri
  locations.json               ← cele 3 locații conectate
  game-sessions.json           ← persistență sesiuni (auto-generat)
```

---

## Arhitectura agenților

### Regula critică anti-halucinație
HP, inventar, aur și stats **nu se modifică niciodată** prin text generat de LLM. Doar prin tool call-ul `updateGameState`. Exemplu: Claude nu poate scrie „acum ai 50 de aur" în narațiune — trebuie să apeleze `updateGameState({ player: { gold: 50 } })`.

### Flow complet pentru un tur

```
1. Jucător: „Mă duc la hangiu și îl întreb de fiica primarului"
2. POST /api/game { action: "turn", message: "...", sessionId: "..." }
3. Agent 1 (DM) identifică intenție: conversație NPC + Persuasion check
4. DM apelează rollDice(20, difficulty=12) → { roll: 14, total: 17, success: true }
5. DM apelează getNPCResponse("innkeeper_borin", ...) → declanșează Agent 2
6. Agent 2 generează răspunsul lui Borin in-character
7. Agent 1 primește dialogul NPC și îl integrează în narațiune
8. DM apelează updateGameState({ world: { discoveredLocations: [..., "Blackwolf Forest"] } })
9. Frontend primește: narration + npcDialogue + diceRolls[] + state actualizat
```

---

## Demo conversație

**Personaj**: Arin, Rogue (DEX +4, CHA +2) | HP 20/20 | Aur: 16 | Locație: Broken Crown Tavern

---

**[Jucător]** Mă apropii de Borin hangiul și îi spun că am auzit că fiica primarului a dispărut. Îl întreb dacă a văzut ceva suspect în ultimele zile.

**[🎲 Persuasion: 17 — Succes]**

**[Dungeon Master]** _Sala tavернei se golește puțin în jurul vostru când Borin înclină capul, privind în paharul pe jumătate gol. Zarurile destinului au vorbit — hangiul te cântărește cu ochii lui îngusti și decide că meriti un strop de adevăr. Îți face semn să te apleci mai aproape, cu o mână pe tejghea._

**[Borin — NPC]** „Da, da. Am văzut-o acum trei zile, înainte de apus. Vorbea cu cineva în spatele hanului — n-am văzut fața, dar mantia era de culoarea norilor de furtună. Dimineața, fata dispăruse. Bah! Nu-i treaba mea, dar... tu mi-ai salvat butoaiele de bandiți luna trecută. Mergi spre Pădure. Urmele duc acolo."

**[Dungeon Master]** _Borin îți împinge discret o hârtie cu o schiță — un simbol pe care l-a văzut pe mantia necunoscutului. Locația „Pădurea Lupului Negru" apare acum pe drumul tău. Noaptea e tânără, dar pericolul nu mai este._

---

**[Jucător]** Iau hârtia și încerc să ies pe ușa din spate fără să fiu văzut de Captain Aldric, care stă la masă.

**[🎲 Stealth: 19 — Succes]**

**[Dungeon Master]** _Pașii tăi de rogue alunecă printre umbre ca un gând uitat. Aldric ridică privirea o clipă — dar în acel moment cineva varsă un pahar, iar atenția lui se întoarce înainte. Ieși în curtea din spate, aer rece de pădure în nări, hârtia strânsă în pumn._

---

**[Jucător]** Atac goblinul de gardă cu pumnalul, surprindere!

**[🎲 Combat (surprindere): 22 — Succes critic]**

**[Dungeon Master]** _Din întunericul dintre copaci, lama ta găsește spațiul dintre armura improvizată a goblinului înainte ca acesta să scoată vreun sunet. Inamicul cade fără zgomot. Intrarea peșterii este liberă — undeva înăuntru, un glas de copil plânge înăbușit._

**[State actualizat]**: goblin_guard eliminat · Goblin Cave — zona de intrare accesibilă

---

## Locații și NPC-uri

| NPC | Locație | Personalitate |
|-----|---------|---------------|
| Borin | Broken Crown Tavern | Pitic precaut, prietenos dacă îi câștigi încrederea |
| Lyra | Blackwolf Forest | Vrăjitoare elfă, criptică, observă tot |
| Captain Aldric | Broken Crown Tavern | Uman disciplinat, suspicios |
| Grix | Goblin Cave | Goblin lider, violent, AC 13, HP 24 |

| Locație | Conectată la |
|---------|-------------|
| Broken Crown Tavern | Blackwolf Forest |
| Blackwolf Forest | Tavern, Goblin Cave |
| Goblin Cave | Blackwolf Forest |

---

## Deploy pe Vercel

```bash
vercel --prod
```

Adaugă variabila `ANTHROPIC_API_KEY` în dashboard-ul Vercel → Settings → Environment Variables. Fișierul `data/game-sessions.json` nu persistă între deployment-uri pe Vercel — pentru producție înlocuiește cu un KV store (Vercel KV / Upstash).
- `src/components/StatsSidebar.tsx` - sidebar stats
- `src/components/DiceRoll.tsx` - badge rezultat zar
- `data/npcs.json` - NPC definitions
- `data/locations.json` - locations definitions
- `data/game-sessions.json` - persistenta sesiuni

## Regula critica implementata

HP, inventar, aur, stats, locatie si quest-uri sunt persistate numai prin tool call-ul `updateGameState` din server. Agentul nu modifica direct aceste valori in text.

## Flux turn complet

1. Jucatorul trimite text din UI (`Ce faci?`).
2. Frontend face `POST /api/game` cu `action: "turn"`.
3. Dungeon Master Agent decide tool calls:
   - `rollDice`
   - `getNPCResponse`
   - `getMemory`
   - `updateGameState`
4. NPC Brain intoarce dialog in-character.
5. DM intoarce naratiune finala (maxim 4 propozitii).
6. Endpointul persista memorie + state si returneaza payload UI.

## Demo conversatie

- Jucator: "Ma duc la hangiu si il intreb de fiica primarului"
- DM (tool use): `rollDice(20, Persuasion)` -> total 17, succes
- DM (tool use): `getNPCResponse("innkeeper_borin", ... )`
- NPC Borin: "Daca o cauti pe fata, urmele ies din oras spre Blackwolf Forest. Nu te duce singur, baiete."
- DM: "Borin isi sterge halba, te masoara din priviri si coboara vocea. Iti confirma ca a vazut o trasura fortata spre padure, in noaptea disparitiei. Cu un gest scurt, iti schiteaza drumul spre Blackwolf Forest. Fumul gros al tavernei pare sa-ti apese in piept un avertisment clar."

## Note deployment Vercel

Pentru MVP universitar, persistenta JSON functioneaza local si in sesiuni simple. Pentru productie reala pe Vercel, recomanda mutarea persistentei in o baza externa (ex: SQLite hosted, Postgres, KV).
