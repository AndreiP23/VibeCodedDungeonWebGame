import { PlayerClass } from "@/lib/game/types";

const CLASS_APPEARANCE: Record<PlayerClass, { base: string; details: string[] }> = {
  warrior: {
    base: "stoic human warrior, plate armor pauldrons, weathered face, fantasy hero",
    details: [
      "long braided hair, dark eyes",
      "shaved head, deep scar across one cheek",
      "auburn beard, steel circlet",
      "raven black hair, pale skin, sharp jaw",
      "tan skin, golden eyes, chipped tooth",
      "white-blond ponytail, blue war paint",
    ],
  },
  mage: {
    base: "arcane mage, deep hooded robe, glowing rune trinket, mystical aura",
    details: [
      "silver hair, violet eyes, slender features",
      "young face, freckles, ink-stained fingers",
      "long white beard, kind eyes, brass spectacles",
      "shaved head, black tattoos along temples",
      "raven black hair, amber eyes, pale skin",
      "auburn curls, green eyes, faint smile",
    ],
  },
  rogue: {
    base: "agile rogue, dark leather hood, sly grin, twin daggers at belt",
    details: [
      "short black hair, sharp green eyes, dimple scar",
      "messy auburn hair, freckles, golden earring",
      "platinum braid, ice blue eyes, lean face",
      "olive skin, hazel eyes, raised eyebrow",
      "shaved sides, dark mohawk, kohl around eyes",
      "long copper hair, smirk, scar across nose",
    ],
  },
};

const STYLE_SUFFIX =
  "8-bit pixel art sprite, NES JRPG style, 16-color palette, " +
  "sharp pixel edges, head and shoulders, plain dark background, centered composition, no text";

function sanitizeBackstory(input: string): string {
  return input
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\p{L}\p{N}\s,.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export interface AvatarSpec {
  prompt: string;
  seed: number;
  url: string;
}

export function buildAvatarSpec(
  playerClass: PlayerClass,
  backstory?: string,
): AvatarSpec {
  const cfg = CLASS_APPEARANCE[playerClass];
  const detail = cfg.details[Math.floor(Math.random() * cfg.details.length)];
  const cue = backstory ? sanitizeBackstory(backstory) : "";
  const cueFragment = cue ? `, narrative cues: ${cue}` : "";

  const prompt = `${cfg.base}, ${detail}${cueFragment}, ${STYLE_SUFFIX}`;
  const seed = Math.floor(Math.random() * 1_000_000);
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=256&height=256&nologo=true&seed=${seed}`;

  return { prompt, seed, url };
}
