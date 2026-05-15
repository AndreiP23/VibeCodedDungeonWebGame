"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DiceRollResult } from "@/lib/game/types";

interface DiceRollProps {
  roll: DiceRollResult;
}

const ROLL_DURATION_MS = 900;
const FLICKER_INTERVAL_MS = 70;
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function DiceRoll({ roll }: DiceRollProps) {
  const [rolling, setRolling] = useState(true);
  const [flickerTotal, setFlickerTotal] = useState(roll.total);
  const [face, setFace] = useState(DICE_FACES[0]);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setRolling(true);

    intervalRef.current = window.setInterval(() => {
      setFlickerTotal(1 + Math.floor(Math.random() * 20));
      setFace(DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)]);
    }, FLICKER_INTERVAL_MS);

    timeoutRef.current = window.setTimeout(() => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRolling(false);
    }, ROLL_DURATION_MS);

    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [roll.total, roll.checkType, roll.difficulty]);

  const variant = rolling ? "secondary" : roll.success ? "success" : "danger";

  return (
    <Badge variant={variant} className="text-xs">
      <span
        aria-hidden
        className={`mr-1 inline-block text-base leading-none ${
          rolling ? "animate-spin" : ""
        }`}
      >
        {rolling ? face : "🎲"}
      </span>
      {rolling
        ? `${roll.checkType}: ${flickerTotal}…`
        : `${roll.checkType}: ${roll.total} (${roll.roll} + mod) - ${
            roll.success ? "Succes" : "Esuat"
          }`}
    </Badge>
  );
}
