"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { GameState } from "@/lib/game/types";

function Avatar({ url, name }: { url: string; name: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [url]);

  return (
    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
      {status !== "error" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Portret ${name}`}
          width={56}
          height={56}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className={`h-14 w-14 object-cover transition-opacity duration-500 ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
          <span className="animate-pulse">…</span>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center text-lg" aria-hidden>
          🛡️
        </div>
      ) : null}
    </div>
  );
}

interface StatsSidebarProps {
  state: GameState;
}

export function StatsSidebar({ state }: StatsSidebarProps) {
  const hpPercent =
    state.player.hp.max > 0
      ? Math.round((state.player.hp.current / state.player.hp.max) * 100)
      : 0;
  const activeQuest = state.world.activeQuests.find((quest) => quest.status === "active");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {state.player.avatarUrl ? (
              <Avatar url={state.player.avatarUrl} name={state.player.name} />
            ) : null}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">{state.player.name}</CardTitle>
              <p className="text-sm capitalize text-muted-foreground">{state.player.class}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">HP</p>
            <Progress value={hpPercent} />
            <p className="text-xs text-muted-foreground">
              {state.player.hp.current}/{state.player.hp.max}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>STR: {state.player.stats.str}</p>
            <p>DEX: {state.player.stats.dex}</p>
            <p>INT: {state.player.stats.int}</p>
            <p>CHA: {state.player.stats.cha}</p>
          </div>
          <p className="text-sm font-medium">Aur: {state.player.gold}</p>
          <p className="text-sm">Locatie: {state.player.location}</p>
          {state.player.flavorTrait ? (
            <p className="text-xs italic text-muted-foreground">
              {state.player.flavorTrait}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {state.player.backstory ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Poveste</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
              {state.player.backstory}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Inventar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {state.player.inventory.map((item) => (
            <Badge variant="secondary" key={item}>
              {item}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quest Activ</CardTitle>
        </CardHeader>
        <CardContent>
          {activeQuest ? (
            <div className="space-y-2">
              <p className="font-medium">{activeQuest.title}</p>
              <p className="text-sm text-muted-foreground">{activeQuest.description}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nu ai quest-uri active.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quest-uri terminate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.world.activeQuests.filter((quest) => quest.status === "completed").length === 0 ? (
            <p className="text-sm text-muted-foreground">Nimic încă.</p>
          ) : (
            state.world.activeQuests
              .filter((quest) => quest.status === "completed")
              .map((quest) => (
                <div key={quest.id} className="flex items-center gap-2">
                  <Badge variant="success">✓</Badge>
                  <p className="text-sm">{quest.title}</p>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
