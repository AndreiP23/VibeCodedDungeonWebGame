import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { GameState } from "@/lib/game/types";

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
          <CardTitle className="text-lg">{state.player.name}</CardTitle>
          <p className="text-sm capitalize text-muted-foreground">{state.player.class}</p>
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
        </CardContent>
      </Card>

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
    </div>
  );
}
