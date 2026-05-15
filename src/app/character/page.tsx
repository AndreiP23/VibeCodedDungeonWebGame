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
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-10 text-zinc-100">
      <Card className="mx-auto max-w-2xl border-zinc-700 bg-zinc-900/80">
        <CardHeader>
          <CardTitle className="text-3xl">Creare Personaj</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nume</label>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearReview();
              }}
              placeholder="Numele eroului"
              className="border-zinc-700 bg-zinc-950"
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
                className={`rounded-lg border p-3 text-left transition ${
                  playerClass === option.value
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                }`}
              >
                <p className="font-semibold">{option.label}</p>
                <p className="mt-1 text-xs text-zinc-400">{option.description}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Poveste si descriere (optional)</label>
            <textarea
              value={backstory}
              onChange={(event) => {
                setBackstory(event.target.value);
                clearReview();
              }}
              placeholder="Cine este eroul tau? De unde vine, ce vrea, ce trasaturi il definesc?"
              maxLength={2000}
              rows={5}
              className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500">
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
              className={`rounded-md border p-3 text-sm ${
                review.approved
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-rose-500/40 bg-rose-500/10"
              }`}
            >
              <p className="font-medium">
                {review.approved ? "DM-ul aproba." : "DM-ul nu aproba."}
              </p>
              <p className="mt-1 text-zinc-200">{review.verdict}</p>

              {review.approved ? (
                <div className="mt-3 space-y-1 text-zinc-200">
                  {review.bonuses.items.length > 0 ? (
                    <p>
                      <span className="text-zinc-400">Obiecte: </span>
                      {review.bonuses.items.join(", ")}
                    </p>
                  ) : null}
                  {review.bonuses.statBonus ? (
                    <p>
                      <span className="text-zinc-400">Bonus stat: </span>+
                      {review.bonuses.statBonus.amount}{" "}
                      {STAT_LABEL[review.bonuses.statBonus.stat]}
                    </p>
                  ) : null}
                  {review.bonuses.goldBonus && review.bonuses.goldBonus > 0 ? (
                    <p>
                      <span className="text-zinc-400">Aur: </span>+{review.bonuses.goldBonus}
                    </p>
                  ) : null}
                  {review.bonuses.flavorTrait ? (
                    <p>
                      <span className="text-zinc-400">Trasatura: </span>
                      {review.bonuses.flavorTrait}
                    </p>
                  ) : null}
                  {review.bonuses.items.length === 0 &&
                  !review.bonuses.statBonus &&
                  !review.bonuses.goldBonus &&
                  !review.bonuses.flavorTrait ? (
                    <p className="text-zinc-400">Niciun bonus mecanic, doar aroma narativa.</p>
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

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
