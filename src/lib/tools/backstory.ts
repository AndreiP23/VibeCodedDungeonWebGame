import { PlayerClass } from "@/lib/game/types";

const TEMPLATES: Record<PlayerClass, string[]> = {
  warrior: [
    "A veteran of the northern wars, bearing the scars of a lost battle and seeking a path to redemption in forgotten lands.",
    "Raised in a village of blacksmiths, learned the sword before letters. Their father, a guardian of the mayor, vanished two years ago without a trace.",
    "A former mercenary from a disbanded company, carrying their armor as their only inheritance and drinking to drown dreams of nameless faces.",
    "Daughter of a captain, stripped of her family's rank after her brother's betrayal. She seeks to prove that honor is not hereditary.",
  ],
  mage: [
    "Once an apprentice at the Ashen Academy, exiled after reading a forbidden tome. Magic still burns them each time they use it too much.",
    "Raised in the forest by an old witch, only now descending to humans and discovering that their world runs on strange rules.",
    "Has been studying the region's mysterious disappearances for months. Believes the magical threads here converge on something hidden underground.",
    "An arcane cartographer searching for a lost ritual. Received an anonymous letter about Broken Crown and could not refuse.",
  ],
  rogue: [
    "Raised in the slums of the port city, learned to survive on clever theft and false smiles. Now works for themselves.",
    "A former guild spy who escaped after a failed mission. Their real name is a legend — no one remembers it, not even them.",
    "An improvised bounty hunter who heard about the mayor's daughter and the sum promised for any useful information.",
    "A thief with her own code: never steal from the desperate. She came to town after recognizing an old crest above the tavern gate.",
  ],
};

export function buildRandomBackstory(playerClass: PlayerClass): string {
  const pool = TEMPLATES[playerClass];
  return pool[Math.floor(Math.random() * pool.length)];
}
