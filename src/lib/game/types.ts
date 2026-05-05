export type PlayerClass = "warrior" | "mage" | "rogue";

export type SkillType =
  | "Combat"
  | "Stealth"
  | "Persuasion"
  | "Perception"
  | "Athletics";

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed";
}

export interface NPC {
  id: string;
  name: string;
  race: string;
  personality: string;
  secrets: string[];
  speechStyle: string;
  location: string;
  armorClass?: number;
  hp?: number;
}

export interface Message {
  role: "player" | "dm" | "npc" | "system";
  content: string;
  timestamp: string;
}

export interface MemoryEntry {
  id: string;
  summary: string;
  tags: string[];
  timestamp: string;
}

export interface GameState {
  player: {
    name: string;
    class: PlayerClass;
    hp: { current: number; max: number };
    stats: { str: number; dex: number; int: number; cha: number };
    inventory: string[];
    gold: number;
    location: string;
  };
  world: {
    currentScene: string;
    discoveredLocations: string[];
    activeQuests: Quest[];
  };
  npcs: NPC[];
  shortTermMemory: Message[];
  longTermMemory: MemoryEntry[];
}

export interface DiceRollResult {
  checkType: SkillType;
  roll: number;
  total: number;
  success: boolean;
  difficulty: number;
}

export interface TurnResult {
  narration: string;
  npcDialogue?: string;
  diceRolls: DiceRollResult[];
  updatedState: GameState;
}
