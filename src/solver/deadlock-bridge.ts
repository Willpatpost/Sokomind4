import type { Box, GameSnapshot, ParsedBoard } from "../core/model.ts";
import { compileSearchBoard, type CompiledSearchBoard } from "./search/compiled-board.ts";
import { toDenseBoxes } from "./search/model.ts";
import { isStaticDeadCell, createsFullyBlockedTwoByTwoDeadlock } from "./search/deadlocks.ts";

export interface DeadlockResult {
  readonly isDeadlocked: boolean;
  readonly deadlockedBoxIds: readonly string[];
}

const NO_DEADLOCK: DeadlockResult = Object.freeze({
  isDeadlocked: false,
  deadlockedBoxIds: Object.freeze([]),
});

const boardCache = new WeakMap<ParsedBoard, CompiledSearchBoard>();

function getCompiledBoard(board: ParsedBoard): CompiledSearchBoard {
  let compiled = boardCache.get(board);
  if (!compiled) {
    compiled = compileSearchBoard(board);
    boardCache.set(board, compiled);
  }
  return compiled;
}

export function findPushedBox(
  previousBoxes: readonly Box[],
  nextBoxes: readonly Box[],
): Box | undefined {
  for (let i = 0; i < nextBoxes.length; i++) {
    const prev = previousBoxes[i];
    const next = nextBoxes[i];
    if (
      prev.position.row !== next.position.row ||
      prev.position.column !== next.position.column
    ) {
      return next;
    }
  }
  return undefined;
}

export function detectDeadlock(
  board: ParsedBoard,
  snapshot: GameSnapshot,
  pushedBoxId?: string,
): DeadlockResult {
  if (snapshot.solved) return NO_DEADLOCK;

  const compiled = getCompiledBoard(board);
  const denseBoxes = toDenseBoxes(compiled, snapshot.boxes);
  const deadlockedIds: string[] = [];

  if (pushedBoxId) {
    const pushedDense = denseBoxes.find((b) => b.id === pushedBoxId);
    if (pushedDense) {
      if (isStaticDeadCell(compiled, pushedDense.cell, pushedDense.label)) {
        deadlockedIds.push(pushedDense.id);
      }

      if (
        deadlockedIds.length === 0 &&
        createsFullyBlockedTwoByTwoDeadlock(compiled, denseBoxes, pushedDense.cell)
      ) {
        deadlockedIds.push(pushedDense.id);
      }
    }
  }

  return deadlockedIds.length > 0
    ? Object.freeze({ isDeadlocked: true, deadlockedBoxIds: Object.freeze(deadlockedIds) })
    : NO_DEADLOCK;
}
