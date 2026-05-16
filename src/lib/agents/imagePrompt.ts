import { getAnthropicClient, getAnthropicModel } from "@/lib/agentClient";
import {
  GeneratedImage,
  ItemRarity,
  PlayerClass,
} from "@/lib/game/types";
import { imagePromptAgentSystemPrompt } from "@/lib/prompts/imagePromptAgent";
import { buildAvatarSpec } from "@/lib/tools/avatar";

export type ImagePromptInput =
  | {
      kind: "avatar";
      playerClass: PlayerClass;
      backstory?: string;
      nameHint?: string;
    }
  | {
      kind: "item";
      itemName: string;
      rarity: ItemRarity;
    };

function sanitizePrompt(input: string): string {
  return input
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function buildPollinationsUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=256&height=256&nologo=true&seed=${seed}`;
}

function templateFallback(input: ImagePromptInput, seed: number): GeneratedImage {
  if (input.kind === "avatar") {
    const spec = buildAvatarSpec(input.playerClass, input.backstory);
    return { prompt: spec.prompt, seed: spec.seed, url: spec.url };
  }
  const rarity = input.rarity;
  const subject = `${rarity} ${input.itemName}`;
  const adjectives: Record<ItemRarity, string> = {
    common: "plain well-used",
    uncommon: "polished with subtle ornamentation",
    rare: "finely crafted with faint glow",
    epic: "elaborately detailed with magical aura",
    legendary: "ornate with strong golden glow",
  };
  const prompt = sanitizePrompt(
    `${subject}, ${adjectives[rarity]}, 8-bit pixel art sprite, NES JRPG style, 16-color palette, sharp pixel edges, plain dark background, centered composition, no text`,
  );
  return { prompt, seed, url: buildPollinationsUrl(prompt, seed) };
}

export async function generateImage(input: ImagePromptInput): Promise<GeneratedImage> {
  const seed = Math.floor(Math.random() * 1_000_000);

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    // No API key — fall back to template.
    return templateFallback(input, seed);
  }
  const model = getAnthropicModel();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 200,
      system: imagePromptAgentSystemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    if (!text) {
      return templateFallback(input, seed);
    }

    const prompt = sanitizePrompt(text);
    return { prompt, seed, url: buildPollinationsUrl(prompt, seed) };
  } catch (error) {
    console.warn("[imagePrompt] LLM call failed; using template fallback", error);
    return templateFallback(input, seed);
  }
}
