import { updateGameState } from "@/lib/tools/gameState";
import { getMemory } from "@/lib/tools/memory";
import { rollDice } from "@/lib/tools/dice";
import { getAnthropicClient, getAnthropicModel } from "@/lib/agentClient";
import { GameState, DiceRollResult, SkillType } from "@/lib/game/types";
import { dmSystemPrompt } from "@/lib/prompts/dmPrompt";
import { getNPCResponse } from "@/lib/agents/npcBrain";

export type TurnEvent =
  | { type: "narration-delta"; delta: string }
  | { type: "dice"; roll: DiceRollResult }
  | { type: "npc"; text: string };

interface DungeonMasterTurnInput {
  sessionId: string;
  state: GameState;
  playerMessage: string;
  onEvent?: (event: TurnEvent) => void;
}

interface DungeonMasterTurnOutput {
  narration: string;
  npcDialogue?: string;
  diceRolls: DiceRollResult[];
  state: GameState;
}

function clampNarrationSentences(input: string): string {
  const fragments = input
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (fragments.length <= 4) {
    return input.trim();
  }

  return fragments.slice(0, 4).join(" ");
}

const SKILL_TYPES: readonly SkillType[] = [
  "Combat",
  "Stealth",
  "Persuasion",
  "Perception",
  "Athletics",
];

function coerceSkillType(value: unknown): SkillType {
  return SKILL_TYPES.includes(value as SkillType) ? (value as SkillType) : "Perception";
}

function deriveSkillModifier(state: GameState, checkType: SkillType): number {
  const stats = state.player.stats;

  switch (checkType) {
    case "Combat":
      return stats.str;
    case "Athletics":
      return stats.str;
    case "Stealth":
      return stats.dex;
    case "Perception":
      return stats.int;
    case "Persuasion":
      return stats.cha;
    default:
      return 0;
  }
}

export async function runDungeonMasterTurn(
  input: DungeonMasterTurnInput,
): Promise<DungeonMasterTurnOutput> {
  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const diceRolls: DiceRollResult[] = [];
  let workingState = input.state;
  let npcDialogue: string | undefined;

  const tools: any[] = [
    {
      name: "rollDice",
      description:
        "Roll dice for checks or combat. Always call this for any action that could fail; never invent an outcome yourself.",
      input_schema: {
        type: "object",
        properties: {
          sides: { type: "number" },
          checkType: {
            type: "string",
            enum: ["Combat", "Stealth", "Persuasion", "Perception", "Athletics"],
          },
          difficulty: { type: "number" },
          modifier: { type: "number" },
        },
        required: ["sides", "checkType", "difficulty"],
      },
    },
    {
      name: "updateGameState",
      description:
        "Persist canonical game state updates. Use this for HP, inventory, gold, stats, location and quest changes.",
      input_schema: {
        type: "object",
        properties: {
          changes: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["changes"],
      },
    },
    {
      name: "getNPCResponse",
      description:
        "Trigger NPC Brain and return in-character NPC dialogue.",
      input_schema: {
        type: "object",
        properties: {
          npcId: { type: "string" },
          playerMessage: { type: "string" },
          relationshipWithPlayer: { type: "string" },
          recentContext: { type: "string" },
        },
        required: ["npcId", "playerMessage", "relationshipWithPlayer", "recentContext"],
      },
    },
    {
      name: "getMemory",
      description: "Semantic retrieval over important memories and recent turns.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  ];

  const messages: any[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            playerMessage: input.playerMessage,
            player: workingState.player,
            world: workingState.world,
            npcs: workingState.npcs,
            shortTermMemory: workingState.shortTermMemory,
            longTermMemory: workingState.longTermMemory.slice(-15),
          }),
        },
      ],
    },
  ];

  let accumulatedNarration = "";

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const stream = client.messages.stream({
      model,
      max_tokens: 420,
      system: dmSystemPrompt,
      tools,
      messages,
      tool_choice: { type: "auto" },
    });

    stream.on("text", (delta: string) => {
      accumulatedNarration += delta;
      input.onEvent?.({ type: "narration-delta", delta });
    });

    const response = await stream.finalMessage();

    const toolUses = response.content.filter((block) => block.type === "tool_use") as any[];

    if (toolUses.length === 0) {
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [] as Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }>;

    for (const toolUse of toolUses) {
      try {
        if (toolUse.name === "rollDice") {
          const checkType = coerceSkillType(toolUse.input.checkType);
          const modifier =
            typeof toolUse.input.modifier === "number"
              ? toolUse.input.modifier
              : deriveSkillModifier(workingState, checkType);
          const result = rollDice({
            sides: Number(toolUse.input.sides ?? 20),
            checkType,
            difficulty: Number(toolUse.input.difficulty ?? 10),
            modifier,
          });
          diceRolls.push(result);
          input.onEvent?.({ type: "dice", roll: result });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
          continue;
        }

        if (toolUse.name === "updateGameState") {
          const changes = (toolUse.input.changes ?? {}) as Partial<GameState>;
          workingState = await updateGameState(input.sessionId, changes);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ ok: true, state: workingState }),
          });
          continue;
        }

        if (toolUse.name === "getNPCResponse") {
          const responseText = await getNPCResponse({
            state: workingState,
            npcId: String(toolUse.input.npcId ?? ""),
            playerMessage: String(toolUse.input.playerMessage ?? input.playerMessage),
            relationshipWithPlayer: String(toolUse.input.relationshipWithPlayer ?? "necunoscut"),
            recentContext: String(toolUse.input.recentContext ?? workingState.world.currentScene),
          });
          npcDialogue = responseText;
          input.onEvent?.({ type: "npc", text: responseText });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ npcDialogue: responseText }),
          });
          continue;
        }

        if (toolUse.name === "getMemory") {
          const memories = getMemory(workingState, String(toolUse.input.query ?? ""));
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ memories }),
          });
          continue;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "Unknown tool.",
          is_error: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown tool error";
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: message,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    narration: clampNarrationSentences(
      accumulatedNarration.trim() ||
        "Misterul se adanceste, dar drumul inca ti se deschide in fata.",
    ),
    npcDialogue,
    diceRolls,
    state: workingState,
  };
}
