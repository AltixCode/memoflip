import { act, fireEvent } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import Home from "../index";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { useGameStore } from "@/store/useGameStore";
import { usePremiumStore } from "@/store/usePremiumStore";

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({
    consent: { canServeAds: true, offerPrivacyOptions: false },
  });
  useGameStore.setState({
    game: null,
    deck: "shapes",
    size: "4x4",
    bests: {},
    results: [],
    startedAt: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the game screen", () => {
  it("offers a start before any game is running", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("startCta"))).toBeTruthy();
    expect(getByText(t("noBestYet"))).toBeTruthy();
  });

  it("deals a board when started", async () => {
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("startCta")));
    expect(useGameStore.getState().game).not.toBeNull();
    expect(getByLabelText(t("cardFaceDown", { n: "1" }))).toBeTruthy();
  });

  it("turns a card over when it is tapped", async () => {
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("startCta")));
    await fireEvent.press(getByLabelText(t("cardFaceDown", { n: "1" })));
    expect(useGameStore.getState().game!.board[0]!.faceUp).toBe(true);
  });

  it("turns a mismatched pair back down after a pause, not instantly", async () => {
    // Instant resolution means the player never sees the second card, which is the game.
    jest.useFakeTimers();
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("startCta")));

    const board = useGameStore.getState().game!.board;
    const first = 0;
    const second = board.findIndex(
      (c, i) => i !== first && c.symbol !== board[first]!.symbol,
    );
    await fireEvent.press(
      getByLabelText(t("cardFaceDown", { n: String(first + 1) })),
    );
    await fireEvent.press(
      getByLabelText(t("cardFaceDown", { n: String(second + 1) })),
    );

    expect(
      useGameStore.getState().game!.board.filter((c) => c.faceUp),
    ).toHaveLength(2);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      useGameStore.getState().game!.board.filter((c) => c.faceUp),
    ).toHaveLength(0);
  });

  it("offers the paywall for a locked board size and starts nothing", async () => {
    const alert = jest.spyOn(Alert, "alert")
      .mockImplementation(() => {});
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(`8x8 — ${t("lockedItem")}`));

    expect(alert.mock.calls[0]![0]).toBe(t("lockedTitle"));
    expect(useGameStore.getState().game).toBeNull();
  });

  it("offers the paywall for a locked deck", async () => {
    const alert = jest.spyOn(Alert, "alert")
      .mockImplementation(() => {});
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(
      getByLabelText(`${t("deckAnimals")} — ${t("lockedItem")}`),
    );
    expect(alert.mock.calls[0]![0]).toBe(t("lockedTitle"));
  });

  it("lets a paying player use the big board", async () => {
    usePremiumStore.setState({ isPremium: true });
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText("8x8"));
    expect(useGameStore.getState().game!.board).toHaveLength(64);
  });

  it("shows the best time for the current deck and size", async () => {
    useGameStore.setState({ bests: { "shapes:4x4": 65_000 } });
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("bestTime", { time: "1:05" }))).toBeTruthy();
  });

  it("routes to results and settings", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("resultsTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/results");
    await fireEvent.press(getByText(t("settingsTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("announces a completed board once and records the result", async () => {
    const alert = jest.spyOn(Alert, "alert")
      .mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("startCta")));

    await act(async () => {
      const game = useGameStore.getState().game!;
      useGameStore.setState({
        game: {
          ...game,
          board: game.board.map((c) => ({ ...c, faceUp: true, matched: true })),
        },
      });
    });

    const wonCalls = alert.mock.calls.filter((c) => c[0] === t("wonTitle"));
    expect(wonCalls).toHaveLength(1);
    expect(useGameStore.getState().results).toHaveLength(1);
  });
});
