import { fireEvent } from "@testing-library/react-native";
import React from "react";

import Results from "../results";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { FREE_RESULTS, useGameStore } from "@/store/useGameStore";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { usePremiumStore } from "@/store/usePremiumStore";

const result = (ms: number, at: number) => ({
  deck: "shapes",
  size: "4x4" as const,
  ms,
  moves: 20,
  at,
});

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

describe("the results screen", () => {
  it("says so when nothing has been finished", async () => {
    const { getByText } = await renderWithProviders(<Results />);
    expect(getByText(t("emptyResults"))).toBeTruthy();
  });

  it("lists a best time under its deck", async () => {
    useGameStore.setState({ bests: { "shapes:4x4": 65_000 } });
    const { getByText } = await renderWithProviders(<Results />);
    expect(getByText(t("deckShapes").toUpperCase())).toBeTruthy();
    expect(getByText("1:05")).toBeTruthy();
  });

  it("keeps best times separate per size, because they are not comparable", async () => {
    useGameStore.setState({
      bests: { "shapes:4x4": 30_000, "shapes:8x8": 200_000 },
    });
    const { getByText } = await renderWithProviders(<Results />);
    expect(getByText("0:30")).toBeTruthy();
    expect(getByText("3:20")).toBeTruthy();
  });

  it("tells a free player exactly how many results are behind the purchase", async () => {
    // A number, not a vague "more" — the claim has to be checkable by the person paying.
    const many = Array.from({ length: FREE_RESULTS + 7 }, (_, i) =>
      result(10_000 + i, i),
    );
    useGameStore.setState({ results: many });

    const { getByText } = await renderWithProviders(<Results />);
    expect(getByText(t("moreResultsLocked", { n: "7" }))).toBeTruthy();
  });

  it("sends that prompt to the paywall", async () => {
    useGameStore.setState({
      results: Array.from({ length: FREE_RESULTS + 2 }, (_, i) =>
        result(10_000 + i, i),
      ),
    });
    const { getByLabelText } = await renderWithProviders(<Results />);
    await fireEvent.press(getByLabelText(t("moreResultsLocked", { n: "2" })));
    expect(testRouter.push).toHaveBeenCalledWith("/paywall");
  });

  it("shows a paying player everything, with no prompt", async () => {
    usePremiumStore.setState({ isPremium: true });
    const many = Array.from({ length: FREE_RESULTS + 7 }, (_, i) =>
      result(10_000 + i, i),
    );
    useGameStore.setState({ results: many });

    const { queryByText } = await renderWithProviders(<Results />);
    expect(queryByText(t("moreResultsLocked", { n: "7" }))).toBeNull();
  });
});
