import { GameState, MemoryEntry, Message } from "@/lib/game/types";

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreMatch(queryTokens: string[], value: string): number {
  const valueTokens = new Set(tokenize(value));
  return queryTokens.reduce(
    (score, token) => (valueTokens.has(token) ? score + 1 : score),
    0,
  );
}

export function getMemory(state: GameState, query: string): string[] {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  const combined: Array<{ score: number; text: string }> = [];

  state.longTermMemory.forEach((entry) => {
    const score = scoreMatch(queryTokens, `${entry.summary} ${entry.tags.join(" ")}`);
    if (score > 0) {
      combined.push({ score, text: entry.summary });
    }
  });

  state.shortTermMemory.forEach((entry) => {
    const score = scoreMatch(queryTokens, entry.content);
    if (score > 0) {
      combined.push({ score, text: entry.content });
    }
  });

  return combined
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item) => item.text);
}

export function pushShortTermMessages(state: GameState, messages: Message[]): GameState {
  const merged = [...state.shortTermMemory, ...messages].slice(-20);
  return {
    ...state,
    shortTermMemory: merged,
  };
}

export function pushLongTermMemory(state: GameState, entry: MemoryEntry): GameState {
  return {
    ...state,
    longTermMemory: [...state.longTermMemory, entry].slice(-100),
  };
}
