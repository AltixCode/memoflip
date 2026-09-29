/**
 * The memory-match board and the rules of a turn.
 *
 * Pure and dependency-free with the shuffle source injected, so a layout can be reproduced in
 * a test and the turn rules can be iterated on from `npm test` alone.
 *
 * A turn is two flips. The rules that matter, and that a naive implementation gets wrong:
 * the same card cannot be flipped twice (it would match itself), an already-matched card
 * cannot be flipped at all, and flipping a **third** card while two unresolved ones are still
 * face up settles that pending pair first (see `flip`) rather than being ignored or forcing
 * the player to wait out a timer.
 */

// Graduated difficulty, smallest first — a level is just an index into this list, so adding
// one is a data change (columns × rows must stay even, and its pair count must stay within
// every deck's symbol count; see decks.ts) rather than a code change.
export const GRID_SIZES = ["4x4", "4x6", "6x6", "6x8", "8x8"] as const;
export type GridSize = (typeof GRID_SIZES)[number];

export interface Card {
  /** Unique per card, so the two halves of a pair remain distinguishable. */
  id: number;
  symbol: string;
  faceUp: boolean;
  matched: boolean;
}

export interface GameState {
  size: GridSize;
  board: Card[];
  /** A move is one complete turn: two cards flipped, matching or not. */
  moves: number;
}

type Rng = () => number;

export function columnsFor(size: GridSize): number {
  return Number(size.split("x")[0]);
}

export function rowsFor(size: GridSize): number {
  return Number(size.split("x")[1]);
}

export function cardsFor(size: GridSize): number {
  return columnsFor(size) * rowsFor(size);
}

/** Fisher–Yates. A sort with a random comparator is not a uniform shuffle. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

/**
 * Lays out a board of face-down pairs.
 *
 * A deck shorter than the board needs is cycled rather than padded with blanks: every symbol
 * still appears an even number of times, so every card still has a partner. A board with an
 * unpairable card can never be completed.
 */
export function dealBoard(
  size: GridSize,
  symbols: string[],
  rng: Rng = Math.random,
): Card[] {
  const pairs = cardsFor(size) / 2;
  const unique = Array.from(new Set(symbols));
  const pool = unique.length >= pairs ? shuffle(unique, rng) : unique;
  const chosen = Array.from(
    { length: pairs },
    (_, i) => pool[i % pool.length]!,
  );
  const doubled = chosen.flatMap((symbol) => [symbol, symbol]);
  return shuffle(doubled, rng).map((symbol, id) => ({
    id,
    symbol,
    faceUp: false,
    matched: false,
  }));
}

export function newGame(
  size: GridSize,
  symbols: string[],
  rng: Rng = Math.random,
): GameState {
  return { size, board: dealBoard(size, symbols, rng), moves: 0 };
}

const faceUpUnmatched = (board: Card[]): Card[] =>
  board.filter((c) => c.faceUp && !c.matched);

/**
 * Turns one card over.
 *
 * Returns the state unchanged for every illegal flip rather than throwing: the screen calls
 * this straight from a press handler, and an exception there is a crash on a mistap.
 *
 * A tester reported that the game felt "too slow" because a third tap did nothing at all
 * until a fixed timer settled the pending pair. Waiting out a timer to see the *next* pair is
 * not the same as waiting to see *this* one, so a tap now settles a still-showing pair itself
 * (matching or not — `resolve` decides which) before turning the tapped card over. The
 * on-screen timer in the caller is only a fallback for a player who does not tap again.
 */
export function flip(state: GameState, index: number): GameState {
  const card = state.board[index];
  if (!card) return state;
  if (card.faceUp || card.matched) return state;

  const pending =
    faceUpUnmatched(state.board).length >= 2 ? resolve(state) : state;

  const board = pending.board.map((c, i) =>
    i === index ? { ...c, faceUp: true } : c,
  );
  const nowUp = faceUpUnmatched(board).length;
  return {
    ...pending,
    board,
    // A move is a completed turn, so it counts on the second card, not the first.
    moves: nowUp === 2 ? pending.moves + 1 : pending.moves,
  };
}

/**
 * Settles a turn: a matching pair stays up and is marked, a mismatch goes back down.
 *
 * Kept separate from `flip` so the screen can show the two cards for a moment before they
 * turn back — the delay is presentation, and the rule is not.
 */
export function resolve(state: GameState): GameState {
  const up = faceUpUnmatched(state.board);
  if (up.length < 2) return state;

  const [first, second] = up;
  const matched = first!.symbol === second!.symbol;
  return {
    ...state,
    board: state.board.map((c) => {
      if (c.matched || !c.faceUp) return c;
      return matched ? { ...c, matched: true } : { ...c, faceUp: false };
    }),
  };
}

export function isComplete(state: GameState): boolean {
  return state.board.every((c) => c.matched);
}

/** Pairs still to find. */
export function remainingPairs(state: GameState): number {
  return state.board.filter((c) => !c.matched).length / 2;
}
