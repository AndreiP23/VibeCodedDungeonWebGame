import { SkillType } from "@/lib/game/types";

export interface DiceToolInput {
  sides: number;
  modifier: number;
  checkType: SkillType;
  difficulty: number;
  seed: string;
}

export interface DiceToolResult {
  checkType: SkillType;
  roll: number;
  total: number;
  success: boolean;
  difficulty: number;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

export function rollDice(input: DiceToolInput): DiceToolResult {
  const sides = Math.max(2, input.sides);
  const normalizedSeed = `${input.seed}:${input.checkType}:${input.difficulty}:${input.modifier}`;
  const seedHash = hashSeed(normalizedSeed);
  const roll = (seedHash % sides) + 1;
  const total = roll + input.modifier;

  return {
    checkType: input.checkType,
    roll,
    total,
    success: total >= input.difficulty,
    difficulty: input.difficulty,
  };
}
