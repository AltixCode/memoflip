import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { Button, Screen, Text } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n";
import { DECKS, FREE_DECK } from "@/logic/decks";
import {
  GRID_SIZES,
  type GridSize,
  columnsFor,
  isComplete,
  remainingPairs,
} from "@/logic/match";
import { FREE_SIZES, useGameStore } from "@/store/useGameStore";
import { usePremiumStore } from "@/store/usePremiumStore";
import { useTheme } from "@/theme";

const MIN_TOUCH_TARGET = 44;
/** How long a mismatched pair stays visible before turning back. */
const PEEK_MS = 900;

/** Mm:ss from milliseconds. */
function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, "0")}`;
}

export default function Home() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const game = useGameStore((s) => s.game);
  const deck = useGameStore((s) => s.deck);
  const size = useGameStore((s) => s.size);
  const bests = useGameStore((s) => s.bests);
  const startedAt = useGameStore((s) => s.startedAt);
  const start = useGameStore((s) => s.start);
  const flipAt = useGameStore((s) => s.flipAt);
  const resolveTurn = useGameStore((s) => s.resolveTurn);
  const finish = useGameStore((s) => s.finish);

  const [elapsed, setElapsed] = useState(0);
  const announced = useRef(false);

  // The clock is derived from the absolute start time rather than incremented, so it stays
  // right across a backgrounding — the same reason Multitick stores an end time.
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  // Two face-up cards settle on a timer so the player can see them. The timeout lives in an
  // effect with a cleanup, never in the press handler, or it fires after unmount.
  const faceUp = game?.board.filter((c) => c.faceUp && !c.matched).length ?? 0;
  useEffect(() => {
    if (faceUp < 2) return;
    const id = setTimeout(resolveTurn, PEEK_MS);
    return () => clearTimeout(id);
  }, [faceUp, resolveTurn]);

  useEffect(() => {
    if (!game || announced.current || !isComplete(game)) return;
    announced.current = true;
    const ms = startedAt ? Date.now() - startedAt : elapsed;
    const key = `${deck}:${size}`;
    const previous = bests[key];
    finish(ms);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      t("wonTitle"),
      `${t("wonBody", { time: formatMs(ms), moves: String(game.moves) })}${
        previous === undefined || ms < previous ? `\n${t("newBest")}` : ""
      }`,
    );
  }, [game, startedAt, elapsed, deck, size, bests, finish]);

  const begin = useCallback(
    (nextSize: GridSize, nextDeck: string) => {
      const outcome = start(nextSize, nextDeck, isPremium);
      if (outcome !== "started") {
        Alert.alert(t("lockedTitle"), t("lockedBody"), [
          { text: t("cancel"), style: "cancel" },
          { text: t("removeAdsCta"), onPress: () => router.push("/paywall") },
        ]);
        return;
      }
      announced.current = false;
      setElapsed(0);
    },
    [start, isPremium, router],
  );

  const columns = game ? columnsFor(game.size) : 4;
  const board = game?.board ?? [];
  const gap = spacing.xs;
  const boardWidth = Math.min(width - spacing.xl * 2, 480);
  const cell = (boardWidth - gap * (columns - 1)) / columns;
  const bestForCurrent = bests[`${deck}:${size}`];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="display">{t("appName")}</Text>
            <Text variant="caption" tone="muted">
              {bestForCurrent
                ? t("bestTime", { time: formatMs(bestForCurrent) })
                : t("noBestYet")}
            </Text>
          </View>
          <Button
            label={t("resultsTitle")}
            variant="ghost"
            onPress={() => router.push("/results")}
          />
        </View>

        {game ? (
          <>
            <View
              style={[styles.row, { gap: spacing.lg, marginTop: spacing.md }]}
            >
              <Text
                variant="caption"
                tone="muted"
              >{`${t("timeLabel")} ${formatMs(elapsed)}`}</Text>
              <Text
                variant="caption"
                tone="muted"
              >{`${t("movesLabel")} ${game.moves}`}</Text>
              <Text variant="caption" tone="muted">
                {t("pairsLeft", { n: String(remainingPairs(game)) })}
              </Text>
            </View>

            <View
              style={[
                styles.chips,
                {
                  gap,
                  marginTop: spacing.lg,
                  width: boardWidth,
                  alignSelf: "center",
                },
              ]}
            >
              {board.map((card, index) => {
                const label = card.matched
                  ? t("cardMatched", {
                      n: String(index + 1),
                      symbol: card.symbol,
                    })
                  : card.faceUp
                    ? t("cardFaceUp", {
                        n: String(index + 1),
                        symbol: card.symbol,
                      })
                    : t("cardFaceDown", { n: String(index + 1) });
                return (
                  <Pressable
                    key={card.id}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ disabled: card.matched }}
                    disabled={card.matched}
                    onPress={() => flipAt(index)}
                    style={{
                      width: cell,
                      height: cell,
                      minWidth: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.md,
                      backgroundColor: card.faceUp
                        ? colors.surface
                        : colors.surfaceAlt,
                      borderWidth: card.matched ? 2 : 1,
                      borderColor: card.matched ? colors.accent : colors.border,
                      opacity: card.matched ? 0.7 : 1,
                    }}
                  >
                    <Text
                      variant="bodyStrong"
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      style={{ fontSize: Math.max(14, cell * 0.5) }}
                    >
                      {card.faceUp || card.matched ? card.symbol : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              label={t("restartCta")}
              variant="secondary"
              fullWidth
              onPress={() => begin(size, deck)}
              style={{ marginTop: spacing.lg }}
            />
          </>
        ) : null}

        <Text variant="micro" tone="faint" style={{ marginTop: spacing.xl }}>
          {t("boardSize").toUpperCase()}
        </Text>
        <View
          style={[styles.chips, { gap: spacing.sm, marginTop: spacing.sm }]}
        >
          {GRID_SIZES.map((option) => {
            const locked = !isPremium && !FREE_SIZES.includes(option);
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={
                  locked ? `${option} — ${t("lockedItem")}` : option
                }
                accessibilityState={{ selected: size === option }}
                onPress={() => begin(option, deck)}
                style={{
                  minHeight: MIN_TOUCH_TARGET,
                  justifyContent: "center",
                  paddingHorizontal: spacing.base,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: size === option ? 2 : 1,
                  borderColor: size === option ? colors.accent : colors.border,
                }}
              >
                <Text variant="caption">{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="micro" tone="faint" style={{ marginTop: spacing.lg }}>
          {t("deckLabel").toUpperCase()}
        </Text>
        <View
          style={[styles.chips, { gap: spacing.sm, marginTop: spacing.sm }]}
        >
          {DECKS.map((option) => {
            const locked = !isPremium && option.id !== FREE_DECK;
            const name = t(option.nameKey as TranslationKey);
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={
                  locked ? `${name} — ${t("lockedItem")}` : name
                }
                accessibilityState={{ selected: deck === option.id }}
                onPress={() => begin(size, option.id)}
                style={{
                  minHeight: MIN_TOUCH_TARGET,
                  justifyContent: "center",
                  paddingHorizontal: spacing.base,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: deck === option.id ? 2 : 1,
                  borderColor:
                    deck === option.id ? colors.accent : colors.border,
                }}
              >
                <Text variant="caption">{`${option.symbols[0]}  ${name}`}</Text>
              </Pressable>
            );
          })}
        </View>

        {!game ? (
          <Button
            label={t("startCta")}
            fullWidth
            onPress={() => begin(size, deck)}
            style={{ marginTop: spacing.xl }}
          />
        ) : null}

        <Button
          label={t("settingsTitle")}
          variant="ghost"
          fullWidth
          onPress={() => router.push("/settings")}
          style={{ marginTop: spacing.md }}
        />
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  chips: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
});
