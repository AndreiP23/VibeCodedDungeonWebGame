"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { GameState, InventoryItem, ItemRarity } from "@/lib/game/types";

const RARITY_VARIANT: Record<ItemRarity, "secondary" | "success" | "gem-blue" | "gem-purple" | "gold"> = {
  common: "secondary",
  uncommon: "success",
  rare: "gem-blue",
  epic: "gem-purple",
  legendary: "gold",
};

function toItem(entry: unknown): InventoryItem {
  if (typeof entry === "string") return { name: entry, rarity: "common" };
  const obj = entry as { name?: unknown; rarity?: unknown };
  const name = typeof obj?.name === "string" ? obj.name : String(entry ?? "");
  const validRarities: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
  const rarity = validRarities.includes(obj?.rarity as ItemRarity)
    ? (obj.rarity as ItemRarity)
    : "common";
  return { name, rarity };
}

function Avatar({ url, name }: { url: string; name: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [url]);

  return (
    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden border-2 border-torch bg-bg">
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
        <div className="absolute inset-0 flex items-center justify-center text-xs text-text-dim">
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

function SidebarPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-4 border-torch bg-bg p-3 shadow-[4px_4px_0_rgba(0,0,0,0.8)]">
      <h2 className="font-display text-[10px] uppercase tracking-wider text-torch mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function StatsSidebar({ state }: StatsSidebarProps) {
  const hpPercent =
    state.player.hp.max > 0
      ? Math.max(0, Math.min(100, Math.round((state.player.hp.current / state.player.hp.max) * 100)))
      : 0;
  const activeQuest = state.world.activeQuests.find((quest) => quest.status === "active");
  const completedQuests = state.world.activeQuests.filter((quest) => quest.status === "completed");

  return (
    <div className="space-y-3">
      <SidebarPanel title={state.player.name}>
        <div className="flex items-center gap-3 mb-3">
          {state.player.avatarUrl ? (
            <Avatar url={state.player.avatarUrl} name={state.player.name} />
          ) : null}
          <p className="text-text-dim text-xl capitalize">{state.player.class}</p>
        </div>

        <div className="mb-3">
          <p className="font-display text-[9px] uppercase tracking-wider text-hp mb-1">HP</p>
          <div className="relative h-4 w-full border-2 border-hp bg-bg overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-hp transition-all duration-300"
              style={{ width: `${hpPercent}%`, boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)" }}
            />
          </div>
          <p className="text-text-dim text-base mt-1">
            {state.player.hp.current}/{state.player.hp.max}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 text-lg text-text">
          <p>STR: {state.player.stats.str}</p>
          <p>DEX: {state.player.stats.dex}</p>
          <p>INT: {state.player.stats.int}</p>
          <p>CHA: {state.player.stats.cha}</p>
        </div>

        <p className="mt-3 text-lg text-gold">⛁ Gold: {state.player.gold}</p>
        <p className="text-lg text-text-dim">📍 {state.player.location}</p>

        {state.player.flavorTrait ? (
          <p className="mt-2 text-base italic text-text-dim">{state.player.flavorTrait}</p>
        ) : null}
      </SidebarPanel>

      {state.player.backstory ? (
        <SidebarPanel title="Backstory">
          <p className="whitespace-pre-line text-base leading-relaxed text-text-dim">
            {state.player.backstory}
          </p>
        </SidebarPanel>
      ) : null}

      <SidebarPanel title="Inventory">
        {state.player.inventory.length === 0 ? (
          <p className="text-text-dim text-base">Empty</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {state.player.inventory.map((entry, idx) => {
              const item = toItem(entry);
              return (
                <Badge
                  variant={RARITY_VARIANT[item.rarity]}
                  key={`${item.name}-${idx}`}
                  className="justify-center"
                  title={item.rarity}
                >
                  {item.name}
                </Badge>
              );
            })}
          </div>
        )}
      </SidebarPanel>

      <SidebarPanel title="Active Quest">
        {activeQuest ? (
          <div className="space-y-1">
            <p className="text-torch text-lg">{activeQuest.title}</p>
            <p className="text-text-dim text-base">{activeQuest.description}</p>
          </div>
        ) : (
          <p className="text-text-dim text-base">No active quests.</p>
        )}
      </SidebarPanel>

      <SidebarPanel title="Completed">
        {completedQuests.length === 0 ? (
          <p className="text-text-dim text-base">Nothing yet.</p>
        ) : (
          <div className="space-y-2">
            {completedQuests.map((quest) => (
              <div key={quest.id} className="flex items-center gap-2">
                <Badge variant="success">✓</Badge>
                <p className="text-lg text-gold">{quest.title}</p>
              </div>
            ))}
          </div>
        )}
      </SidebarPanel>

      <section className="border-4 border-dashed border-gem-purple/60 bg-bg p-3 opacity-80 hover:opacity-100 transition-opacity">
        <h2 className="font-display text-[10px] uppercase tracking-wider text-gem-purple mb-2 animate-pulse">
          🤝 Multiplayer
        </h2>
        <p className="text-base text-text-dim leading-snug">
          Co-op parties of up to 4 heroes —{" "}
          <span className="text-gem-purple font-medium">coming soon</span>.
        </p>
      </section>
    </div>
  );
}
