import { updateGameState } from "@/lib/tools/gameState";
import { getMemory } from "@/lib/tools/memory";
import { getAnthropicClient, getAnthropicModel } from "@/lib/agentClient";
import {
  GameState,
  DiceRollResult,
  DiceSides,
  RollCheckType,
  SkillType,
} from "@/lib/game/types";
import { dmSystemPrompt } from "@/lib/prompts/dmPrompt";
import { getNPCResponse } from "@/lib/agents/npcBrain";
import { pendingRolls } from "@/lib/agents/pendingRolls";

export type TurnEvent =
  | { type: "narration-delta"; delta: string }
  | { type: "dice"; roll: DiceRollResult }
  | { type: "npc"; text: string }
  | {
      type: "roll-request";
      sides: DiceSides;
      modifier: number;
      checkType: RollCheckType;
      difficulty: number | null;
      toolUseId: string;
    };

interface DungeonMasterTurnInput {
  sessionId: string;
  state: GameState;
  playerMessage: string;
  onEvent?: (event: TurnEvent) => void;
  // Optional: when resuming from a player roll, pre-loaded messages + state.
  resumeMessages?: any[];
  resumeNarration?: string;
  resumeDiceRolls?: DiceRollResult[];
}

interface DungeonMasterTurnOutput {
  narration: string;
  npcDialogue?: string;
  diceRolls: DiceRollResult[];
  state: GameState;
  suspended: boolean;
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

const ROLL_CHECK_TYPES: readonly RollCheckType[] = [...SKILL_TYPES, "Damage", "Attack"];

function coerceRollCheckType(value: unknown): RollCheckType {
  return ROLL_CHECK_TYPES.includes(value as RollCheckType)
    ? (value as RollCheckType)
    : "Perception";
}

const VALID_SIDES: readonly DiceSides[] = [4, 6, 8, 10, 12, 20];

function coerceSides(value: unknown): DiceSides {
  const n = Number(value);
  return (VALID_SIDES as readonly number[]).includes(n) ? (n as DiceSides) : 20;
}

function deriveSkillModifier(state: GameState, checkType: RollCheckType): number {
  const stats = state.player.stats;
  switch (checkType) {
    case "Combat":
    case "Attack":
    case "Athletics":
    case "Damage":
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

  const diceRolls: DiceRollResult[] = input.resumeDiceRolls ? [...input.resumeDiceRolls] : [];
  let workingState = input.state;
  let npcDialogue: string | undefined;
  let accumulatedNarration = input.resumeNarration ?? "";

  const tools: any[] = [
    {
      name: "requestPlayerRoll",
      description:
        "Ask the player to roll a die. Use for skill checks (D20 + modifier vs difficulty), attack rolls (D20 + modifier vs target armor class), and damage rolls (D4-D12, no difficulty). NEVER decide the outcome yourself — wait for the tool_result with the player's actual roll.",
      input_schema: {
        type: "object",
        properties: {
          sides: { type: "number", enum: [4, 6, 8, 10, 12, 20] },
          modifier: { type: "number" },
          checkType: {
            type: "string",
            enum: ["Combat", "Stealth", "Persuasion", "Perception", "Athletics", "Damage", "Attack"],
          },
          difficulty: {
            type: "number",
            description: "DC for checks / AC for attacks. Omit for Damage.",
          },
        },
        required: ["sides", "modifier", "checkType"],
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
      description: "Trigger NPC Brain and return in-character NPC dialogue.",
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
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  ];

  const messages: any[] = input.resumeMessages
    ? [...input.resumeMessages]
    : [
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

    // Check if any tool_use is requestPlayerRoll — if so, suspend.
    const rollToolUse = toolUses.find((tu) => tu.name === "requestPlayerRoll");
    if (rollToolUse) {
      // Filter out sibling tool_uses so the assistant message we save contains
      // ONLY the requestPlayerRoll tool_use. The resume path injects exactly one
      // tool_result; if we kept sibling tool_uses here, they would be orphaned
      // and Anthropic would reject the next call with
      // "tool_use ids were found without tool_result blocks". The DM can re-issue
      // any dropped tool after seeing the roll result.
      const filteredContent = (response.content as any[]).filter(
        (block) => block.type !== "tool_use" || block.id === rollToolUse.id,
      );
      messages.push({ role: "assistant", content: filteredContent });

      const sides = coerceSides(rollToolUse.input.sides);
      const checkType = coerceRollCheckType(rollToolUse.input.checkType);
      const modifier =
        typeof rollToolUse.input.modifier === "number"
          ? rollToolUse.input.modifier
          : deriveSkillModifier(workingState, checkType);
      const difficultyRaw = rollToolUse.input.difficulty;
      const difficulty =
        typeof difficultyRaw === "number" && checkType !== "Damage" ? difficultyRaw : undefined;

      pendingRolls.set({
        sessionId: input.sessionId,
        messages,
        pendingToolUseId: rollToolUse.id,
        rollRequest: { sides, modifier, checkType, difficulty },
        createdAt: Date.now(),
      });

      input.onEvent?.({
        type: "roll-request",
        sides,
        modifier,
        checkType,
        difficulty: difficulty ?? null,
        toolUseId: rollToolUse.id,
      });

      return {
        narration: accumulatedNarration,
        npcDialogue,
        diceRolls,
        state: workingState,
        suspended: true,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const toolUse of toolUses) {
      try {
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

    // Hard enforcement: after getNPCResponse, the DM's turn ends.
    // The prompt forbids paraphrasing the NPC's dialogue, but the model tends
    // to violate this rule in follow-up iterations where it emits more narration
    // after the NPC speaks. Force-stopping the loop is the reliable fix.
    if (toolUses.some((tu: any) => tu.name === "getNPCResponse")) {
      break;
    }
  }

  return {
    narration: clampNarrationSentences(
      accumulatedNarration.trim() ||
        "The mystery deepens, but the road still opens before you.",
    ),
    npcDialogue,
    diceRolls,
    state: workingState,
    suspended: false,
  };
}

// Re-export for the API route to resume after a player roll.
export interface ResumeAfterRollInput {
  sessionId: string;
  state: GameState;
  pendingMessages: any[];
  toolUseId: string;
  rollResult: DiceRollResult;
  priorNarration: string;
  priorDiceRolls: DiceRollResult[];
  onEvent?: (event: TurnEvent) => void;
}

export async function resumeDungeonMasterAfterRoll(
  input: ResumeAfterRollInput,
): Promise<DungeonMasterTurnOutput> {
  // Inject tool_result for the pending requestPlayerRoll call.
  const toolResultContent = JSON.stringify({
    roll: input.rollResult.roll,
    total: input.rollResult.total,
    success: input.rollResult.success,
    difficulty: input.rollResult.difficulty,
    sides: input.rollResult.sides,
    modifier: input.rollResult.modifier,
    checkType: input.rollResult.checkType,
  });

  const messages = [
    ...input.pendingMessages,
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: input.toolUseId,
          content: toolResultContent,
        },
      ],
    },
  ];

  // Re-emit dice event so the UI shows the result badge.
  input.onEvent?.({ type: "dice", roll: input.rollResult });

  return runDungeonMasterTurn({
    sessionId: input.sessionId,
    state: input.state,
    playerMessage: "",
    onEvent: input.onEvent,
    resumeMessages: messages,
    resumeNarration: input.priorNarration,
    resumeDiceRolls: [...input.priorDiceRolls, input.rollResult],
  });
}
