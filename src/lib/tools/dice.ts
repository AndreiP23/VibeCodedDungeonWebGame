import { SkillType } from "@/lib/game/types";

export interface DiceToolInput {
  sides: number;
  modifier: number;
  checkType: SkillType;
  difficulty: number;
}

export interface DiceToolResult {
  checkType: SkillType;
  roll: number;
  total: number;
  success: boolean;
  difficulty: number;
}

export function rollDice(input: DiceToolInput): DiceToolResult {
  const sides = Math.max(2, input.sides);
  const roll = Math.floor(Math.random() * sides) + 1;
  const total = roll + input.modifier;

  return {
    checkType: input.checkType,
    roll,
    total,
    success: total >= input.difficulty,
    difficulty: input.difficulty,
  };
}
