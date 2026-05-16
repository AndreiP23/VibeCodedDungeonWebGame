"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GeneratedImage } from "@/lib/game/types";

interface AvatarPreviewProps {
  image: GeneratedImage | null;
  rolling: boolean;
  onReroll: () => void;
}

export function AvatarPreview({ image, rolling, onReroll }: AvatarPreviewProps) {
  const buttonLabel = image ? "🎲 Re-roll Avatar" : "🎲 Generate Avatar";

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset load state whenever a new image URL arrives.
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [image?.url]);

  const showImg = !!image && !rolling;
  // Show the "rendering" overlay while the agent is rolling OR while pollinations
  // is still generating the image after the URL was returned.
  const showSpinner = rolling || (showImg && !imgLoaded && !imgError);
  const showEmpty = !image && !rolling;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-64 w-64 border-4 border-torch bg-bg shadow-[4px_4px_0_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt="Hero portrait"
            width={256}
            height={256}
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`h-64 w-64 object-cover transition-opacity duration-300 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            style={{ imageRendering: "pixelated" }}
          />
        ) : null}

        {showSpinner ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/80">
            <div className="text-4xl animate-pulse" aria-hidden>🔥</div>
            <p className="font-display text-[10px] tracking-wider text-torch animate-pulse">
              {rolling ? "FORGING PORTRAIT..." : "RENDERING..."}
            </p>
          </div>
        ) : null}

        {imgError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/90">
            <p className="font-display text-[9px] tracking-wider text-hp text-center px-4">
              IMAGE FAILED.<br />RE-ROLL TO RETRY.
            </p>
          </div>
        ) : null}

        {showEmpty ? (
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
