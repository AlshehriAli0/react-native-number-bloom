import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { DevSettings, I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NumberBloom } from "react-native-number-bloom";

const STEPS = [-11000, -612, -47, 51, 638, 11000] as const;
const INITIAL_COUNT = 73;

interface FormatConfig {
  label: string;
  format?: Intl.NumberFormatOptions;
  scale: number;
}

const FORMATS = {
  plain: { label: "Plain", scale: 1 },
  usd: { label: "USD", format: { style: "currency", currency: "USD" }, scale: 1 },
  eur: { label: "EUR", format: { style: "currency", currency: "EUR" }, scale: 1 },
  percent: { label: "Percent", format: { style: "percent" }, scale: 0.01 },
  compact: { label: "Compact", format: { notation: "compact" }, scale: 1 },
} satisfies Record<string, FormatConfig>;

type FormatKey = keyof typeof FORMATS;
const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];

const toggleRTL = () => {
  const next = !I18nManager.isRTL;
  I18nManager.allowRTL(next);
  I18nManager.forceRTL(next);
  DevSettings.reload();
};

export default function App() {
  const [count, setCount] = useState(INITIAL_COUNT);
  const [formatKey, setFormatKey] = useState<FormatKey>("plain");
  const [inline, setInline] = useState(false);

  const cfg: FormatConfig = FORMATS[formatKey];
  const value = count * cfg.scale;

  return (
    <View style={styles.safe}>
      <Text style={styles.title}>react-native-number-bloom {I18nManager.isRTL ? "(RTL)" : "(LTR)"}</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.numberWrap}>
          {inline ? (
            <View style={styles.inlineRow}>
              <Text style={styles.inlineText}>You have </Text>
              <NumberBloom value={value} format={cfg.format} fontSize={28} color="#ffffff" />
              <Text style={styles.inlineText}> in your wallet</Text>
            </View>
          ) : (
            <NumberBloom value={value} format={cfg.format} fontSize={80} color="#ffffff" />
          )}
        </View>

        <View style={styles.row}>
          {STEPS.map(d => (
            <Pressable key={d} style={styles.pill} onPress={() => setCount(c => c + d)}>
              <Text style={styles.pillText}>{d > 0 ? `+${d}` : d}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.row, styles.rowTight]}>
          <Pressable style={styles.pill} onPress={() => setCount(INITIAL_COUNT)}>
            <Text style={styles.pillText}>Reset</Text>
          </Pressable>
          <Pressable style={[styles.pill, inline && styles.pillActive]} onPress={() => setInline(p => !p)}>
            <Text style={[styles.pillText, inline && styles.pillTextActive]}>Inline</Text>
          </Pressable>
          <Pressable style={[styles.pill, styles.pillRTL]} onPress={toggleRTL}>
            <Text style={styles.pillText}>{I18nManager.isRTL ? "→ LTR" : "← RTL"}</Text>
          </Pressable>
        </View>

        <View style={[styles.row, styles.rowTight]}>
          {FORMAT_KEYS.map(k => {
            const active = k === formatKey;
            return (
              <Pressable key={k} style={[styles.pill, active && styles.pillActive]} onPress={() => setFormatKey(k)}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{FORMATS[k].label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0a0a" },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 40,
  },
  title: {
    color: "#ddd",
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: 0.5,
    textAlign: "center",
    paddingTop: 80,
    paddingBottom: 8,
  },
  numberWrap: { minHeight: 140, justifyContent: "center" },
  inlineRow: { flexDirection: "row", alignItems: "center" },
  inlineText: { color: "#ddd", fontSize: 22, fontWeight: "400" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  rowTight: { gap: 8 },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "transparent",
  },
  pillActive: {
    borderColor: "#666",
    backgroundColor: "#1c1c1c",
  },
  pillRTL: {
    borderColor: "#7a4a00",
    backgroundColor: "#2a1a00",
  },
  pillText: { color: "#bbb", fontSize: 14, fontWeight: "500" },
  pillTextActive: { color: "#fff" },
});
