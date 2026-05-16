"use client";

import { Button } from "@/components/ui/button";
import { GeneratedImage } from "@/lib/game/types";

interface AvatarPreviewProps {
  image: GeneratedImage | null;
  rolling: boolean;
  onReroll: () => void;
}

export function AvatarPreview({ image, rolling, onReroll }: AvatarPreviewProps) {
  const buttonLabel = image ? "🎲 Re-roll Avatar" : "🎲 Generate Avatar";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-64 w-64 border-4 border-torch bg-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
        {image && !rolling ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt="Hero portrait"
            width={256}
            height={256}
            className="h-64 w-64 object-cover"
            style={{ imageRendering: "pixelated" }}
          />
        ) : null}

        {rolling ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/80">
            <div className="text-4xl animate-pulse" aria-hidden>🔥</div>
            <p className="font-display text-[10px] tracking-wider text-torch animate-pulse">
              FORGING PORTRAIT...
            </p>
          </div>
        ) : null}

        {!image && !rolling ? (
          <p className="font-display text-[9px] tracking-wider text-text-dim text-center px-4">
            NO PORTRAIT YET.<br />CLICK BELOW.
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={onReroll}
        disabled={rolling}
      >
        {rolling ? "..." : buttonLabel}
      </Button>
    </div>
  );
}
