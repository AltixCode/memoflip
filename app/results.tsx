import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { Screen, Text } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n";
import { DECKS } from "@/logic/decks";
import { GRID_SIZES } from "@/logic/match";
import { useGameStore } from "@/store/useGameStore";
import { usePremiumStore } from "@/store/usePremiumStore";
import { useTheme } from "@/theme";

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, "0")}`;
}

const deckName = (id: string): string => {
  const deck = DECKS.find((d) => d.id === id);
  return deck ? t(deck.nameKey as TranslationKey) : id;
};

/**
 * Best times per deck and size, and the games behind them.
 *
 * A free player sees their ten most recent results and is told how many more the purchase
 * would show — a number, not a vague "more". Hiding the count entirely would make the claim
 * unverifiable, which is the kind of paywall copy this portfolio does not write.
 */
export default function Results() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const bests = useGameStore((s) => s.bests);
  const allResults = useGameStore((s) => s.results);
  const visible = useGameStore((s) => s.visibleResults)(isPremium);
  const hidden = allResults.length - visible.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <Text variant="display">{t("resultsTitle")}</Text>

        {DECKS.map((deck) => {
          const rows = GRID_SIZES.map((size) => ({
            size,
            ms: bests[`${deck.id}:${size}`],
          })).filter((row) => row.ms !== undefined);
          if (rows.length === 0) return null;
          return (
            <View key={deck.id} style={{ marginTop: spacing.lg }}>
              <Text variant="micro" tone="faint">
                {t(deck.nameKey as TranslationKey).toUpperCase()}
              </Text>
              {rows.map((row) => (
                <View
                  key={row.size}
                  style={[styles.titleRow, { marginTop: spacing.xs }]}
                >
                  <Text variant="body" style={{ flex: 1 }}>
                    {row.size}
                  </Text>
                  <Text variant="bodyStrong" tone="accent">
                    {formatMs(row.ms!)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <Text variant="micro" tone="faint" style={{ marginTop: spacing.xl }}>
          {t("resultsTitle").toUpperCase()}
        </Text>

        {visible.length === 0 ? (
          <Text
            variant="caption"
            tone="muted"
            style={{ marginTop: spacing.sm }}
          >
            {t("emptyResults")}
          </Text>
        ) : (
          visible.map((result) => (
            <View
              key={`${result.at}-${result.ms}`}
              style={[
                styles.titleRow,
                {
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {`${deckName(result.deck)} · ${result.size} · ${result.moves} ${t("movesLabel")}`}
              </Text>
              <Text variant="bodyStrong">{formatMs(result.ms)}</Text>
            </View>
          ))
        )}

        {hidden > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("moreResultsLocked", { n: String(hidden) })}
            onPress={() => router.push("/paywall")}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: spacing.base,
              marginTop: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="caption" tone="accent">
              {t("moreResultsLocked", { n: String(hidden) })}
            </Text>
          </Pressable>
        ) : null}
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center" },
});
