import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { runDungeonMasterTurn } from "@/lib/agents/dungeonMaster";
import { PlayerClass } from "@/lib/game/types";
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
  action: z.enum(["init", "turn"]).default("turn"),
  sessionId: z.string().optional(),
  playerName: z.string().min(1).default("Erou"),
  playerClass: z.enum(["warrior", "mage", "rogue"]).default("warrior"),
  message: z.string().optional(),
  backstory: z.string().max(2000).optional(),
  bonuses: bonusesSchema,
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

    if (payload.action === "init") {
      const introNarration = game.created
        ? "Usa tavernei Coroana Sparta se inchide in urma ta, iar ochii obisnuitilor se intorc spre noul vanator de secrete."
        : game.state.world.currentScene;

      return NextResponse.json({
        sessionId: game.sessionId,
        narration: introNarration,
        npcDialogue: null,
        diceRolls: [],
        state: game.state,
      });
    }

    if (!payload.message?.trim()) {
      return NextResponse.json(
        { error: "Field 'message' is required for action='turn'." },
        { status: 400 },
      );
    }

    const playerMessage = payload.message;
    const sessionId = game.sessionId;
    const initialState = game.state;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        (async () => {
          try {
            const turnResult = await runDungeonMasterTurn({
              sessionId,
              state: initialState,
              playerMessage,
              onEvent: (event) => send(event),
            });

            const now = new Date().toISOString();

            let stateWithMemory = pushShortTermMessages(turnResult.state, [
              { role: "player", content: playerMessage, timestamp: now },
              { role: "dm", content: turnResult.narration, timestamp: now },
            ]);

            if (turnResult.npcDialogue) {
              stateWithMemory = pushShortTermMessages(stateWithMemory, [
                { role: "npc", content: turnResult.npcDialogue, timestamp: now },
              ]);
            }

            for (const roll of turnResult.diceRolls) {
              stateWithMemory = pushLongTermMemory(stateWithMemory, {
                id: randomUUID(),
                summary: `${roll.checkType} check with total ${roll.total} (${roll.success ? "success" : "failure"}).`,
                tags: ["dice", roll.checkType.toLowerCase(), roll.success ? "success" : "failure"],
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
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error while processing game turn.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
