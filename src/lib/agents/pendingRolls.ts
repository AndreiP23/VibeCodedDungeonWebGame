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
