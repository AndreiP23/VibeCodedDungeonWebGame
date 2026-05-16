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
    let errorMessage = "Request failed.";
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
        throw new Error(payload.error ?? "Could not initialize the game.");
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
        error: error instanceof Error ? error.message : "Unknown error.",
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
          "error" in payload ? payload.error : "Could not get the DM's blessing.";
        set({ reviewing: false, error: errorMessage });
        return null;
      }
      set({ reviewing: false });
      return payload;
    } catch (error) {
      set({
        reviewing: false,
        error: error instanceof Error ? error.message : "Unknown error.",
      });
      return null;
    }
  },

  playTurn: async (message) => {
    const state = get();
    if (!state.sessionId || !state.gameState) {
      set({ error: "The game is not initialized." });
      return;
    }
    if (state.pendingRoll) {
      set({ error: "Roll the requested die before continuing." });
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

function runStreamWithHandlers(
  url: string,
  body: unknown,
  set: (updater: (state: GameStoreState) => Partial<GameStoreState>) => void,
  get: () => GameStoreState,
) {
  let pendingDmId: string | null = null;
  let pendingDmDraft = "";
  let dmFlushed = false;

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
    dmFlushed = true;
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
            : narration && !dmFlushed
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
      error: error instanceof Error ? error.message : "Unknown error.",
    }));
  });
}
