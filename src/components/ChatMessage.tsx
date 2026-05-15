import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ChatMessageProps {
  role: "player" | "dm" | "npc";
  content: string;
}

const roleLabel: Record<ChatMessageProps["role"], string> = {
  player: "Jucator",
  dm: "Dungeon Master",
  npc: "NPC",
};

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isPlayer = role === "player";

  return (
    <div className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}>
      <Card
        className={`max-w-[90%] border ${
          role === "dm"
            ? "border-amber-300 bg-amber-50"
            : role === "npc"
              ? "border-sky-300 bg-sky-50"
              : "border-zinc-300 bg-zinc-900 text-zinc-100"
        }`}
      >
        <CardContent className="space-y-2 p-3">
          <Badge variant={isPlayer ? "secondary" : "default"}>{roleLabel[role]}</Badge>
          <p
            className={
              role === "dm"
                ? "italic text-amber-900"
                : role === "npc"
                  ? "text-sky-900"
                  : ""
            }
          >
            {content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
