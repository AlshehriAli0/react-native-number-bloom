import {
  type SkFont,
  Skia,
  type SkParagraphBuilder,
  type SkTypeface,
  type SkTypefaceFontProvider,
  TextDirection,
} from "@shopify/react-native-skia";
import type { KeyedPart } from "../types";

const PROVIDER_FAMILY = "_nb_paragraph_font_";
const CACHE_LIMIT = 64;

const providerCache = new WeakMap<SkTypeface, SkTypefaceFontProvider>();
const builderCache = new WeakMap<SkTypeface, SkParagraphBuilder>();
const widthCache = new WeakMap<SkTypeface, Map<string, Map<string, number>>>();

const getProvider = (typeface: SkTypeface): SkTypefaceFontProvider => {
  let provider = providerCache.get(typeface);
  if (provider) return provider;
  provider = Skia.TypefaceFontProvider.Make();
  provider.registerFont(typeface, PROVIDER_FAMILY);
  providerCache.set(typeface, provider);
  return provider;
};

const getBuilder = (typeface: SkTypeface): SkParagraphBuilder => {
  let builder = builderCache.get(typeface);
  if (builder) {
    builder.reset();
    return builder;
  }
  // Force LTR so kerned widths don't change under an RTL system locale.
  builder = Skia.ParagraphBuilder.Make({ textDirection: TextDirection.LTR }, getProvider(typeface));
  builderCache.set(typeface, builder);
  return builder;
};

const getEntryCache = (typeface: SkTypeface): Map<string, Map<string, number>> => {
  let entries = widthCache.get(typeface);
  if (entries) return entries;
  entries = new Map();
  widthCache.set(typeface, entries);
  return entries;
};

/**
 * Per-glyph slot widths from the font's kern table via Skia's Paragraph API.
 * The basic `SkiaText`/`getGlyphWidths` path skips kerning, so without this
 * multi-digit strings render looser than `<Text>` (CoreText). Returned widths
 * use the same keys as `parts`; an empty map means measurement was unavailable
 * and callers should fall back to raw advances.
 */
export const measureKernedSlotWidths = (font: SkFont, parts: KeyedPart[], fontSize: number): Map<string, number> => {
  if (parts.length === 0) return new Map();
  const typeface = font.getTypeface();
  if (!typeface) return new Map();

  const text = parts.map(p => p.char).join("");
  const cacheKey = `${fontSize}:${text}`;
  const entries = getEntryCache(typeface);

  const cached = entries.get(cacheKey);
  if (cached) {
    // Bump to MRU so the bounded Map evicts the genuinely-oldest entry.
    entries.delete(cacheKey);
    entries.set(cacheKey, cached);
    return cached;
  }

  const builder = getBuilder(typeface);
  builder.pushStyle({ fontFamilies: [PROVIDER_FAMILY], fontSize });
  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(Number.POSITIVE_INFINITY);

  const out = new Map<string, number>();
  let cursor = 0;
  for (const part of parts) {
    const len = part.char.length;
    if (len === 0) {
      out.set(part.key, 0);
      continue;
    }
    const rects = paragraph.getRectsForRange(cursor, cursor + len);
    let width = 0;
    for (const r of rects) width += r.width;
    out.set(part.key, width);
    cursor += len;
  }

  entries.set(cacheKey, out);
  if (entries.size > CACHE_LIMIT) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  return out;
};
