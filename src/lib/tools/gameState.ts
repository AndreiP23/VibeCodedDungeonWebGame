import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import locationsData from "../../../data/locations.json";
import npcsData from "../../../data/npcs.json";
import { clampBonuses } from "@/lib/agents/characterReview";
import { buildAvatarSpec } from "@/lib/tools/avatar";
import { buildRandomBackstory } from "@/lib/tools/backstory";
import {
  GameState,
  InventoryItem,
  ItemRarity,
  NPC,
  PlayerBonuses,
  PlayerClass,
  Quest,
} from "@/lib/game/types";

const SESSIONS_PATH = path.join(process.cwd(), "data", "game-sessions.json");

type SessionMap = Record<string, GameState>;

const useMemoryStore =
  !!process.env.VERCEL || process.env.IN_MEMORY_SESSIONS === "1";

const memorySessions = new Map<string, GameState>();

const CLASS_PRESETS: Record<
  PlayerClass,
  {
    hp: number;
    stats: { str: number; dex: number; int: number; cha: number };
    inventory: InventoryItem[];
    gold: number;
  }
> = {
  warrior: {
    hp: 26,
    stats: { str: 4, dex: 1, int: 0, cha: 1 },
    inventory: [
      { name: "longsword", rarity: "uncommon" },
      { name: "shield", rarity: "common" },
      { name: "torch", rarity: "common" },
    ],
    gold: 12,
  },
  mage: {
    hp: 18,
    stats: { str: 0, dex: 1, int: 4, cha: 2 },
    inventory: [
      { name: "oak staff", rarity: "uncommon" },
      { name: "spellbook", rarity: "rare" },
      { name: "mana crystal", rarity: "uncommon" },
    ],
    gold: 14,
  },
  rogue: {
    hp: 20,
    stats: { str: 1, dex: 4, int: 1, cha: 2 },
    inventory: [
      { name: "dagger", rarity: "common" },
      { name: "lockpick set", rarity: "uncommon" },
      { name: "smoke vial", rarity: "uncommon" },
    ],
    gold: 16,
  },
};

const VALID_RARITIES: readonly ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export function normalizeInventoryItem(raw: unknown): InventoryItem | null {
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return { name, rarity: "common" };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as { name?: unknown; rarity?: unknown };
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name) return null;
    const rarity = VALID_RARITIES.includes(obj.rarity as ItemRarity)
      ? (obj.rarity as ItemRarity)
      : "common";
    return { name, rarity };
  }
  return null;
}

function normalizeInventory(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeInventoryItem(entry))
    .filter((entry): entry is InventoryItem => entry !== null);
}

const MAIN_QUEST: Quest = {
  id: "find-mayor-daughter",
  title: "Find the Mayor's Missing Daughter",
  description:
    "Follow clues from the Broken Crown Tavern into Blackwolf Forest and confront the source in Goblin Cave.",
  status: "active",
};

interface BuildInitialStateOptions {
  playerName: string;
  playerClass: PlayerClass;
  backstory?: string;
  bonuses?: PlayerBonuses;
}

function buildInitialState(options: BuildInitialStateOptions): GameState {
  const { playerName, playerClass, backstory, bonuses } = options;
  const preset = CLASS_PRESETS[playerClass];
  const safeBonuses = bonuses ? clampBonuses(bonuses, playerClass) : undefined;

  const stats = { ...preset.stats };
  if (safeBonuses?.statBonus) {
    stats[safeBonuses.statBonus.stat] += safeBonuses.statBonus.amount;
  }

  const bonusItems: InventoryItem[] = (safeBonuses?.items ?? []).map((name) => ({
    name,
    rarity: "common" as ItemRarity,
  }));
  const inventory: InventoryItem[] = [...preset.inventory, ...bonusItems];
  const gold = preset.gold + (safeBonuses?.goldBonus ?? 0);
  const finalBackstory = backstory?.trim() || buildRandomBackstory(playerClass);
  const avatar = buildAvatarSpec(playerClass, finalBackstory);

  return {
    player: {
      name: playerName,
      class: playerClass,
      hp: { current: preset.hp, max: preset.hp },
      stats,
      inventory,
      gold,
      location: "Broken Crown Tavern",
      backstory: finalBackstory,
      flavorTrait: safeBonuses?.flavorTrait,
      avatarUrl: avatar.url,
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

export async function getOrCreateGameState(options: {
  sessionId?: string;
  playerName: string;
  playerClass: PlayerClass;
  backstory?: string;
  bonuses?: PlayerBonuses;
}): Promise<{ sessionId: string; state: GameState; created: boolean }> {
  const sessionId = options.sessionId ?? randomUUID();
  const sessions = await readSessions();
  let created = false;

  if (!sessions[sessionId]) {
    sessions[sessionId] = buildInitialState({
      playerName: options.playerName,
      playerClass: options.playerClass,
      backstory: options.backstory,
      bonuses: options.bonuses,
    });
    await writeSessions(sessions);
    created = true;
  }

  return {
    sessionId,
    state: sessions[sessionId],
    created,
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
      inventory: changes.player?.inventory
        ? normalizeInventory(changes.player.inventory)
        : normalizeInventory(currentState.player.inventory),
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
