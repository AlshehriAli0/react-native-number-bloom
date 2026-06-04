import { Group, rect, type SkFont, Text as SkiaText } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { DIGIT_KEYS } from "../core/constants";
import type { GlyphMetrics } from "../core/metrics";
import { SlotChrome } from "./slot-chrome";

interface DigitSlotProps {
  valueSV: SharedValue<number>;
  width: SharedValue<number>;
  power: number;
  precedingWidths: readonly SharedValue<number>[];
  opacity: SharedValue<number>;
  blur: SharedValue<number>;
  bloomEnabled: boolean;
  metrics: GlyphMetrics;
  font: SkFont;
  color: string;
}

/**
 * Vertical 0–9 strip clipped to one line; `translateY` derives from the master value via `floor(v/power) % 10`.
 *
 * Memoized: every prop is referentially stable across a `value` change (SharedValues
 * from the slot map, memoized font/metrics, `precedingWidths` from the slotViews memo),
 * so re-rendering the parent skips the whole per-slot Skia subtree — value changes
 * stay pure UI-thread shared-value animation.
 */
export const DigitSlot = memo(function DigitSlot({
  valueSV,
  width,
  power,
  precedingWidths,
  opacity,
  blur,
  bloomEnabled,
  metrics,
  font,
  color,
}: DigitSlotProps) {
  const h = metrics.lineHeight;

  const transform = useDerivedValue(() => {
    let x = 0;
    for (const sv of precedingWidths) x += sv.get();
    return [{ translateX: x }];
  }, [precedingWidths]);

  // For fractional positions (power < 1), divide-and-floor accumulates FP error
  // (e.g. `Math.floor(0.3 / 0.1) === 2`). Multiplying by the rounded inverse
  // avoids the error and yields the correct glyph.
  //
  // Hidden preallocated slots short-circuit so we don't subscribe to `valueSV`
  // — they won't be invalidated when the master tween ticks each frame.
  const translateTransform = useDerivedValue(() => {
    if (width.get() === 0) return [{ translateY: 0 }];
    const v = valueSV.get();
    const abs = v < 0 ? -v : v;
    const digit = power >= 1 ? Math.floor(abs / power) % 10 : Math.floor(abs * Math.round(1 / power) + 1e-9) % 10;
    return [{ translateY: -digit * h }];
  });

  // Clip at maxDigitWidth so a mid-roll wide digit isn't chopped by a narrower settled slot.
  const clipRect = useMemo(() => rect(0, 0, metrics.maxDigitWidth, h), [metrics.maxDigitWidth, h]);

  return (
    <SlotChrome transform={transform} opacity={opacity} blur={blur} bloomEnabled={bloomEnabled}>
      <Group clip={clipRect}>
        {DIGIT_KEYS.map((key, d) => {
          const baseY = d * h + metrics.baselineY;
          return (
            <Group key={key} transform={translateTransform}>
              <SkiaText color={color} font={font} text={key} x={0} y={baseY} />
            </Group>
          );
        })}
      </Group>
    </SlotChrome>
  );
});
