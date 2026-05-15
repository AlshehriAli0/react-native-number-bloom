import type { SkFont } from "@shopify/react-native-skia";
import { DIGIT_KEYS } from "./constants";

export interface GlyphMetrics {
  /** Advance width for each digit 0–9. */
  digitWidths: number[];
  /** Max advance among digits, used to size the rolling slot. */
  maxDigitWidth: number;
  /** Cached widths for arbitrary symbol characters. */
  symbolWidths: Map<string, number>;
  /** Single-line height. */
  lineHeight: number;
  /** Y position of the glyph baseline within the line box. */
  baselineY: number;
}

export const computeMetrics = (font: SkFont, fontSize: number): GlyphMetrics => {
  const digitGlyphs = font.getGlyphIDs(DIGIT_KEYS.join(""));
  const digitWidths = font.getGlyphWidths(digitGlyphs);
  const maxDigitWidth = digitWidths.reduce((a, b) => (a > b ? a : b), 0);

  const lineHeight = Math.ceil(fontSize * 1.2);
  const fm = font.getMetrics();
  const ascent = -fm.ascent;
  const descent = fm.descent;
  const glyphHeight = ascent + descent;
  const baselineY = (lineHeight - glyphHeight) / 2 + ascent;

  return {
    digitWidths,
    maxDigitWidth,
    symbolWidths: new Map<string, number>(),
    lineHeight,
    baselineY,
  };
};

export const measureChar = (font: SkFont, metrics: GlyphMetrics, char: string): number => {
  const cached = metrics.symbolWidths.get(char);
  if (cached != null) return cached;
  const ids = font.getGlyphIDs(char);
  const widths = font.getGlyphWidths(ids);
  let w = 0;
  for (const v of widths) w += v;
  metrics.symbolWidths.set(char, w);
  return w;
};
