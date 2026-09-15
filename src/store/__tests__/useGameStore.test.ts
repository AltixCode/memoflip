import AsyncStorage from "@react-native-async-storage/async-storage";

import { GAME_CACHE_KEY, FREE_SIZES, useGameStore } from "../useGameStore";
import { cardsFor } from "@/logic/match";

const reset = () =>
  useGameStore.setState({
    game: null,
    deck: "shapes",
    size: "4x4",
    bests: {},
    results: [],
    startedAt: null,
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  reset();
});

describe("starting a game", () => {
  it("deals a board of the chosen size", () => {
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    expect(useGameStore.getState().game!.board).toHaveLength(cardsFor("4x4"));
  });

  it("records when it started, so a time can be measured", () => {
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    expect(typeof useGameStore.getState().startedAt).toBe("number");
  });
});

describe("the free tier", () => {
  it.each(FREE_SIZES)("lets a free player use %s", (size) => {
    expect(
      useGameStore.getState().start(size, "shapes", false, () => 0.5),
    ).toBe("started");
  });

  it("refuses the larger grids to a free player — the paywall sells them", () => {
    expect(
      useGameStore.getState().start("6x6", "shapes", false, () => 0.5),
    ).toBe("locked-size");
    expect(
      useGameStore.getState().start("8x8", "shapes", false, () => 0.5),
    ).toBe("locked-size");
    expect(useGameStore.getState().game).toBeNull();
  });

  it("gives the larger grids to a paying player", () => {
    expect(
      useGameStore.getState().start("8x8", "shapes", true, () => 0.5),
    ).toBe("started");
    expect(useGameStore.getState().game!.board).toHaveLength(cardsFor("8x8"));
  });

  it("refuses a deck beyond the free one, and allows it once paid", () => {
    expect(
      useGameStore.getState().start("4x4", "animals", false, () => 0.5),
    ).toBe("locked-deck");
    expect(
      useGameStore.getState().start("4x4", "animals", true, () => 0.5),
    ).toBe("started");
  });

  it("refuses a deck that does not exist, whoever asks", () => {
    expect(
      useGameStore.getState().start("4x4", "no-such-deck", true, () => 0.5),
    ).toBe("locked-deck");
  });
});

describe("playing", () => {
  const twoOfAKind = () => {
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    const board = useGameStore.getState().game!.board;
    const first = 0;
    const second = board.findIndex(
      (c, i) => i !== first && c.symbol === board[first]!.symbol,
    );
    return { first, second };
  };

  it("flips and resolves a matching pair", () => {
    const { first, second } = twoOfAKind();
    useGameStore.getState().flipAt(first);
    useGameStore.getState().flipAt(second);
    useGameStore.getState().resolveTurn();
    expect(
      useGameStore.getState().game!.board.filter((c) => c.matched),
    ).toHaveLength(2);
  });

  it("does nothing when no game is running", () => {
    expect(() => useGameStore.getState().flipAt(0)).not.toThrow();
    expect(useGameStore.getState().game).toBeNull();
  });
});

describe("results", () => {
  it("records a finished game and its time", () => {
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    useGameStore.getState().finish(42_000);

    const [result] = useGameStore.getState().results;
    expect(result!.size).toBe("4x4");
    expect(result!.deck).toBe("shapes");
    expect(result!.ms).toBe(42_000);
  });

  it("keeps the best time per deck and size, not per deck alone", () => {
    // A 4×4 time and an 8×8 time are not comparable; sharing one slot would show a 4×4
    // record as the best for a board four times the size.
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    useGameStore.getState().finish(30_000);
    useGameStore.getState().start("6x6", "shapes", true, () => 0.5);
    useGameStore.getState().finish(90_000);

    expect(useGameStore.getState().bests["shapes:4x4"]).toBe(30_000);
    expect(useGameStore.getState().bests["shapes:6x6"]).toBe(90_000);
  });

  it("only replaces a best time with a faster one", () => {
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    useGameStore.getState().finish(30_000);
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    useGameStore.getState().finish(45_000);
    expect(useGameStore.getState().bests["shapes:4x4"]).toBe(30_000);
  });

  it("shows a free player only their recent results and a paying one all of them", () => {
    for (let i = 0; i < 40; i += 1) {
      useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
      useGameStore.getState().finish(10_000 + i);
    }
    expect(useGameStore.getState().visibleResults(false).length).toBeLessThan(
      40,
    );
    expect(useGameStore.getState().visibleResults(true)).toHaveLength(40);
  });

  it("ignores a finish with no game running", () => {
    useGameStore.getState().finish(1000);
    expect(useGameStore.getState().results).toHaveLength(0);
  });
});

describe("persistence", () => {
  it("round-trips best times and results", async () => {
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    useGameStore.getState().finish(30_000);
    await useGameStore.getState().persist();

    reset();
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().bests["shapes:4x4"]).toBe(30_000);
    expect(useGameStore.getState().results).toHaveLength(1);
  });

  it("survives stored rubbish", async () => {
    await AsyncStorage.setItem(
      GAME_CACHE_KEY,
      '{"bests":[1,2],"results":"none","deck":9}',
    );
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().bests).toEqual({});
    expect(useGameStore.getState().results).toEqual([]);
    expect(useGameStore.getState().deck).toBe("shapes");
  });

  it("does not restore a game in progress, which would restart the clock", async () => {
    // The elapsed time would be wrong and the player would keep a board they had left.
    useGameStore.getState().start("4x4", "shapes", false, () => 0.5);
    await useGameStore.getState().persist();
    reset();
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().game).toBeNull();
  });
});
