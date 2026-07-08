import type { CanvasRef, SkFont } from "@shopify/react-native-skia";
import type { RefObject } from "react";
import type { EasingFunction, EasingFunctionFactory } from "react-native-reanimated";

/** Duration + easing pair for a single tween. */
export interface TimingConfig {
  duration: number;
  easing: EasingFunction | EasingFunctionFactory;
}

/** Static config, or a function `(prev, next) => TimingConfig` so duration can scale with the delta. */
export type ValueTiming = TimingConfig | ((prev: number, next: number) => TimingConfig);

export type PartKind =
  | "integer"
  | "fraction"
  | "group"
  | "decimal"
  | "currency"
  | "percent"
  | "percentSign"
  | "literal"
  | "minusSign"
  | "plusSign"
  | "exponentSeparator"
  | "exponentMinusSign"
  | "exponentInteger"
  | "unit"
  | "compact"
  | "infinity"
  | "nan"
  | "unknown"
  | "prefix"
  | "suffix";

/** A single formatted unit (digit or symbol) with the metadata needed to diff, position, and animate it. */
export interface KeyedPart {
  /** Stable identity across re-renders, e.g. `"integer:2"`, `"group:0"`, `"currency:0"`. */
  key: string;
  /** Digits derive their glyph from the live master value; symbols are static. */
  type: "digit" | "symbol";
  kind: PartKind;
  /** Display character. */
  char: string;
  /** 0–9 for digits, -1 for symbols. */
  digitValue: number;
  /** Positional power for digits (ones=1, tens=10, tenths=0.1…). Drives `floor(v/power) % 10` and stagger thresholds. */
  power?: number;
}

/** Props for the {@link NumberBloom} component. */
export interface NumberBloomProps {
  /** Number to display. */
  value: number;

  /** `Intl.NumberFormat` options: currency, percent, units, compact, grouping, fraction digits. */
  format?: Intl.NumberFormatOptions;

  /** BCP 47 locale(s). Controls grouping/decimal marks and numbering system. */
  locales?: Intl.LocalesArgument;

  /** Static string prepended; participates in entrance/exit animations. */
  prefix?: string;

  /** Static string appended; participates in entrance/exit animations. */
  suffix?: string;

  /**
   * Font to render with. Load with Skia's `useFont` and pass it in:
   * `useFont(require("./Inter-Bold.otf"), fontSize)`. If omitted, falls back
   * to the system font.
   */
  font?: SkFont | null;

  /** Font size in points. Default: 16. */
  fontSize?: number;

  /** Text color. Default: `"black"`. */
  color?: string;

  /** Extra space added between glyphs, in points. Default: 0. */
  letterSpacing?: number;

  /**
   * Android only: draw on a `SkiaSurfaceView` instead of the default
   * `SkiaTextureView`, dropping the per-frame GPU texture copy that janks
   * low-end Android.
   *
   * Trade-off: the canvas turns opaque (no transparent background) and may
   * ignore the parent's clip on some Android versions. Best on a solid-color
   * background; test your layout. Ignored on iOS, so pass it freely.
   * Default: `false`.
   */
  opaque?: boolean;

  /** When `false`, value changes apply instantly. Default: `true`. */
  animated?: boolean;

  /**
   * Decide whether each value change should animate. Receives the previous and
   * next `value`. Return `true` to animate, or `false` to jump straight to the
   * new number with no animation. Useful when you only want to animate
   * meaningful changes and ignore tiny updates or huge jumps.
   *
   * Note: when `format.style` is `"percent"`, the values passed in are
   * pre-scaled by 100 (matching `valueTiming`'s callback), so `0.42` arrives as
   * `42`.
   *
   * Ignored when `animated` is `false`.
   *
   * @example
   * // Only animate when the change is at least 1
   * shouldAnimate={(prev, next) => Math.abs(next - prev) >= 1}
   */
  shouldAnimate?: (prev: number, next: number) => boolean;

  /** Tween for the master value (drives digit roll). Pass a function to scale with delta. */
  valueTiming?: ValueTiming;

  /** Tween for slot width + blur (bloom in / collapse out). Default: 280ms `Easing.out(cubic)`. */
  entranceTiming?: TimingConfig;

  /** Tween for symbol slot entrance (commas, decimals, currency). Default: 190ms `Easing.out(cubic)`. */
  symbolEntranceTiming?: TimingConfig;

  /** Tween for slot opacity. Default: 300ms ease. */
  opacityTiming?: TimingConfig;

  /** Bloom blur radius in points. `0` disables. Default: 2. */
  bloomBlur?: number;

  /**
   * Upper bound on integer digits. Needed for performance. `5` fits up to
   * 99,999, `6` up to 999,999, etc. If the value exceeds the cap, extra
   * digits are still allocated (floor, not ceiling).
   *
   * Default: `5`.
   */
  maxIntegerDigits?: number;

  /** Minimum gap between consecutive bloom entrances, in ms. Default: 150. */
  staggerGap?: number;

  /** Fired when an animated update begins. */
  onAnimationStart?: () => void;

  /** Fired when all animated updates settle. */
  onAnimationEnd?: () => void;

  /**
   * Ref forwarded to the internal Skia `<Canvas>`. Create with `useCanvasRef()`.
   * Lets you call `redraw()` to repaint in place — e.g. to recover a canvas
   * that paints blank after a long background
   * (https://github.com/Shopify/react-native-skia/issues/3695) without
   * remounting.
   */
  canvasRef?: RefObject<CanvasRef | null>;
}
