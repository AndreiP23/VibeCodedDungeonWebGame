import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { runDungeonMasterTurn } from "@/lib/agents/dungeonMaster";
import { PlayerClass } from "@/lib/game/types";
import { getOrCreateGameState, updateGameState } from "@/lib/tools/gameState";
import { pushLongTermMemory, pushShortTermMessages } from "@/lib/tools/memory";

const requestSchema = z.object({
  action: z.enum(["init", "turn"]).default("turn"),
  sessionId: z.string().optional(),
  playerName: z.string().min(1).default("Erou"),
  playerClass: z.enum(["warrior", "mage", "rogue"]).default("warrior"),
  message: z.string().optional(),
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
    });

    if (payload.action === "init") {
      return NextResponse.json({
        sessionId: game.sessionId,
        narration:
          "Usa tavernei Coroana Sparta se inchide in urma ta, iar ochii obisnuitilor se intorc spre noul vanator de secrete.",
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

    const turnResult = await runDungeonMasterTurn({
      sessionId: game.sessionId,
      state: game.state,
      playerMessage: payload.message,
    });

    let stateWithMemory = pushShortTermMessages(turnResult.state, [
      {
        role: "player",
        content: payload.message,
        timestamp: new Date().toISOString(),
      },
      {
        role: "dm",
        content: turnResult.narration,
        timestamp: new Date().toISOString(),
      },
    ]);

    if (turnResult.npcDialogue) {
      stateWithMemory = pushShortTermMessages(stateWithMemory, [
        {
          role: "npc",
          content: turnResult.npcDialogue,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    if (turnResult.diceRolls.length > 0) {
      const roll = turnResult.diceRolls[turnResult.diceRolls.length - 1];
      stateWithMemory = pushLongTermMemory(stateWithMemory, {
        id: randomUUID(),
        summary: `${roll.checkType} check with total ${roll.total} (${roll.success ? "success" : "failure"}).`,
        tags: ["dice", roll.checkType.toLowerCase(), roll.success ? "success" : "failure"],
        timestamp: new Date().toISOString(),
      });
    }

    const persisted = await updateGameState(game.sessionId, {
      shortTermMemory: stateWithMemory.shortTermMemory,
      longTermMemory: stateWithMemory.longTermMemory,
    });

    return NextResponse.json({
      sessionId: game.sessionId,
      narration: turnResult.narration,
      npcDialogue: turnResult.npcDialogue ?? null,
      diceRolls: turnResult.diceRolls,
      state: persisted,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error while processing game turn.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
