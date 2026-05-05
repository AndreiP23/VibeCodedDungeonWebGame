import { Badge } from "@/components/ui/badge";
import { DiceRollResult } from "@/lib/game/types";

interface DiceRollProps {
  roll: DiceRollResult;
}

export function DiceRoll({ roll }: DiceRollProps) {
  return (
    <Badge variant={roll.success ? "success" : "danger"} className="text-xs">
      {`🎲 ${roll.checkType}: ${roll.total} (${roll.roll} + mod) - ${roll.success ? "Succes" : "Esuat"}`}
    </Badge>
  );
}
