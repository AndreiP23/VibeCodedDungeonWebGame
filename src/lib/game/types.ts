export type PlayerClass = "warrior" | "mage" | "rogue";

export type SkillType =
  | "Combat"
  | "Stealth"
  | "Persuasion"
  | "Perception"
  | "Athletics";

export type RollCheckType = SkillType | "Damage" | "Attack";

export type DiceSides = 4 | 6 | 8 | 10 | 12 | 20;

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

export type StatKey = "str" | "dex" | "int" | "cha";

export interface PlayerBonuses {
  items: string[];
  statBonus?: { stat: StatKey; amount: number };
  goldBonus?: number;
  flavorTrait?: string;
}

export interface CharacterReviewResult {
  approved: boolean;
  verdict: string;
  bonuses: PlayerBonuses;
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
    backstory?: string;
    flavorTrait?: string;
    avatarUrl?: string;
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
  checkType: RollCheckType;
  sides: DiceSides;
  roll: number;
  modifier: number;
  total: number;
  difficulty: number | null;
  success: boolean | null;
}

export interface RollRequest {
  sides: DiceSides;
  modifier: number;
  checkType: RollCheckType;
  difficulty?: number;
  toolUseId: string;
}

export interface TurnResult {
  narration: string;
  npcDialogue?: string;
  diceRolls: DiceRollResult[];
  updatedState: GameState;
}
