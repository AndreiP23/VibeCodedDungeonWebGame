"use client";

import { Badge } from "@/components/ui/badge";
import { DiceRollResult } from "@/lib/game/types";

interface DiceRollProps {
  roll: DiceRollResult;
}

export function DiceRoll({ roll }: DiceRollProps) {
  const isDamage = roll.checkType === "Damage";
  const variant = isDamage ? "gold" : roll.success ? "success" : "danger";
  const sign = roll.modifier >= 0 ? "+" : "";

  const detail = isDamage
    ? `${roll.checkType}: ${roll.total} dmg (${roll.roll}${sign}${roll.modifier})`
    : `${roll.checkType}: ${roll.total} (${roll.roll}${sign}${roll.modifier}) - ${
        roll.success ? "Succes" : "Esuat"
      }`;

  return (
    <Badge variant={variant}>
      <span aria-hidden className="mr-1">
        🎲
      </span>
      <span>D{roll.sides}</span>
      <span className="mx-1">·</span>
      <span>{detail}</span>
    </Badge>
  );
}
