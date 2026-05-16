interface ChatMessageProps {
  role: "player" | "dm" | "npc" | "system";
  content: string;
  npcName?: string;
}

const roleLabel: Record<ChatMessageProps["role"], string> = {
  player: "Tu",
  dm: "Dungeon Master",
  npc: "NPC",
  system: "Sistem",
};

const roleClasses: Record<ChatMessageProps["role"], { wrap: string; label: string; text: string }> = {
  player: {
    wrap: "border-torch bg-bg",
    label: "text-torch",
    text: "text-text",
  },
  dm: {
    wrap: "border-text-dim bg-bg",
    label: "text-text-dim",
    text: "text-text italic",
  },
  npc: {
    wrap: "border-gem-purple bg-bg",
    label: "text-gem-purple",
    text: "text-text",
  },
  system: {
    wrap: "border-gem-green bg-bg",
    label: "text-gem-green",
    text: "text-text",
  },
};

export function ChatMessage({ role, content, npcName }: ChatMessageProps) {
  const isPlayer = role === "player";
  const styles = roleClasses[role];
  const label = role === "npc" && npcName ? npcName.toUpperCase() : roleLabel[role].toUpperCase();

  return (
    <div className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] border-4 ${styles.wrap} p-3 shadow-[4px_4px_0_rgba(0,0,0,0.8)]`}
      >
        <p className={`font-display text-[10px] tracking-wider mb-2 ${styles.label}`}>{label}</p>
        <p className={`text-lg leading-snug ${styles.text}`}>{content}</p>
      </div>
    </div>
  );
}
