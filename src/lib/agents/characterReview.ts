import { z } from "zod";
import { getAnthropicClient, getAnthropicModel } from "@/lib/agentClient";
import { characterReviewSystemPrompt } from "@/lib/prompts/characterReviewPrompt";
import {
  CharacterReviewResult,
  PlayerBonuses,
  PlayerClass,
  StatKey,
} from "@/lib/game/types";

const STAT_KEYS: readonly StatKey[] = ["str", "dex", "int", "cha"];

const reviewResponseSchema = z.object({
  approved: z.boolean(),
  verdict: z.string().max(400),
  bonuses: z
    .object({
      items: z.array(z.string()).default([]),
      statBonus: z
        .union([
          z.object({
            stat: z.enum(["str", "dex", "int", "cha"]),
            amount: z.number(),
          }),
          z.null(),
        ])
        .nullable()
        .optional(),
      goldBonus: z.number().optional(),
      flavorTrait: z.string().optional(),
    })
    .default({ items: [] }),
});

export function clampBonuses(raw: PlayerBonuses, _playerClass: PlayerClass): PlayerBonuses {
  void _playerClass;
  const items = (raw.items ?? [])
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 30)
    .slice(0, 2);

  let statBonus: PlayerBonuses["statBonus"];
  if (raw.statBonus && STAT_KEYS.includes(raw.statBonus.stat)) {
    const amount = Math.max(0, Math.min(1, Math.floor(raw.statBonus.amount ?? 0)));
    if (amount > 0) {
      statBonus = { stat: raw.statBonus.stat, amount };
    }
  }

  const goldBonus = Math.max(0, Math.min(5, Math.floor(raw.goldBonus ?? 0)));

  const flavorTrait =
    typeof raw.flavorTrait === "string"
      ? raw.flavorTrait.trim().slice(0, 80) || undefined
      : undefined;

  return { items, statBonus, goldBonus, flavorTrait };
}

interface ReviewInput {
  playerName: string;
  playerClass: PlayerClass;
  backstory: string;
}

export async function reviewCharacterBackstory(
  input: ReviewInput,
): Promise<CharacterReviewResult> {
  const trimmed = input.backstory.trim();

  if (trimmed.length < 15) {
    return {
      approved: false,
      verdict:
        "The backstory is too short. Add a few details about origin, motivation, and one defining trait.",
      bonuses: { items: [] },
    };
  }

  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const payload = {
    playerName: input.playerName,
    playerClass: input.playerClass,
    backstory: trimmed,
  };

  const response = await client.messages.create({
    model,
    max_tokens: 320,
    system: characterReviewSystemPrompt,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("\n")
    .trim();

  // Tolerate accidental ```json fences or surrounding prose
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fenced ? fenced[1] : rawText;
  const braceStart = candidate.indexOf("{");
  const braceEnd = candidate.lastIndexOf("}");
  const text =
    braceStart >= 0 && braceEnd > braceStart
      ? candidate.slice(braceStart, braceEnd + 1)
      : candidate;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return {
      approved: false,
      verdict:
        "The DM hesitated. Rewrite the backstory with a few clear details about your hero.",
      bonuses: { items: [] },
    };
  }

  const parsed = reviewResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      approved: false,
      verdict:
        "The DM could not interpret the backstory. Try again with a clearer description.",
      bonuses: { items: [] },
    };
  }

  const rawBonuses: PlayerBonuses = {
    items: parsed.data.bonuses.items ?? [],
    statBonus: parsed.data.bonuses.statBonus ?? undefined,
    goldBonus: parsed.data.bonuses.goldBonus,
    flavorTrait: parsed.data.bonuses.flavorTrait,
  };

  const clamped = parsed.data.approved
    ? clampBonuses(rawBonuses, input.playerClass)
    : { items: [] };

  return {
    approved: parsed.data.approved,
    verdict: parsed.data.verdict,
    bonuses: clamped,
  };
}
