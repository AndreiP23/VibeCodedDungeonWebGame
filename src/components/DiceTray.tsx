"use client";

import { useEffect, useRef, useState } from "react";
import { DiceSides } from "@/lib/game/types";
import { useGameStore } from "@/store/gameStore";

const SIDES: DiceSides[] = [4, 6, 8, 10, 12, 20];
const SHAKE_MS = 1000;
const FACE_INTERVAL_MS = 80;

function rollClient(sides: DiceSides): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function DiceTray() {
  const pendingRoll = useGameStore((s) => s.pendingRoll);
  const submitRoll = useGameStore((s) => s.submitRoll);
  const rollForFun = useGameStore((s) => s.rollForFun);

  const [animating, setAnimating] = useState<DiceSides | null>(null);
  const [visibleFace, setVisibleFace] = useState<Record<DiceSides, number>>({
    4: 4,
    6: 6,
    8: 8,
    10: 10,
    12: 12,
    20: 20,
  });
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick(sides: DiceSides) {
    if (animating) return;
    if (pendingRoll && pendingRoll.sides !== sides) return;

    const finalValue = rollClient(sides);
    setAnimating(sides);

    intervalRef.current = window.setInterval(() => {
      setVisibleFace((current) => ({
        ...current,
        [sides]: rollClient(sides),
      }));
    }, FACE_INTERVAL_MS);

    timeoutRef.current = window.setTimeout(() => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setVisibleFace((current) => ({ ...current, [sides]: finalValue }));
      setAnimating(null);

      if (pendingRoll && pendingRoll.sides === sides) {
        void submitRoll(finalValue);
      } else {
        rollForFun(sides);
      }
    }, SHAKE_MS);
  }

  const promptedSides = pendingRoll?.sides ?? null;
  const sign = pendingRoll && pendingRoll.modifier >= 0 ? "+" : "";

  return (
    <div className="shrink-0 border-t-4 border-torch bg-bg p-3">
      {pendingRoll ? (
        <p className="font-display text-[10px] tracking-wider text-torch mb-2 text-center">
          ARUNCA D{pendingRoll.sides}
          {sign}
          {pendingRoll.modifier} PENTRU {pendingRoll.checkType.toUpperCase()}
          {typeof pendingRoll.difficulty === "number" ? ` (DC ${pendingRoll.difficulty})` : ""}
        </p>
      ) : null}
      <div className="flex justify-center gap-3">
        {SIDES.map((sides) => {
          const isPrompted = promptedSides === sides;
          const isDisabled =
            (promptedSides !== null && !isPrompted) || (animating !== null && animating !== sides);
          const isAnimating = animating === sides;

          return (
            <button
              key={sides}
              type="button"
              disabled={isDisabled}
              onClick={() => handleClick(sides)}
              className={[
                "relative h-14 w-14 border-4 bg-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)]",
                "flex items-center justify-center font-display text-xs",
                isPrompted ? "border-torch text-torch dice-prompted" : "border-text-dim text-text-dim",
                isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-torch hover:text-torch",
                isAnimating ? "dice-shaking" : "",
              ].join(" ")}
            >
              <span className="absolute top-1 left-1 text-[7px] leading-none">D{sides}</span>
              <span className="text-sm">{visibleFace[sides]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
