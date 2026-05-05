"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "@/components/ChatMessage";
import { DiceRoll } from "@/components/DiceRoll";
import { StatsSidebar } from "@/components/StatsSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGameStore } from "@/store/gameStore";

export default function GamePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const {
    sessionId,
    gameState,
    chat,
    latestRolls,
    loading,
    error,
    playTurn,
    initGame,
    playerClass,
    playerName,
  } = useGameStore();

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (gameState) {
      return;
    }

    const incomingSession =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("sessionId")
        : null;

    if (incomingSession) {
      void initGame(playerName || "Erou", playerClass, incomingSession);
      return;
    }

    router.replace("/character");
  }, [gameState, initGame, playerClass, playerName, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    const currentMessage = message;
    setMessage("");
    await playTurn(currentMessage);
  }

  if (!gameState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <p>Se incarca aventura...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-3 py-4 text-zinc-100 md:px-5 md:py-6">
      <div className="mx-auto grid h-[calc(100vh-2rem)] max-w-7xl gap-4 md:grid-cols-[7fr_3fr]">
        <Card className="flex h-full flex-col border-zinc-700 bg-zinc-900/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl">Sesiune #{sessionId?.slice(0, 8)}</CardTitle>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <ScrollArea className="min-h-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950/60 p-3">
              <div className="space-y-3">
                {chat.map((entry) => (
                  <ChatMessage key={entry.id} role={entry.role} content={entry.content} />
                ))}
                <div ref={chatBottomRef} />
              </div>
            </ScrollArea>

            {loading ? (
              <p className="text-xs italic text-zinc-400">
                Dungeon Master gândește<span className="animate-pulse">...</span>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {latestRolls.map((roll, index) => (
                <DiceRoll key={`${roll.checkType}-${roll.total}-${index}`} roll={roll} />
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ce faci?"
                className="h-11 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !message.trim()}>
                {loading ? "Se joaca..." : "Trimite"}
              </Button>
            </form>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </CardContent>
        </Card>

        <aside className="h-full overflow-y-auto">
          <StatsSidebar state={gameState} />
        </aside>
      </div>
    </main>
  );
}
