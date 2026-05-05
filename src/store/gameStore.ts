import { create } from "zustand";
import { DiceRollResult, GameState, PlayerClass } from "@/lib/game/types";

interface ChatEntry {
  id: string;
  role: "player" | "dm" | "npc";
  content: string;
}

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
  error: null,

  initGame: async (playerName, playerClass, sessionId) => {
    set({ loading: true, error: null });

    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init",
          sessionId,
          playerName,
          playerClass,
        }),
      });

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Nu am putut initializa jocul.");
      }

      const introMessage: ChatEntry = {
        id: crypto.randomUUID(),
        role: "dm",
        content: payload.narration,
      };

      set({
        sessionId: payload.sessionId,
        playerName,
        playerClass,
        gameState: payload.state,
        chat: [introMessage],
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

  playTurn: async (message) => {
    const state = get();

    if (!state.sessionId || !state.gameState) {
      set({ error: "Jocul nu este initializat." });
      return;
    }

    set((current) => ({
      loading: true,
      error: null,
      chat: [
        ...current.chat,
        {
          id: crypto.randomUUID(),
          role: "player",
          content: message,
        },
      ],
    }));

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

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Turul a esuat.");
      }

      const messages: ChatEntry[] = [
        {
          id: crypto.randomUUID(),
          role: "dm",
          content: payload.narration,
        },
      ];

      if (payload.npcDialogue) {
        messages.push({
          id: crypto.randomUUID(),
          role: "npc",
          content: payload.npcDialogue,
        });
      }

      set((current) => ({
        loading: false,
        latestRolls: payload.diceRolls,
        gameState: payload.state,
        chat: [...current.chat, ...messages],
      }));
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Eroare necunoscuta.",
      });
    }
  },
}));
