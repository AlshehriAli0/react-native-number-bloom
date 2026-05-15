import { type SkFont, Text as SkiaText } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { GlyphMetrics } from "../core/metrics";
import { SlotChrome } from "./slot-chrome";

interface SymbolSlotProps {
  char: string;
  precedingWidths: readonly SharedValue<number>[];
  opacity: SharedValue<number>;
  blur: SharedValue<number>;
  bloomEnabled: boolean;
  metrics: GlyphMetrics;
  font: SkFont;
  color: string;
}

/** Static glyph slot (commas, decimal marks, currency, prefix/suffix). */
export const SymbolSlot = ({
  char,
  precedingWidths,
  opacity,
  blur,
  bloomEnabled,
  metrics,
  font,
  color,
}: SymbolSlotProps) => {
  const transform = useDerivedValue(() => {
    let x = 0;
    for (const sv of precedingWidths) x += sv.get();
    return [{ translateX: x }];
  }, [precedingWidths]);

  return (
    <SlotChrome transform={transform} opacity={opacity} blur={blur} bloomEnabled={bloomEnabled}>
      <SkiaText color={color} font={font} text={char} x={0} y={metrics.baselineY} />
    </SlotChrome>
  );
};
