"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerClass } from "@/lib/game/types";
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

export default function CharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("Arin");
  const [playerClass, setPlayerClass] = useState<PlayerClass>("warrior");
  const initGame = useGameStore((state) => state.initGame);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);

  async function handleStart() {
    await initGame(name.trim() || "Erou", playerClass);
    router.push("/game");
  }

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
              onChange={(event) => setName(event.target.value)}
              placeholder="Numele eroului"
              className="border-zinc-700 bg-zinc-950"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {classOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => setPlayerClass(option.value)}
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

          <Button onClick={handleStart} disabled={loading} className="w-full">
            {loading ? "Se pregateste aventura..." : "Incepe aventura"}
          </Button>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
