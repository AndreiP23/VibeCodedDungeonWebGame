"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "@/components/ChatMessage";
import { DiceRoll } from "@/components/DiceRoll";
import { DiceTray } from "@/components/DiceTray";
import { EndStateOverlay } from "@/components/EndStateOverlay";
import { StatsSidebar } from "@/components/StatsSidebar";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/gameStore";

export default function GamePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);

  const {
    sessionId,
    gameState,
    chat,
    latestRolls,
    loading,
    error,
    pendingRoll,
    playTurn,
    initGame,
    playerClass,
    playerName,
    reset,
  } = useGameStore();

  useEffect(() => {
    if (!chatRef.current || !autoScroll) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat, autoScroll]);

  useEffect(() => {
    if (gameState) return;
    const incomingSession =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("sessionId")
        : null;
    if (incomingSession) {
      void initGame(playerName || "Hero", playerClass, { sessionId: incomingSession });
      return;
    }
    router.replace("/character");
  }, [gameState, initGame, playerClass, playerName, router]);

  function handleScroll() {
    if (!chatRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = chatRef.current;
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    setAutoScroll(nearBottom);
  }

  function jumpToLatest() {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
    setAutoScroll(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    const currentMessage = message;
    setMessage("");
    await playTurn(currentMessage);
  }

  if (!gameState) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="font-display text-xs text-torch animate-pulse">LOADING...</p>
      </main>
    );
  }

  const isDead = gameState.player.hp.current <= 0;
  const mainQuestDone = gameState.world.activeQuests.some(
    (quest) => quest.id === "find-mayor-daughter" && quest.status === "completed",
  );
  const endState: "death" | "victory" | null = isDead
    ? "death"
    : mainQuestDone
      ? "victory"
      : null;

  function handlePlayAgain() {
    reset();
    router.push("/character");
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b-4 border-torch bg-bg">
        <h1 className="font-display text-sm text-torch">
          SESSION #{sessionId?.slice(0, 8).toUpperCase()}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            router.push("/character");
          }}
        >
          New Game
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <section className="flex-1 flex flex-col overflow-hidden border-r-4 border-torch relative">
          <div
            ref={chatRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
          >
            {chat.map((entry) => (
              <ChatMessage key={entry.id} role={entry.role} content={entry.content} />
            ))}
            {latestRolls.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {latestRolls.map((roll, index) => (
                  <DiceRoll key={`${roll.checkType}-${roll.total}-${index}`} roll={roll} />
                ))}
              </div>
            ) : null}
            {loading ? (
              <p className="font-display text-[10px] tracking-wider text-text-dim animate-pulse">
                DUNGEON MASTER IS THINKING...
              </p>
            ) : null}
          </div>

          {!autoScroll ? (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute right-4 bottom-44 border-2 border-torch bg-bg text-torch px-3 py-1 font-display text-[10px] shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
            >
              ↓ LATEST
            </button>
          ) : null}

          <DiceTray />

          {pendingRoll ? (
            <p className="px-4 py-1 font-display text-[9px] text-text-dim text-center">
              Roll the die above to continue.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="shrink-0 flex gap-2 p-3 border-t-4 border-torch bg-bg">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                endState
                  ? "The adventure is over"
                  : pendingRoll
                    ? "Roll the requested die..."
                    : "What do you do?"
              }
              className="flex-1 h-11 border-4 border-text-dim bg-bg text-text text-lg px-3 focus:border-torch focus:outline-none"
              disabled={loading || endState !== null || pendingRoll !== null}
            />
            <Button
              type="submit"
              disabled={loading || endState !== null || pendingRoll !== null || !message.trim()}
            >
              {loading ? "..." : "Send"}
            </Button>
          </form>

          {error ? (
            <p className="px-4 py-2 text-sm text-hp border-t-2 border-hp">{error}</p>
          ) : null}
        </section>

        <aside className="w-[320px] shrink-0 overflow-y-auto p-3 bg-bg">
          <StatsSidebar state={gameState} />
        </aside>
      </div>

      {endState ? (
        <EndStateOverlay
          variant={endState}
          playerName={gameState.player.name}
          onPlayAgain={handlePlayAgain}
        />
      ) : null}
    </main>
  );
}
