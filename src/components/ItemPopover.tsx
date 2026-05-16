"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GeneratedImage, InventoryItem, ItemRarity } from "@/lib/game/types";

interface ItemPopoverProps {
  item: InventoryItem;
  anchorEl: HTMLElement | null;
  open: boolean;
}

// Module-level client cache so re-hovers in the same session are instant.
const clientImageCache = new Map<string, GeneratedImage>();

function proxyUrl(rawUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
}

const RARITY_BORDER: Record<ItemRarity, string> = {
  common: "border-text-dim",
  uncommon: "border-xp",
  rare: "border-gem-blue",
  epic: "border-gem-purple",
  legendary: "border-gold",
};

const RARITY_TEXT: Record<ItemRarity, string> = {
  common: "text-text-dim",
  uncommon: "text-xp",
  rare: "text-gem-blue",
  epic: "text-gem-purple",
  legendary: "text-gold",
};

function cacheKey(item: InventoryItem): string {
  return `${item.name.trim().toLowerCase()}:${item.rarity}`;
}

export function ItemPopover({ item, anchorEl, open }: ItemPopoverProps) {
  const [image, setImage] = useState<GeneratedImage | null>(() =>
    clientImageCache.get(cacheKey(item)) ?? null,
  );
  const [error, setError] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const inflightRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    if (image || inflightRef.current) return;

    const cached = clientImageCache.get(cacheKey(item));
    if (cached) {
      setImage(cached);
      return;
    }

    inflightRef.current = true;
    fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "item",
        itemName: item.name,
        rarity: item.rarity,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Image fetch failed.");
        const data = (await res.json()) as GeneratedImage;
        clientImageCache.set(cacheKey(item), data);
        setImage(data);
      })
      .catch(() => setError(true))
      .finally(() => {
        inflightRef.current = false;
      });
  }, [open, item, image]);

  useEffect(() => {
    if (!open || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 180;
    const popoverHeight = 220;
    // Prefer above the anchor; fall back to below if not enough space.
    const fitsAbove = rect.top >= popoverHeight + 12;
    const top = fitsAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8;
    const left = Math.max(
      8,
      Math.min(window.innerWidth - popoverWidth - 8, rect.left + rect.width / 2 - popoverWidth / 2),
    );
    setCoords({ top, left });
  }, [open, anchorEl]);

  if (!mounted || !open || !coords) return null;

  const popover = (
    <div
      role="tooltip"
      className={`fixed z-50 w-[180px] border-4 ${RARITY_BORDER[item.rarity]} bg-bg p-2 shadow-[4px_4px_0_rgba(0,0,0,0.8)]`}
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="relative h-32 w-full border-2 border-text-dim bg-bg flex items-center justify-center overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyUrl(image.url)}
            alt={item.name}
            width={128}
            height={128}
            className="h-32 w-32 object-cover"
            style={{ imageRendering: "pixelated" }}
            onError={() => setError(true)}
          />
        ) : error ? (
          <span className="text-3xl text-text-dim" aria-hidden>?</span>
        ) : (
          <div className="dice-shaking text-3xl text-torch" aria-hidden>🎲</div>
        )}
      </div>
      <p className="mt-2 font-display text-[9px] tracking-wider text-text text-center break-words">
        {item.name.toUpperCase()}
      </p>
      <p className={`mt-1 font-display text-[8px] tracking-wider text-center ${RARITY_TEXT[item.rarity]}`}>
        {item.rarity.toUpperCase()}
      </p>
    </div>
  );

  return createPortal(popover, document.body);
}
