import { Canvas, type SkFont } from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import Animated, {
  makeMutable,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { DigitSlot } from "./components/digit-slot";
import { SymbolSlot } from "./components/symbol-slot";
import {
  animateSlots,
  computeLongestDuration,
  ensureSlots,
  resolveValueTiming,
  type SlotInstruction,
  type SlotMap,
  type SnapInstruction,
  snapToTargets,
} from "./core/animation";
import {
  DEFAULT_BLOOM_BLUR,
  DEFAULT_COLOR,
  DEFAULT_ENTRANCE_TIMING,
  DEFAULT_FONT_SIZE,
  DEFAULT_MAX_INTEGER_DIGITS,
  DEFAULT_OPACITY_TIMING,
  DEFAULT_STAGGER_GAP_MS,
  DEFAULT_SYMBOL_ENTRANCE_TIMING,
  DEFAULT_VALUE_TIMING,
} from "./core/constants";
import { substituteSymbolChars } from "./core/font-fallbacks";
import { buildPreallocatedParts, formatToKeyedParts } from "./core/format";
import { computeMetrics, type GlyphMetrics } from "./core/metrics";
import { measureKernedSlotWidths } from "./core/paragraph-measure";
import { computeSlotWidth, computeStaggerDelays, mergeKeyOrder } from "./core/slots";
import { resolveSystemFont } from "./core/system-font";
import type { KeyedPart, NumberBloomProps } from "./types";

/**
 * Animated number with full `Intl.NumberFormat` support.
 *
 * @example
 * <NumberBloom value={price} format={{ style: "currency", currency: "USD" }} fontSize={32} />
 */
export const NumberBloom = ({
  value,
  format,
  locales,
  prefix,
  suffix,
  font: fontProp,
  fontSize = DEFAULT_FONT_SIZE,
  color = DEFAULT_COLOR,
  letterSpacing = 0,
  opaque = false,
  animated = true,
  shouldAnimate,
  valueTiming = DEFAULT_VALUE_TIMING,
  entranceTiming = DEFAULT_ENTRANCE_TIMING,
  symbolEntranceTiming = DEFAULT_SYMBOL_ENTRANCE_TIMING,
  opacityTiming = DEFAULT_OPACITY_TIMING,
  bloomBlur = DEFAULT_BLOOM_BLUR,
  staggerGap = DEFAULT_STAGGER_GAP_MS,
  maxIntegerDigits = DEFAULT_MAX_INTEGER_DIGITS,
  onAnimationStart,
  onAnimationEnd,
  canvasRef,
}: NumberBloomProps) => {
  const systemFont = useMemo<SkFont | null>(
    () => (fontProp ? null : resolveSystemFont(fontSize)),
    [fontProp, fontSize]
  );
  const font: SkFont | null = fontProp ?? systemFont;

  const metrics = useMemo<GlyphMetrics | null>(() => (font ? computeMetrics(font, fontSize) : null), [font, fontSize]);

  // NaN/Infinity propagating into the UI thread produces NaN translateY and
  // hides the digit strip. Coerce to 0 at the boundary; Intl still renders
  // "NaN"/"∞" via `formatToKeyedParts(value, ...)` below, which uses the raw value.
  const safeValue = Number.isFinite(value) ? value : 0;

  const rawParts = useMemo<KeyedPart[]>(
    () => formatToKeyedParts(value, locales, format, prefix, suffix),
    [value, locales, format, prefix, suffix]
  );

  // Probe Intl once per format/locale/cap rather than on every value change.
  const rawPrealloc = useMemo<KeyedPart[]>(
    () => (maxIntegerDigits != null ? buildPreallocatedParts(maxIntegerDigits, format, locales, prefix, suffix) : []),
    [maxIntegerDigits, format, locales, prefix, suffix]
  );

  // Swap separators the app font can't render (e.g. ARABIC THOUSANDS SEPARATOR
  // ٬) for Latin equivalents — otherwise SkiaText draws `.notdef` and overlaps
  // the next slot.
  const parts = useMemo<KeyedPart[]>(() => substituteSymbolChars(rawParts, font), [rawParts, font]);
  const prealloc = useMemo<KeyedPart[]>(() => substituteSymbolChars(rawPrealloc, font), [rawPrealloc, font]);

  // The digit slots read from `valueSV` and compute `floor(v / power) % 10`.
  // For `style: "percent"`, Intl multiplies by 100 *for display only*, so the
  // formatted integers don't match `value` itself. Scale the master tween value
  // to match what's actually rendered so the digits land on the right glyphs.
  const displayValue = useMemo(() => (format?.style === "percent" ? safeValue * 100 : safeValue), [safeValue, format]);

  // Stable Map identity via lazy init; mutations confined to effects (React Compiler safe).
  const [slotsMap] = useState<SlotMap>(() => new Map());
  const [orderState, setOrderState] = useState<string[]>([]);

  const prevValueRef = useRef(displayValue);
  // Mirrors `orderState`. Used inside the effect so we can read the previous
  // order without making `orderState` a dep (which would cause a redundant
  // second pass and stomp the delayed bloom for boundary cases).
  const prevOrderRef = useRef<string[]>([]);
  // Tracks which keys were "active" (i.e. in `parts`) on the previous run.
  // Drives entering/exiting detection. With `maxIntegerDigits` pre-allocation,
  // slots stick around in `slotsMap` so an order-based diff would never fire.
  const prevActiveKeysRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);
  const onAnimationStartRef = useRef(onAnimationStart);
  const onAnimationEndRef = useRef(onAnimationEnd);

  useEffect(() => {
    onAnimationStartRef.current = onAnimationStart;
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationStart, onAnimationEnd]);

  const valueSV = useSharedValue(displayValue);

  useEffect(() => {
    if (!metrics || !font) return;

    const currentKeys = parts.map(p => p.key);
    const currentActiveKeys = new Set(currentKeys);

    const allKnownParts: KeyedPart[] = prealloc.length ? [...prealloc, ...parts] : parts;
    const glyphChanged = ensureSlots(slotsMap, allKnownParts, makeMutable);

    // Prealloc gives the canonical wide layout, but the probe uses a positive
    // value so it never includes minusSign. Merge in `currentKeys` so signs
    // (and any other dynamic symbols Intl emits per value) land in the order.
    const previousOrder = prevOrderRef.current;
    const targetOrder = prealloc.length
      ? mergeKeyOrder(
          prealloc.map(p => p.key),
          currentKeys
        )
      : currentKeys;
    const mergedOrder = mergeKeyOrder(previousOrder, targetOrder);
    const orderSame =
      mergedOrder.length === previousOrder.length && mergedOrder.every((k, i) => previousOrder[i] === k);
    if (!orderSame) {
      prevOrderRef.current = mergedOrder;
      setOrderState(mergedOrder);
    } else if (glyphChanged) {
      // A symbol's glyph changed in place (e.g. currency $→€) without altering
      // the slot order. `slotViews` memoizes on `orderState`, so hand it a fresh
      // array reference to force a rebuild and render the new glyph.
      setOrderState(prev => prev.slice());
    }

    // Use the shaped (kerned) width so the laid-out number matches `<Text>`. The
    // raw `getGlyphWidths` advance ignores shaping and runs a few px wide per
    // glyph (a narrow "1" advances ~20px but shapes to ~18px), which sums into
    // visible drift. The rolling digit still expands to `maxDigitWidth` mid-roll
    // and every digit clips to it, so a tighter settled width can't overflow.
    // Currency keeps its breathing-room pad (baked into the advance).
    const kernedWidths = measureKernedSlotWidths(font, parts, fontSize);
    const targetWidths = new Map<string, number>();
    for (const part of parts) {
      const kerned = kernedWidths.get(part.key);
      if (kerned == null || part.kind === "currency") {
        targetWidths.set(part.key, computeSlotWidth(part, font, metrics, letterSpacing));
        continue;
      }
      targetWidths.set(part.key, kerned + letterSpacing);
    }

    const buildSnapInstructions = (): SnapInstruction[] => {
      const out: SnapInstruction[] = [];
      for (const [key, slot] of slotsMap) {
        out.push({
          widthSV: slot.widthSV,
          opacitySV: slot.opacitySV,
          blurSV: slot.blurSV,
          target: targetWidths.get(key) ?? 0,
        });
      }
      return out;
    };

    // First mount: snap to final state, no animation.
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      prevValueRef.current = displayValue;
      prevActiveKeysRef.current = currentActiveKeys;
      const snapList = buildSnapInstructions();
      scheduleOnUI(() => {
        "worklet";
        snapToTargets(snapList, displayValue, valueSV);
      });
      return;
    }

    const prev = prevValueRef.current;
    prevValueRef.current = displayValue;

    // `shouldAnimate` lets the caller veto the tween per-update (e.g. skip
    // sub-cent jitter). Same value space as `valueTiming`'s callback.
    if (!animated || shouldAnimate?.(prev, displayValue) === false) {
      if (maxIntegerDigits == null) {
        for (const key of [...slotsMap.keys()]) {
          if (!currentActiveKeys.has(key)) slotsMap.delete(key);
        }
      }
      const snapList = buildSnapInstructions();
      scheduleOnUI(() => {
        "worklet";
        snapToTargets(snapList, displayValue, valueSV);
      });
      prevOrderRef.current = maxIntegerDigits == null ? currentKeys : mergedOrder;
      prevActiveKeysRef.current = currentActiveKeys;
      setOrderState(maxIntegerDigits == null ? currentKeys : mergedOrder);
      return;
    }

    // Active-set diff: a key is "entering" if it's active now but wasn't last
    // run, "exiting" if it was active and isn't now. Works for both dynamic and
    // pre-allocated modes because it ignores whether the slot is in `slotsMap`.
    const prevActive = prevActiveKeysRef.current;
    const enteringKeys = new Set<string>();
    for (const key of currentActiveKeys) if (!prevActive.has(key)) enteringKeys.add(key);
    const exitingKeys = new Set<string>();
    const exitingParts: KeyedPart[] = [];
    for (const key of prevActive) {
      if (currentActiveKeys.has(key)) continue;
      const slot = slotsMap.get(key);
      if (!slot) continue;
      exitingKeys.add(key);
      exitingParts.push({
        key,
        type: slot.type,
        kind: slot.kind,
        char: slot.char,
        digitValue: -1,
        power: slot.power,
      });
    }
    prevActiveKeysRef.current = currentActiveKeys;

    const resolvedValueTiming = resolveValueTiming(valueTiming, prev, displayValue);
    const enteringDelays = computeStaggerDelays({
      parts,
      enteringKeys,
      exitingKeys: new Set(),
      prev,
      next: displayValue,
      duration: resolvedValueTiming.duration,
      gapMs: staggerGap,
    });
    const exitingDelays = computeStaggerDelays({
      parts: exitingParts,
      enteringKeys: new Set(),
      exitingKeys,
      prev,
      next: displayValue,
      duration: resolvedValueTiming.duration,
      gapMs: staggerGap,
    });
    const delays = new Map<string, number>([...enteringDelays, ...exitingDelays]);

    onAnimationStartRef.current?.();

    // The smallest-power digit's wheel cycles through every glyph mid-roll, so
    // intermediate values (e.g. "0") can overflow a narrow settled width (e.g.
    // "1") and get chopped at the container's right edge. Animate that slot to
    // maxDigitWidth instead, then snap it back to the kerned width after the
    // roll settles. `settledPinnedWidth` is the post-roll target captured here.
    let pinnedDigitPower: number | undefined;
    let pinnedKey: string | undefined;
    for (const part of parts) {
      if (part.type !== "digit" || part.power == null) continue;
      if (pinnedDigitPower == null || part.power < pinnedDigitPower) {
        pinnedDigitPower = part.power;
        pinnedKey = part.key;
      }
    }
    const expandedPinnedWidth = metrics.maxDigitWidth + letterSpacing;
    const settledPinnedWidth = pinnedKey != null ? targetWidths.get(pinnedKey) : undefined;
    const pinForRoll = pinnedKey != null && settledPinnedWidth != null && settledPinnedWidth < expandedPinnedWidth;

    // Build a plain instructions array on the JS thread so the worklet doesn't
    // need to iterate Maps/Sets (which are unreliable as Shareables).
    const instructions: SlotInstruction[] = [];
    for (const [key, slot] of slotsMap) {
      const rawTarget = targetWidths.get(key);
      const isExiting = exitingKeys.has(key) || rawTarget == null;
      const isEntering = enteringKeys.has(key);
      const slotTiming = slot.type === "digit" ? entranceTiming : symbolEntranceTiming;
      const target = pinForRoll && key === pinnedKey ? expandedPinnedWidth : (rawTarget ?? 0);
      instructions.push({
        widthSV: slot.widthSV,
        opacitySV: slot.opacitySV,
        blurSV: slot.blurSV,
        target,
        delay: delays.get(key) ?? 0,
        widthMs: slotTiming.duration,
        widthEasing: slotTiming.easing,
        entering: isEntering,
        exiting: isExiting,
      });
    }

    const payload = {
      instructions,
      params: {
        bloomBlur,
        opacityTiming,
        valueTiming: resolvedValueTiming,
      },
      value: displayValue,
      valueSV,
    };

    scheduleOnUI(() => {
      "worklet";
      animateSlots(payload);
    });

    const totalMs = computeLongestDuration(
      delays,
      entranceTiming.duration,
      symbolEntranceTiming.duration,
      opacityTiming.duration,
      resolvedValueTiming.duration
    );

    const timer = setTimeout(() => {
      if (maxIntegerDigits == null) {
        // Dynamic mode: prune exited slots so idle render cost stays minimal.
        const stillNeeded = new Set(parts.map(p => p.key));
        for (const key of [...slotsMap.keys()]) {
          if (!stillNeeded.has(key)) slotsMap.delete(key);
        }
        const filtered = prevOrderRef.current.filter(k => stillNeeded.has(k));
        prevOrderRef.current = filtered;
        setOrderState(filtered);
      }
      // Snap the pinned slot back to its kerned (settled) width so the
      // container matches `<Text>` again at rest.
      if (pinForRoll && pinnedKey != null && settledPinnedWidth != null) {
        const slot = slotsMap.get(pinnedKey);
        if (slot) {
          const widthSV = slot.widthSV;
          const target = settledPinnedWidth;
          const duration = opacityTiming.duration;
          const easing = opacityTiming.easing;
          scheduleOnUI(() => {
            "worklet";
            widthSV.set(withTiming(target, { duration, easing }));
          });
        }
      }
      onAnimationEndRef.current?.();
    }, totalMs);

    return () => clearTimeout(timer);
  }, [
    animated,
    bloomBlur,
    displayValue,
    entranceTiming,
    font,
    letterSpacing,
    maxIntegerDigits,
    metrics,
    opacityTiming,
    parts,
    prealloc,
    fontSize,
    shouldAnimate,
    slotsMap,
    staggerGap,
    symbolEntranceTiming,
    valueSV,
    valueTiming,
  ]);

  const slotViews = useMemo(() => {
    if (!font || !metrics) return null;
    const widthSVs: SharedValue<number>[] = [];
    const items: {
      key: string;
      type: "digit" | "symbol";
      char: string;
      power: number;
      width: SharedValue<number>;
      opacity: SharedValue<number>;
      blur: SharedValue<number>;
      precedingWidths: SharedValue<number>[];
    }[] = [];
    for (const key of orderState) {
      const slot = slotsMap.get(key);
      if (!slot) continue;
      items.push({
        key,
        type: slot.type,
        char: slot.char,
        power: slot.power,
        width: slot.widthSV,
        opacity: slot.opacitySV,
        blur: slot.blurSV,
        precedingWidths: widthSVs.slice(),
      });
      widthSVs.push(slot.widthSV);
    }
    return { items, widthSVs };
  }, [orderState, slotsMap, font, metrics]);

  const layoutWidthSV = useDerivedValue(() => {
    if (!slotViews) return 0;
    let w = 0;
    for (const sv of slotViews.widthSVs) w += sv.get();
    return w;
  }, [slotViews]);

  const containerStyle = useAnimatedStyle(() => ({ width: layoutWidthSV.get() }));

  if (!font || !metrics || !slotViews) {
    return <Animated.View style={{ width: 0, height: Math.ceil(fontSize * 1.2) }} />;
  }

  // Padded so a mid-roll wider digit isn't clipped; outer View clips with its animated width.
  const canvasWidth = slotViews.items.length * (metrics.maxDigitWidth + letterSpacing) + metrics.maxDigitWidth;

  return (
    // direction: "ltr" pins x=0 to the left under RTL (Canvas is wider than the clip).
    <Animated.View style={[{ height: metrics.lineHeight, overflow: "hidden", direction: "ltr" }, containerStyle]}>
      {/* SurfaceView only helps on Android; on iOS it would just paint an unwanted opaque backdrop. */}
      <Canvas
        ref={canvasRef}
        opaque={opaque && Platform.OS === "android"}
        style={{ width: canvasWidth, height: metrics.lineHeight }}
      >
        {slotViews.items.map(item =>
          item.type === "digit" ? (
            <DigitSlot
              key={item.key}
              valueSV={valueSV}
              width={item.width}
              power={item.power}
              precedingWidths={item.precedingWidths}
              opacity={item.opacity}
              blur={item.blur}
              bloomEnabled={bloomBlur > 0}
              metrics={metrics}
              font={font}
              color={color}
            />
          ) : (
            <SymbolSlot
              key={item.key}
              char={item.char}
              precedingWidths={item.precedingWidths}
              opacity={item.opacity}
              blur={item.blur}
              bloomEnabled={bloomBlur > 0}
              metrics={metrics}
              font={font}
              color={color}
            />
          )
        )}
      </Canvas>
    </Animated.View>
  );
};
