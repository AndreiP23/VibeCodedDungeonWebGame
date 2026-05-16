"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CharacterReviewResult, GeneratedImage, PlayerClass } from "@/lib/game/types";
import { useGameStore } from "@/store/gameStore";
import { AvatarPreview } from "@/components/AvatarPreview";

const classOptions: Array<{ value: PlayerClass; label: string; description: string }> = [
  {
    value: "warrior",
    label: "Warrior",
    description: "Tough in combat, dominates direct confrontations.",
  },
  {
    value: "mage",
    label: "Mage",
    description: "High intelligence, detects and manipulates arcane mysteries.",
  },
  {
    value: "rogue",
    label: "Rogue",
    description: "Quick and persuasive, excellent at infiltration and negotiation.",
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
  const [avatar, setAvatar] = useState<GeneratedImage | null>(null);
  const [avatarRolling, setAvatarRolling] = useState(false);

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
    const result = await reviewCharacter(name.trim() || "Hero", playerClass, trimmed);
    if (result) setReview(result);
  }

  async function rerollAvatar() {
    setAvatarRolling(true);
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "avatar",
          playerClass,
          backstory: backstory.trim() || undefined,
          nameHint: name.trim() || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error("Avatar generation failed.");
      }
      const data = (await response.json()) as GeneratedImage;
      setAvatar(data);
    } catch (err) {
      console.warn("Avatar reroll failed:", err);
    } finally {
      setAvatarRolling(false);
    }
  }

  async function handleStart() {
    // If the player hasn't generated an avatar yet, generate one now so the
    // game starts with a real portrait (LLM-driven) rather than the template
    // fallback baked into buildAvatarSpec.
    let avatarUrl = avatar?.url;
    if (!avatarUrl) {
      setAvatarRolling(true);
      try {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "avatar",
            playerClass,
            backstory: backstory.trim() || undefined,
            nameHint: name.trim() || undefined,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as GeneratedImage;
          avatarUrl = data.url;
          setAvatar(data);
        }
      } catch {
        // Fall through — server will use deterministic fallback.
      } finally {
        setAvatarRolling(false);
      }
    }

    await initGame(name.trim() || "Hero", playerClass, {
      backstory: backstory.trim() || undefined,
      bonuses: review?.approved ? review.bonuses : undefined,
      avatarUrl,
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
            Create Character
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-base font-medium">Name</label>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearReview();
              }}
              placeholder="The hero's name"
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
            <label className="text-base font-medium">Backstory and description (optional)</label>
            <textarea
              value={backstory}
              onChange={(event) => {
                setBackstory(event.target.value);
                clearReview();
              }}
              placeholder="Who is your hero? Where do they come from, what do they want, what traits define them?"
              maxLength={2000}
              rows={5}
              className="w-full resize-y border-4 border-text-dim bg-bg text-text px-3 py-2 text-lg placeholder:text-text-dim focus:border-torch focus:outline-none"
            />
            <div className="flex items-center justify-between text-sm text-text-dim">
              <span>{backstory.length}/2000</span>
              <span>The DM decides bonuses based on the backstory.</span>
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
                ? "The DM is reading..."
                : review
                  ? "Ask the DM again"
                  : "Ask for the DM's blessing"}
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
                {review.approved ? "The DM approves." : "The DM does not approve."}
              </p>
              <p className="mt-1 text-text">{review.verdict}</p>

              {review.approved ? (
                <div className="mt-3 space-y-1 text-text">
                  {review.bonuses.items.length > 0 ? (
                    <p>
                      <span className="text-text-dim">Items: </span>
                      {review.bonuses.items.join(", ")}
                    </p>
                  ) : null}
                  {review.bonuses.statBonus ? (
                    <p>
                      <span className="text-text-dim">Stat bonus: </span>+
                      {review.bonuses.statBonus.amount}{" "}
                      {STAT_LABEL[review.bonuses.statBonus.stat]}
                    </p>
                  ) : null}
                  {review.bonuses.goldBonus && review.bonuses.goldBonus > 0 ? (
                    <p>
                      <span className="text-text-dim">Gold: </span>+{review.bonuses.goldBonus}
                    </p>
                  ) : null}
                  {review.bonuses.flavorTrait ? (
                    <p>
                      <span className="text-text-dim">Trait: </span>
                      {review.bonuses.flavorTrait}
                    </p>
                  ) : null}
                  {review.bonuses.items.length === 0 &&
                  !review.bonuses.statBonus &&
                  !review.bonuses.goldBonus &&
                  !review.bonuses.flavorTrait ? (
                    <p className="text-text-dim">No mechanical bonus, just narrative flavor.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <AvatarPreview
            image={avatar}
            rolling={avatarRolling}
            onReroll={rerollAvatar}
          />

          <Button
            onClick={handleStart}
            disabled={loading || reviewing || avatarRolling || !canStart}
            className="w-full"
          >
            {loading
              ? "Preparing the adventure..."
              : !canStart
                ? "Get the DM's approval first"
                : "Start the adventure"}
          </Button>

          {error ? <p className="text-base text-hp">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
