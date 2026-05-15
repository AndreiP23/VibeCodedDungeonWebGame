"use client";

import { Button } from "@/components/ui/button";

interface EndStateOverlayProps {
  variant: "death" | "victory";
  playerName: string;
  onPlayAgain: () => void;
}

const CONTENT = {
  death: {
    title: "Ai cazut.",
    icon: "💀",
    body: "Drumul tau se opreste aici, dar legenda ramane in soaptele tavernei. Misterul fiicei primarului asteapta un alt erou.",
    cta: "Incepe o noua aventura",
    accent: "border-rose-500/50 bg-rose-950/40",
  },
  victory: {
    title: "Victorie!",
    icon: "🏆",
    body: "Fiica primarului e in siguranta, iar numele tau se va auzi din taverna pana la portile orasului. Aventura ta s-a incheiat cu glorie.",
    cta: "Joaca din nou",
    accent: "border-amber-500/50 bg-amber-950/40",
  },
} as const;

export function EndStateOverlay({ variant, playerName, onPlayAgain }: EndStateOverlayProps) {
  const content = CONTENT[variant];

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/85 p-6 backdrop-blur-sm">
      <div
        className={`max-w-md rounded-xl border p-6 text-center text-zinc-100 shadow-xl ${content.accent}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 text-5xl" aria-hidden>
          {content.icon}
        </div>
        <h2 className="font-serif text-3xl font-semibold">{content.title}</h2>
        <p className="mt-2 text-sm text-zinc-300">{playerName}</p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-200">{content.body}</p>
        <Button onClick={onPlayAgain} className="mt-6 w-full">
          {content.cta}
        </Button>
      </div>
    </div>
  );
}
