import { Easing } from "react-native-reanimated";
import type { TimingConfig, ValueTiming } from "../types";

// Bigger deltas take longer, capped so huge jumps stay snappy.
export const DEFAULT_VALUE_TIMING: ValueTiming = (prev, next) => {
  const delta = Math.abs(next - prev);
  return {
    duration: 800 + Math.min(delta * 0.3, 500),
    easing: Easing.out(Easing.exp),
  };
};

// No overshoot: later slots' translateX is the cumulative width sum, so a bouncy width reads as a stutter.
export const DEFAULT_ENTRANCE_TIMING: TimingConfig = {
  duration: 280,
  easing: Easing.out(Easing.cubic),
};

export const DEFAULT_SYMBOL_ENTRANCE_TIMING: TimingConfig = {
  duration: 190,
  easing: Easing.out(Easing.cubic),
};

export const DEFAULT_OPACITY_TIMING: TimingConfig = {
  duration: 300,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export const DEFAULT_BLOOM_BLUR = 2;
export const DEFAULT_STAGGER_GAP_MS = 150;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_COLOR = "black";
export const DEFAULT_MAX_INTEGER_DIGITS = 5;

export const DIGIT_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
