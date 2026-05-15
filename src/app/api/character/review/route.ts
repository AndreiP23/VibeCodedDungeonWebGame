import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reviewCharacterBackstory } from "@/lib/agents/characterReview";

const requestSchema = z.object({
  playerName: z.string().min(1).max(40).default("Erou"),
  playerClass: z.enum(["warrior", "mage", "rogue"]),
  backstory: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const review = await reviewCharacterBackstory(parsed.data);
    return NextResponse.json(review);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error while reviewing character.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
