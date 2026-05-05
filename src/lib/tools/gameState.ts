import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import locationsData from "../../../data/locations.json";
import npcsData from "../../../data/npcs.json";
import { GameState, NPC, PlayerClass, Quest } from "@/lib/game/types";

const SESSIONS_PATH = path.join(process.cwd(), "data", "game-sessions.json");

type SessionMap = Record<string, GameState>;

const CLASS_PRESETS: Record<
  PlayerClass,
  {
    hp: number;
    stats: { str: number; dex: number; int: number; cha: number };
    inventory: string[];
    gold: number;
  }
> = {
  warrior: {
    hp: 26,
    stats: { str: 4, dex: 1, int: 0, cha: 1 },
    inventory: ["longsword", "shield", "torch"],
    gold: 12,
  },
  mage: {
    hp: 18,
    stats: { str: 0, dex: 1, int: 4, cha: 2 },
    inventory: ["oak staff", "spellbook", "mana crystal"],
    gold: 14,
  },
  rogue: {
    hp: 20,
    stats: { str: 1, dex: 4, int: 1, cha: 2 },
    inventory: ["dagger", "lockpick set", "smoke vial"],
    gold: 16,
  },
};

const MAIN_QUEST: Quest = {
  id: "find-mayor-daughter",
  title: "Find the Mayor's Missing Daughter",
  description:
    "Follow clues from the Broken Crown Tavern into Blackwolf Forest and confront the source in Goblin Cave.",
  status: "active",
};

function buildInitialState(playerName: string, playerClass: PlayerClass): GameState {
  const preset = CLASS_PRESETS[playerClass];

  return {
    player: {
      name: playerName,
      class: playerClass,
      hp: { current: preset.hp, max: preset.hp },
      stats: preset.stats,
      inventory: [...preset.inventory],
      gold: preset.gold,
      location: "Broken Crown Tavern",
    },
    world: {
      currentScene: (locationsData as Array<{ name: string; description: string }>)[0]
        .description,
      discoveredLocations: ["Broken Crown Tavern"],
      activeQuests: [MAIN_QUEST],
    },
    npcs: (npcsData as NPC[]).map((npc) => ({ ...npc })),
    shortTermMemory: [
      {
        role: "system",
        content:
          "You arrived in Broken Crown Tavern to investigate the mayor's missing daughter.",
        timestamp: new Date().toISOString(),
      },
    ],
    longTermMemory: [
      {
        id: randomUUID(),
        summary: "Quest started: find the mayor's missing daughter.",
        tags: ["quest", "mayor", "missing daughter"],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function readSessions(): Promise<SessionMap> {
  try {
    const fileContent = await fs.readFile(SESSIONS_PATH, "utf8");
    return JSON.parse(fileContent) as SessionMap;
  } catch {
    return {};
  }
}

async function writeSessions(sessions: SessionMap): Promise<void> {
  await fs.writeFile(SESSIONS_PATH, JSON.stringify(sessions, null, 2), "utf8");
}

export async function getOrCreateGameState(options: {
  sessionId?: string;
  playerName: string;
  playerClass: PlayerClass;
}): Promise<{ sessionId: string; state: GameState }> {
  const sessionId = options.sessionId ?? randomUUID();
  const sessions = await readSessions();

  if (!sessions[sessionId]) {
    sessions[sessionId] = buildInitialState(options.playerName, options.playerClass);
    await writeSessions(sessions);
  }

  return {
    sessionId,
    state: sessions[sessionId],
  };
}

export async function updateGameState(
  sessionId: string,
  changes: Partial<GameState>,
): Promise<GameState> {
  const sessions = await readSessions();
  const currentState = sessions[sessionId];

  if (!currentState) {
    throw new Error("Session not found for updateGameState.");
  }

  const nextState: GameState = {
    ...currentState,
    ...changes,
    player: {
      ...currentState.player,
      ...(changes.player ?? {}),
      hp: {
        ...currentState.player.hp,
        ...(changes.player?.hp ?? {}),
      },
      stats: {
        ...currentState.player.stats,
        ...(changes.player?.stats ?? {}),
      },
      inventory: changes.player?.inventory ?? currentState.player.inventory,
    },
    world: {
      ...currentState.world,
      ...(changes.world ?? {}),
      discoveredLocations:
        changes.world?.discoveredLocations ?? currentState.world.discoveredLocations,
      activeQuests: changes.world?.activeQuests ?? currentState.world.activeQuests,
    },
    npcs: changes.npcs ?? currentState.npcs,
    shortTermMemory: changes.shortTermMemory ?? currentState.shortTermMemory,
    longTermMemory: changes.longTermMemory ?? currentState.longTermMemory,
  };

  sessions[sessionId] = nextState;
  await writeSessions(sessions);

  return nextState;
}

export async function getState(sessionId: string): Promise<GameState | null> {
  const sessions = await readSessions();
  return sessions[sessionId] ?? null;
}
