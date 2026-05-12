import { getAnthropicClient, getAnthropicModel } from "@/lib/agentClient";
import { GameState } from "@/lib/game/types";
import { npcSystemPrompt } from "@/lib/prompts/npcPrompt";

interface NPCResponseInput {
  state: GameState;
  npcId: string;
  playerMessage: string;
  relationshipWithPlayer: string;
  recentContext: string;
}

export async function getNPCResponse(input: NPCResponseInput): Promise<string> {
  const npc = input.state.npcs.find((candidate) => candidate.id === input.npcId);

  if (!npc) {
    return "Nu stiu despre cine vorbesti, strainule.";
  }

  if (npc.location !== input.state.player.location) {
    return `[NPC ${npc.name} este în ${npc.location}, jucătorul este în ${input.state.player.location}. NPC-ul nu poate vorbi cu jucătorul acum. Spune-i narativ jucătorului că nu vede pe nimeni cu acel nume aici.]`;
  }

  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const payload = {
    npc: {
      id: npc.id,
      name: npc.name,
      race: npc.race,
      personality: npc.personality,
      secrets: npc.secrets,
      speechStyle: npc.speechStyle,
    },
    relationshipWithPlayer: input.relationshipWithPlayer,
    playerMessage: input.playerMessage,
    recentContext: input.recentContext,
  };

  const response = await client.messages.create({
    model,
    max_tokens: 220,
    system: npcSystemPrompt,
    messages: [
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text || `${npc.name} te priveste in tacere, cantarind fiecare cuvant.`;
}
