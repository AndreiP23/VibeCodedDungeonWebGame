"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CharacterReviewResult, PlayerClass } from "@/lib/game/types";
import { useGameStore } from "@/store/gameStore";

const classOptions: Array<{ value: PlayerClass; label: string; description: string }> = [
  {
    value: "warrior",
    label: "Warrior",
    description: "Rezistent in lupta, domina confruntarile directe.",
  },
  {
    value: "mage",
    label: "Mage",
    description: "Inteligenta ridicata, detecteaza si manipuleaza mistere arcane.",
  },
  {
    value: "rogue",
    label: "Rogue",
    description: "Rapid si persuasiv, excelent in infiltrare si negociere.",
  },
];

const STAT_LABEL: Record<"str" | "dex" | "int" | "cha", string> = {
  str: "STR",
  dex: "DEX",
  int: "INT",
  cha: "CHA",
};

export default function CharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("Arin");
  const [playerClass, setPlayerClass] = useState<PlayerClass>("warrior");
  const [backstory, setBackstory] = useState("");
  const [review, setReview] = useState<CharacterReviewResult | null>(null);

  const initGame = useGameStore((state) => state.initGame);
  const reviewCharacter = useGameStore((state) => state.reviewCharacter);
  const loading = useGameStore((state) => state.loading);
  const reviewing = useGameStore((state) => state.reviewing);
  const error = useGameStore((state) => state.error);

  function clearReview() {
    if (review) setReview(null);
  }

  async function handleReview() {
    const trimmed = backstory.trim();
    if (!trimmed) return;
    const result = await reviewCharacter(name.trim() || "Erou", playerClass, trimmed);
    if (result) setReview(result);
  }

  async function handleStart() {
    await initGame(name.trim() || "Erou", playerClass, {
      backstory: backstory.trim() || undefined,
      bonuses: review?.approved ? review.bonuses : undefined,
    });
    router.push("/game");
  }

  const canStart = !backstory.trim() || (review !== null && review.approved);
  const hasBackstory = backstory.trim().length > 0;

  return (
    <main className="min-h-screen px-4 py-10 text-text">
      <Card className="mx-auto max-w-2xl border-4 border-torch bg-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)]">
        <CardHeader>
          <CardTitle
            className="font-display text-3xl text-torch"
            style={{
              textShadow:
                "0 0 20px rgba(255,157,0,0.6), 0 0 40px rgba(255,157,0,0.3), 4px 4px 0 rgba(0,0,0,0.8)",
            }}
          >
            Creare Personaj
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-base font-medium">Nume</label>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearReview();
              }}
              placeholder="Numele eroului"
              className="border-4 border-text-dim bg-bg text-text text-lg focus:border-torch focus:outline-none"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {classOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => {
                  setPlayerClass(option.value);
                  clearReview();
                }}
                className={`border-4 p-3 text-left transition ${
                  playerClass === option.value
                    ? "border-torch bg-torch/10"
                    : "border-text-dim bg-bg hover:border-torch"
                }`}
              >
                <p className="font-semibold text-lg">{option.label}</p>
                <p className="mt-1 text-sm text-text-dim">{option.description}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-base font-medium">Poveste si descriere (optional)</label>
            <textarea
              value={backstory}
              onChange={(event) => {
                setBackstory(event.target.value);
                clearReview();
              }}
              placeholder="Cine este eroul tau? De unde vine, ce vrea, ce trasaturi il definesc?"
              maxLength={2000}
              rows={5}
              className="w-full resize-y border-4 border-text-dim bg-bg text-text px-3 py-2 text-lg placeholder:text-text-dim focus:border-torch focus:outline-none"
            />
            <div className="flex items-center justify-between text-sm text-text-dim">
              <span>{backstory.length}/2000</span>
              <span>DM-ul decide bonusurile pe baza povestii.</span>
            </div>
          </div>

          {hasBackstory ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleReview}
              disabled={reviewing}
              className="w-full"
            >
              {reviewing
                ? "DM-ul citeste..."
                : review
                  ? "Cere DM-ului din nou"
                  : "Cere binecuvantarea DM-ului"}
            </Button>
          ) : null}

          {review ? (
            <div
              className={`border-4 p-3 text-base ${
                review.approved
                  ? "border-torch bg-torch/10"
                  : "border-hp bg-hp/10"
              }`}
            >
              <p className="font-medium text-lg">
                {review.approved ? "DM-ul aproba." : "DM-ul nu aproba."}
              </p>
              <p className="mt-1 text-text">{review.verdict}</p>

              {review.approved ? (
                <div className="mt-3 space-y-1 text-text">
                  {review.bonuses.items.length > 0 ? (
                    <p>
                      <span className="text-text-dim">Obiecte: </span>
                      {review.bonuses.items.join(", ")}
                    </p>
                  ) : null}
                  {review.bonuses.statBonus ? (
                    <p>
                      <span className="text-text-dim">Bonus stat: </span>+
                      {review.bonuses.statBonus.amount}{" "}
                      {STAT_LABEL[review.bonuses.statBonus.stat]}
                    </p>
                  ) : null}
                  {review.bonuses.goldBonus && review.bonuses.goldBonus > 0 ? (
                    <p>
                      <span className="text-text-dim">Aur: </span>+{review.bonuses.goldBonus}
                    </p>
                  ) : null}
                  {review.bonuses.flavorTrait ? (
                    <p>
                      <span className="text-text-dim">Trasatura: </span>
                      {review.bonuses.flavorTrait}
                    </p>
                  ) : null}
                  {review.bonuses.items.length === 0 &&
                  !review.bonuses.statBonus &&
                  !review.bonuses.goldBonus &&
                  !review.bonuses.flavorTrait ? (
                    <p className="text-text-dim">Niciun bonus mecanic, doar aroma narativa.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <Button
            onClick={handleStart}
            disabled={loading || reviewing || !canStart}
            className="w-full"
          >
            {loading
              ? "Se pregateste aventura..."
              : !canStart
                ? "Cere intai aprobarea DM-ului"
                : "Incepe aventura"}
          </Button>

          {error ? <p className="text-base text-hp">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
