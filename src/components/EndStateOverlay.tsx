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
    accent: "border-rose-500",
  },
  victory: {
    title: "Victorie!",
    icon: "🏆",
    body: "Fiica primarului e in siguranta, iar numele tau se va auzi din taverna pana la portile orasului. Aventura ta s-a incheiat cu glorie.",
    cta: "Joaca din nou",
    accent: "border-torch",
  },
} as const;

export function EndStateOverlay({ variant, playerName, onPlayAgain }: EndStateOverlayProps) {
  const content = CONTENT[variant];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm p-6">
      <div
        className={`border-4 bg-bg p-8 shadow-[4px_4px_0_rgba(0,0,0,0.8)] max-w-md w-full text-center ${content.accent}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 text-5xl" aria-hidden>
          {content.icon}
        </div>
        <h2
          className="font-display text-2xl text-torch mb-4"
          style={{
            textShadow:
              "0 0 20px rgba(255,157,0,0.6), 0 0 40px rgba(255,157,0,0.3), 4px 4px 0 rgba(0,0,0,0.8)",
          }}
        >
          {content.title}
        </h2>
        <p className="mt-2 text-sm text-text-dim">{playerName}</p>
        <p className="mt-4 text-text-dim text-lg leading-relaxed">{content.body}</p>
        <Button onClick={onPlayAgain} className="mt-6 w-full">
          {content.cta}
        </Button>
      </div>
    </div>
  );
}
