/**
 * The game in progress, the best times, and the results history.
 *
 * Three of the paywall's four claims are enforced here — every deck, the larger grids, and the
 * full results history — so each takes `isPremium` explicitly at the call site rather than
 * reaching into another store. A gate you can see at the call site is a gate you can test.
 *
 * The rules are all in `src/logic/match.ts`; this only sequences them and persists the result.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { DECKS, FREE_DECK, deckById } from "@/logic/decks";
import {
  GRID_SIZES,
  type GameState,
  type GridSize,
  flip,
  isComplete,
  newGame,
  resolve,
} from "@/logic/match";

export const GAME_CACHE_KEY = "memoflip.state.v1";

/** Board sizes a free player may start. The paywall sells 6×6 and 8×8. */
export const FREE_SIZES: GridSize[] = ["4x4", "4x6"];
/** Results a free player can look back through. */
export const FREE_RESULTS = 10;
/** A ceiling even for a paying player: a history is a record, not a log to keep forever. */
const MAX_RESULTS = 500;

type Rng = () => number;

export interface Result {
  deck: string;
  size: GridSize;
  ms: number;
  moves: number;
  at: number;
}

interface GameStoreState {
  game: GameState | null;
  deck: string;
  size: GridSize;
  /** Best time per `deck:size`. A 4×4 record means nothing on an 8×8 board. */
  bests: Record<string, number>;
  results: Result[];
  /** Absolute start time, so an elapsed time survives the app being backgrounded. */
  startedAt: number | null;

  start: (
    size: GridSize,
    deck: string,
    isPremium: boolean,
    rng?: Rng,
  ) => "started" | "locked-size" | "locked-deck";
  flipAt: (index: number) => void;
  resolveTurn: () => void;
  finish: (ms: number) => void;
  visibleResults: (isPremium: boolean) => Result[];
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const bestKey = (deck: string, size: GridSize): string => `${deck}:${size}`;

function validBests(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, ms] of Object.entries(value as Record<string, unknown>)) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) continue;
    out[key] = ms;
  }
  return out;
}

function validResults(value: unknown): Result[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is Result =>
      !!r &&
      typeof r === "object" &&
      typeof (r as Result).deck === "string" &&
      GRID_SIZES.includes((r as Result).size) &&
      typeof (r as Result).ms === "number" &&
      typeof (r as Result).moves === "number" &&
      typeof (r as Result).at === "number",
  );
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  deck: FREE_DECK,
  size: "4x4",
  bests: {},
  results: [],
  startedAt: null,

  start(size, deck, isPremium, rng = Math.random) {
    if (!GRID_SIZES.includes(size)) return "locked-size";
    if (!isPremium && !FREE_SIZES.includes(size)) return "locked-size";
    // An unknown deck is refused rather than silently falling back: a player who picked a deck
    // must get that deck or be told why not.
    if (!DECKS.some((d) => d.id === deck)) return "locked-deck";
    if (!isPremium && deck !== FREE_DECK) return "locked-deck";

    set({
      game: newGame(size, deckById(deck).symbols, rng),
      deck,
      size,
      startedAt: Date.now(),
    });
    return "started";
  },

  flipAt(index) {
    const { game } = get();
    if (!game) return;
    set({ game: flip(game, index) });
  },

  resolveTurn() {
    const { game } = get();
    if (!game) return;
    set({ game: resolve(game) });
  },

  finish(ms) {
    const { game, deck, size } = get();
    if (!game) return;

    const result: Result = {
      deck,
      size,
      ms,
      moves: game.moves,
      at: Date.now(),
    };
    set((s) => {
      const key = bestKey(deck, size);
      const previous = s.bests[key];
      return {
        results: [result, ...s.results].slice(0, MAX_RESULTS),
        bests:
          previous === undefined || ms < previous
            ? { ...s.bests, [key]: ms }
            : s.bests,
        startedAt: null,
      };
    });
    void get().persist();
  },

  visibleResults(isPremium) {
    const { results } = get();
    return isPremium ? results : results.slice(0, FREE_RESULTS);
  },

  async persist() {
    const { bests, results, deck, size } = get();
    try {
      // The game in progress is deliberately not written: restoring a board would restore a
      // start time that has since passed, and the recorded solve would be wrong.
      await AsyncStorage.setItem(
        GAME_CACHE_KEY,
        JSON.stringify({ bests, results, deck, size }),
      );
    } catch {
      // A lost record is survivable; a failed launch is not.
    }
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(GAME_CACHE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as Record<string, unknown>;
      set({
        bests: validBests(record.bests),
        results: validResults(record.results),
        deck:
          typeof record.deck === "string" &&
          DECKS.some((d) => d.id === record.deck)
            ? record.deck
            : FREE_DECK,
        size: GRID_SIZES.includes(record.size as GridSize)
          ? (record.size as GridSize)
          : "4x4",
        game: null,
        startedAt: null,
      });
    } catch {
      // Unreadable storage starts clean rather than preventing launch.
    }
  },
}));

export { isComplete };
