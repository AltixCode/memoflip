import {
  GRID_SIZES,
  type GameState,
  cardsFor,
  dealBoard,
  flip,
  isComplete,
  newGame,
  resolve,
} from "../match";

/** Deterministic shuffle source. */
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("dealBoard", () => {
  it.each(GRID_SIZES)("deals %s as an even number of cards", (size) => {
    const cards = cardsFor(size);
    expect(cards % 2).toBe(0);
  });

  it("contains exactly two of every symbol", () => {
    const board = dealBoard(
      "4x4",
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      () => 0.5,
    );
    const counts = new Map<string, number>();
    for (const card of board)
      counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(counts.size).toBe(8);
  });

  it("starts with every card face down and unmatched", () => {
    const board = dealBoard(
      "4x4",
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      () => 0.5,
    );
    expect(board.every((c) => !c.faceUp && !c.matched)).toBe(true);
  });

  it("gives every card a distinct id, so two cards of a pair are still separate", () => {
    const board = dealBoard(
      "4x4",
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      () => 0.5,
    );
    expect(new Set(board.map((c) => c.id)).size).toBe(board.length);
  });

  it("shuffles — two different sources give different layouts", () => {
    const symbols = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const a = dealBoard("4x4", symbols, seq([0.1, 0.9, 0.3, 0.7])).map(
      (c) => c.symbol,
    );
    const b = dealBoard("4x4", symbols, seq([0.9, 0.1, 0.7, 0.3])).map(
      (c) => c.symbol,
    );
    expect(a).not.toEqual(b);
  });

  it("repeats symbols rather than dealing blanks when the deck is short", () => {
    // A six-symbol deck cannot fill an 8×8 board with unique pairs; the board must still be
    // complete and still contain an even count of every symbol it uses.
    const board = dealBoard("8x8", ["a", "b", "c", "d", "e", "f"], () => 0.5);
    expect(board).toHaveLength(cardsFor("8x8"));
    const counts = new Map<string, number>();
    for (const card of board)
      counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
    expect([...counts.values()].every((n) => n % 2 === 0)).toBe(true);
  });
});

describe("flip", () => {
  const start = (): GameState =>
    newGame("4x4", ["a", "b", "c", "d", "e", "f", "g", "h"], () => 0.5);

  it("turns a card face up", () => {
    const state = flip(start(), 0);
    expect(state.board[0]!.faceUp).toBe(true);
  });

  it("ignores a second tap on the same card", () => {
    // Otherwise a card matches itself and the pair is "found" without the player finding it.
    let state = flip(start(), 0);
    state = flip(state, 0);
    expect(state.board.filter((c) => c.faceUp)).toHaveLength(1);
  });

  it("ignores a card that is already matched", () => {
    let state = start();
    state = {
      ...state,
      board: state.board.map((c, i) => (i === 0 ? { ...c, matched: true } : c)),
    };
    expect(flip(state, 0).board[0]!.faceUp).toBe(false);
  });

  it("refuses a third card while two are still face up", () => {
    // The two unresolved cards must be seen before anything else turns over.
    const state = start();
    const first = state.board.findIndex(
      (c) => c.symbol === state.board[0]!.symbol,
    );
    const other = state.board.findIndex(
      (c, i) => i !== first && c.symbol !== state.board[0]!.symbol,
    );
    let next = flip(state, first);
    next = flip(next, other);
    const third = next.board.findIndex((c) => !c.faceUp && !c.matched);
    expect(flip(next, third).board[third]!.faceUp).toBe(false);
  });

  it("ignores an index that is not on the board", () => {
    expect(flip(start(), 999).board.some((c) => c.faceUp)).toBe(false);
    expect(flip(start(), -1).board.some((c) => c.faceUp)).toBe(false);
  });

  it("counts a move only when the second card of a turn is flipped", () => {
    const state = start();
    const first = 0;
    const second = state.board.findIndex((c, i) => i !== first);
    expect(flip(state, first).moves).toBe(0);
    expect(flip(flip(state, first), second).moves).toBe(1);
  });
});

describe("resolve — what happens after two cards are face up", () => {
  const twoUp = (matching: boolean): GameState => {
    const state = newGame(
      "4x4",
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      () => 0.5,
    );
    const first = 0;
    const symbol = state.board[first]!.symbol;
    const second = state.board.findIndex(
      (c, i) =>
        i !== first && (matching ? c.symbol === symbol : c.symbol !== symbol),
    );
    return flip(flip(state, first), second);
  };

  it("keeps a matching pair face up and marks it matched", () => {
    const state = resolve(twoUp(true));
    const matched = state.board.filter((c) => c.matched);
    expect(matched).toHaveLength(2);
    expect(matched.every((c) => c.faceUp)).toBe(true);
  });

  it("turns a mismatched pair back down", () => {
    const state = resolve(twoUp(false));
    expect(state.board.filter((c) => c.faceUp)).toHaveLength(0);
    expect(state.board.filter((c) => c.matched)).toHaveLength(0);
  });

  it("does nothing when fewer than two cards are up", () => {
    const state = newGame("4x4", ["a", "b", "c", "d"], () => 0.5);
    expect(resolve(state)).toEqual(state);
  });
});

describe("completion", () => {
  it("is complete only when every card is matched", () => {
    let state = newGame(
      "4x4",
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      () => 0.5,
    );
    expect(isComplete(state)).toBe(false);
    state = {
      ...state,
      board: state.board.map((c) => ({ ...c, matched: true, faceUp: true })),
    };
    expect(isComplete(state)).toBe(true);
  });
});
