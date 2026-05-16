import { promises as fs } from "fs";
import path from "path";
import { GeneratedImage, ItemRarity } from "@/lib/game/types";

const CACHE_PATH = path.join(process.cwd(), "data", "image-cache.json");

const useMemoryStore = !!process.env.VERCEL;

const memoryStore = new Map<string, GeneratedImage>();

type StoreShape = Record<string, GeneratedImage>;

async function readStore(): Promise<StoreShape> {
  if (useMemoryStore) {
    return Object.fromEntries(memoryStore);
  }
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as StoreShape;
    }
    return {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    console.warn("[imageCache] failed to read cache; starting empty", error);
    return {};
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  if (useMemoryStore) {
    memoryStore.clear();
    for (const [k, v] of Object.entries(store)) {
      memoryStore.set(k, v);
    }
    return;
  }
  await fs.writeFile(CACHE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export const imageCache = {
  buildItemKey(name: string, rarity: ItemRarity): string {
    return `item:${normalize(name)}:${rarity}`;
  },

  async get(key: string): Promise<GeneratedImage | undefined> {
    const store = await readStore();
    return store[key];
  },

  async set(key: string, value: GeneratedImage): Promise<void> {
    const store = await readStore();
    store[key] = value;
    await writeStore(store);
  },
};
