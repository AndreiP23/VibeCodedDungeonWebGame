import { create } from "zustand";
import {
  CharacterReviewResult,
  DiceRollResult,
  GameState,
  PlayerBonuses,
  PlayerClass,
} from "@/lib/game/types";

interface ChatEntry {
  id: string;
  role: "player" | "dm" | "npc";
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
  reset: () => void;
}

interface ApiResponse {
  sessionId: string;
  narration: string;
  npcDialogue: string | null;
  diceRolls: DiceRollResult[];
  state: GameState;
  error?: string;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  sessionId: null,
  playerName: "",
  playerClass: "warrior",
  gameState: null,
  chat: [],
  latestRolls: [],
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

      const payload = (await response.json()) as ApiResponse;

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

    set((current) => ({
      loading: true,
      error: null,
      latestRolls: [],
      chat: [
        ...current.chat,
        {
          id: crypto.randomUUID(),
          role: "player",
          content: message,
        },
      ],
    }));

    let pendingDmId: string | null = null;

    const ensurePendingDm = () => {
      if (pendingDmId) return pendingDmId;
      const id = crypto.randomUUID();
      pendingDmId = id;
      set((current) => ({
        chat: [...current.chat, { id, role: "dm", content: "" }],
      }));
      return id;
    };

    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "turn",
          sessionId: state.sessionId,
          playerName: state.playerName,
          playerClass: state.playerClass,
          message,
        }),
      });

      if (!response.ok || !response.body) {
        let errorMessage = "Turul a esuat.";
        try {
          const errorPayload = (await response.json()) as { error?: string };
          if (errorPayload.error) errorMessage = errorPayload.error;
        } catch {
          // body was not JSON (or already consumed); use default message
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

          if (event.type === "narration-delta") {
            const delta = String(event.delta ?? "");
            const id = ensurePendingDm();
            set((current) => ({
              chat: current.chat.map((entry) =>
                entry.id === id ? { ...entry, content: entry.content + delta } : entry,
              ),
            }));
          } else if (event.type === "dice") {
            const roll = event.roll as DiceRollResult;
            set((current) => ({ latestRolls: [...current.latestRolls, roll] }));
          } else if (event.type === "npc") {
            const text = String(event.text ?? "");
            set((current) => ({
              chat: [
                ...current.chat,
                { id: crypto.randomUUID(), role: "npc", content: text },
              ],
            }));
          } else if (event.type === "done") {
            const narration = String(event.narration ?? "");
            const id = pendingDmId;
            set((current) => ({
              loading: false,
              latestRolls: (event.diceRolls as DiceRollResult[] | undefined) ?? current.latestRolls,
              gameState: (event.state as GameState | undefined) ?? current.gameState,
              chat: id
                ? current.chat.map((entry) =>
                    entry.id === id ? { ...entry, content: narration || entry.content } : entry,
                  )
                : [
                    ...current.chat,
                    { id: crypto.randomUUID(), role: "dm", content: narration },
                  ],
            }));
          } else if (event.type === "error") {
            throw new Error(String(event.message ?? "Turul a esuat."));
          }
        }
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Eroare necunoscuta.",
      });
    }
  },

  reset: () =>
    set({
      sessionId: null,
      gameState: null,
      chat: [],
      latestRolls: [],
      error: null,
    }),
}));
