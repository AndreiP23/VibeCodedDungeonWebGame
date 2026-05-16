import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  runDungeonMasterTurn,
  resumeDungeonMasterAfterRoll,
} from "@/lib/agents/dungeonMaster";
import { pendingRolls } from "@/lib/agents/pendingRolls";
import {
  DiceRollResult,
  DiceSides,
  PlayerClass,
  RollCheckType,
} from "@/lib/game/types";
import { getOrCreateGameState, updateGameState } from "@/lib/tools/gameState";
import { pushLongTermMemory, pushShortTermMessages } from "@/lib/tools/memory";

const bonusesSchema = z
  .object({
    items: z.array(z.string()).optional(),
    statBonus: z
      .object({
        stat: z.enum(["str", "dex", "int", "cha"]),
        amount: z.number(),
      })
      .nullable()
      .optional(),
    goldBonus: z.number().optional(),
    flavorTrait: z.string().optional(),
  })
  .optional();

const requestSchema = z.object({
  action: z.enum(["init", "turn", "roll"]).default("turn"),
  sessionId: z.string().optional(),
  playerName: z.string().min(1).default("Erou"),
  playerClass: z.enum(["warrior", "mage", "rogue"]).default("warrior"),
  message: z.string().optional(),
  backstory: z.string().max(2000).optional(),
  bonuses: bonusesSchema,
  toolUseId: z.string().optional(),
  roll: z.number().int().min(1).max(20).optional(),
});

const VALID_SIDES: readonly DiceSides[] = [4, 6, 8, 10, 12, 20];

function streamResponse(
  sessionId: string,
  runner: (send: (event: unknown) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      (async () => {
        try {
          await runner(send);
        } catch (error) {
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unexpected server error while processing game turn.",
          });
        } finally {
          controller.close();
        }
      })();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Session-Id": sessionId,
    },
  });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const pending = pendingRolls.get(sessionId);
  if (!pending) {
    return NextResponse.json({ pendingRoll: null });
  }
  return NextResponse.json({
    pendingRoll: {
      sides: pending.rollRequest.sides,
      modifier: pending.rollRequest.modifier,
      checkType: pending.rollRequest.checkType,
      difficulty: pending.rollRequest.difficulty ?? null,
      toolUseId: pending.pendingToolUseId,
    },
  });
}

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

    const payload = parsed.data;

    const game = await getOrCreateGameState({
      sessionId: payload.sessionId,
      playerName: payload.playerName,
      playerClass: payload.playerClass as PlayerClass,
      backstory: payload.backstory,
      bonuses: payload.bonuses
        ? {
            items: payload.bonuses.items ?? [],
            statBonus: payload.bonuses.statBonus ?? undefined,
            goldBonus: payload.bonuses.goldBonus,
            flavorTrait: payload.bonuses.flavorTrait,
          }
        : undefined,
    });

    const sessionId = game.sessionId;

    if (payload.action === "init") {
      const introNarration = game.created
        ? "Usa tavernei Coroana Sparta se inchide in urma ta, iar ochii obisnuitilor se intorc spre noul vanator de secrete."
        : game.state.world.currentScene;

      return NextResponse.json({
        sessionId,
        narration: introNarration,
        npcDialogue: null,
        diceRolls: [],
        state: game.state,
      });
    }

    if (payload.action === "turn") {
      if (pendingRolls.has(sessionId)) {
        return NextResponse.json(
          { error: "Roll pending — submit roll first." },
          { status: 409 },
        );
      }
      if (!payload.message?.trim()) {
        return NextResponse.json(
          { error: "Field 'message' is required for action='turn'." },
          { status: 400 },
        );
      }

      const playerMessage = payload.message;
      const initialState = game.state;

      return streamResponse(sessionId, async (send) => {
        const turnResult = await runDungeonMasterTurn({
          sessionId,
          state: initialState,
          playerMessage,
          onEvent: (event) => send(event),
        });

        await finalizeTurn({
          sessionId,
          turnResult,
          playerMessage,
          send,
        });
      });
    }

    if (payload.action === "roll") {
      if (!payload.toolUseId || typeof payload.roll !== "number") {
        return NextResponse.json(
          { error: "Fields 'toolUseId' and 'roll' are required for action='roll'." },
          { status: 400 },
        );
      }
      const pending = pendingRolls.get(sessionId);
      if (!pending) {
        return NextResponse.json({ error: "No pending roll for this session." }, { status: 400 });
      }
      if (pending.pendingToolUseId !== payload.toolUseId) {
        return NextResponse.json({ error: "toolUseId mismatch." }, { status: 400 });
      }
      const { sides, modifier, checkType, difficulty } = pending.rollRequest;
      if (!(VALID_SIDES as readonly number[]).includes(sides)) {
        return NextResponse.json({ error: "Invalid sides on pending roll." }, { status: 500 });
      }
      if (payload.roll < 1 || payload.roll > sides) {
        return NextResponse.json(
          { error: `roll must be between 1 and ${sides}.` },
          { status: 400 },
        );
      }

      const total = payload.roll + modifier;
      const success =
        typeof difficulty === "number" && checkType !== "Damage" ? total >= difficulty : null;

      const rollResult: DiceRollResult = {
        checkType: checkType as RollCheckType,
        sides,
        roll: payload.roll,
        modifier,
        total,
        difficulty: typeof difficulty === "number" ? difficulty : null,
        success,
      };

      pendingRolls.delete(sessionId);

      return streamResponse(sessionId, async (send) => {
        const resumed = await resumeDungeonMasterAfterRoll({
          sessionId,
          state: game.state,
          pendingMessages: pending.messages,
          toolUseId: pending.pendingToolUseId,
          rollResult,
          priorNarration: "",
          priorDiceRolls: [],
          onEvent: (event) => send(event),
        });

        if (resumed.suspended) {
          // Another roll requested — already emitted via onEvent. Close stream without finalizing.
          send({ type: "suspended", sessionId });
          return;
        }

        await finalizeTurn({
          sessionId,
          turnResult: resumed,
          playerMessage: "",
          send,
        });
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error while processing game turn.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface FinalizeTurnInput {
  sessionId: string;
  turnResult: {
    narration: string;
    npcDialogue?: string;
    diceRolls: DiceRollResult[];
    state: import("@/lib/game/types").GameState;
    suspended: boolean;
  };
  playerMessage: string;
  send: (event: unknown) => void;
}

async function finalizeTurn({ sessionId, turnResult, playerMessage, send }: FinalizeTurnInput) {
  if (turnResult.suspended) {
    send({ type: "suspended", sessionId });
    return;
  }
  const now = new Date().toISOString();
  let stateWithMemory = turnResult.state;

  const newMessages: { role: "player" | "dm" | "npc"; content: string; timestamp: string }[] = [];
  if (playerMessage) {
    newMessages.push({ role: "player", content: playerMessage, timestamp: now });
  }
  if (turnResult.narration) {
    newMessages.push({ role: "dm", content: turnResult.narration, timestamp: now });
  }
  if (turnResult.npcDialogue) {
    newMessages.push({ role: "npc", content: turnResult.npcDialogue, timestamp: now });
  }
  if (newMessages.length > 0) {
    stateWithMemory = pushShortTermMessages(stateWithMemory, newMessages);
  }

  for (const roll of turnResult.diceRolls) {
    stateWithMemory = pushLongTermMemory(stateWithMemory, {
      id: randomUUID(),
      summary: `${roll.checkType} check with total ${roll.total} (${
        roll.success === null ? "damage" : roll.success ? "success" : "failure"
      }).`,
      tags: [
        "dice",
        roll.checkType.toLowerCase(),
        roll.success === null ? "damage" : roll.success ? "success" : "failure",
      ],
      timestamp: now,
    });
  }

  const persisted = await updateGameState(sessionId, {
    shortTermMemory: stateWithMemory.shortTermMemory,
    longTermMemory: stateWithMemory.longTermMemory,
  });

  send({
    type: "done",
    sessionId,
    narration: turnResult.narration,
    npcDialogue: turnResult.npcDialogue ?? null,
    diceRolls: turnResult.diceRolls,
    state: persisted,
  });
}
