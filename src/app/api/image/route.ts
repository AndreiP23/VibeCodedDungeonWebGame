import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateImage } from "@/lib/agents/imagePrompt";
import { imageCache } from "@/lib/tools/imageCache";

const avatarSchema = z.object({
  kind: z.literal("avatar"),
  playerClass: z.enum(["warrior", "mage", "rogue"]),
  backstory: z.string().max(2000).optional(),
  nameHint: z.string().max(40).optional(),
});

const itemSchema = z.object({
  kind: z.literal("item"),
  itemName: z.string().min(1).max(60),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
});

const bodySchema = z.union([avatarSchema, itemSchema]);

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    if (input.kind === "item") {
      const key = imageCache.buildItemKey(input.itemName, input.rarity);
      const hit = await imageCache.get(key);
      if (hit) {
        return NextResponse.json(hit);
      }
      const result = await generateImage(input);
      await imageCache.set(key, result);
      return NextResponse.json(result);
    }

    const result = await generateImage(input);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error in /api/image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
