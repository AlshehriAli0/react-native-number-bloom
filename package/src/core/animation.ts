import { type SharedValue, withDelay, withTiming } from "react-native-reanimated";
import type { KeyedPart, NumberBloomProps, PartKind, TimingConfig } from "../types";

export interface SlotState {
  type: "digit" | "symbol";
  kind: PartKind;
  char: string;
  power: number;
  widthSV: SharedValue<number>;
  opacitySV: SharedValue<number>;
  blurSV: SharedValue<number>;
}

export type SlotMap = Map<string, SlotState>;

export const resolveValueTiming = (
  timing: NonNullable<NumberBloomProps["valueTiming"]>,
  prev: number,
  next: number
): TimingConfig => (typeof timing === "function" ? timing(prev, next) : timing);

export const makeSlot = (part: KeyedPart, makeMutableFn: (v: number) => SharedValue<number>): SlotState => ({
  type: part.type,
  kind: part.kind,
  char: part.char,
  power: part.power ?? 0,
  widthSV: makeMutableFn(0),
  opacitySV: makeMutableFn(0),
  blurSV: makeMutableFn(0),
});

/**
 * Add missing slots for the current parts and refresh the displayed glyph for
 * existing symbol slots. Returns true if any symbol glyph changed in place
 * (e.g. currency $→€, compact K→M, a locale's group separator) so the caller
 * can rebuild views when the slot order is otherwise unchanged.
 */
export const ensureSlots = (
  slotsMap: SlotMap,
  parts: readonly KeyedPart[],
  makeMutableFn: (v: number) => SharedValue<number>
): boolean => {
  let glyphChanged = false;
  for (const part of parts) {
    const existing = slotsMap.get(part.key);
    if (!existing) {
      slotsMap.set(part.key, makeSlot(part, makeMutableFn));
    } else if (part.type === "symbol" && existing.char !== part.char) {
      existing.char = part.char;
      glyphChanged = true;
    }
  }
  return glyphChanged;
};

/** Longest total animation duration across all tracks, plus a one-frame slack. */
export const computeLongestDuration = (
  delays: Map<string, number>,
  digitWidthMs: number,
  symbolWidthMs: number,
  opacityMs: number,
  valueMs: number
): number => {
  let maxDelay = 0;
  for (const d of delays.values()) if (d > maxDelay) maxDelay = d;
  const tail = Math.max(digitWidthMs, symbolWidthMs, opacityMs, valueMs);
  return maxDelay + tail + 32;
};

export interface AnimateParams {
  bloomBlur: number;
  opacityTiming: TimingConfig;
  valueTiming: TimingConfig;
}

/** Per-slot instruction pre-built on the JS thread; the worklet only consumes plain arrays/objects. */
export interface SlotInstruction {
  widthSV: SharedValue<number>;
  opacitySV: SharedValue<number>;
  blurSV: SharedValue<number>;
  /** Target width, or 0 for an exiting slot. */
  target: number;
  /** Delay in ms before the entrance/exit animation starts. */
  delay: number;
  /** Per-slot tween duration for width/blur. */
  widthMs: number;
  /** Per-slot easing for width/blur — symbols and digits use different tweens. */
  widthEasing: TimingConfig["easing"];
  /** True if this slot is entering this frame (gets a bloom blur kick). */
  entering: boolean;
  /** True if this slot is leaving this frame (animate out). */
  exiting: boolean;
}

export interface WorkletPayload {
  instructions: SlotInstruction[];
  params: AnimateParams;
  value: number;
  valueSV: SharedValue<number>;
}

export interface SnapInstruction {
  widthSV: SharedValue<number>;
  opacitySV: SharedValue<number>;
  blurSV: SharedValue<number>;
  /** Target width; 0 if this slot should be invisible after the snap. */
  target: number;
}

/** Snap every slot to its final state (no animation). Used on first mount and when `animated` is false. */
export const snapToTargets = (instructions: SnapInstruction[], value: number, valueSV: SharedValue<number>) => {
  "worklet";
  valueSV.set(value);
  for (let i = 0; i < instructions.length; i++) {
    const inst = instructions[i];
    if (!inst) continue;
    if (inst.target > 0) {
      inst.widthSV.set(inst.target);
      inst.opacitySV.set(1);
      inst.blurSV.set(0);
    } else {
      inst.widthSV.set(0);
      inst.opacitySV.set(0);
      inst.blurSV.set(0);
    }
  }
};

/** UI-thread bloom animation for one transition. All SharedValue writes happen here in a single batch. */
export const animateSlots = (payload: WorkletPayload) => {
  "worklet";
  const { instructions, params, value, valueSV } = payload;
  const { bloomBlur, opacityTiming, valueTiming } = params;

  valueSV.set(withTiming(value, valueTiming));

  for (let i = 0; i < instructions.length; i++) {
    const inst = instructions[i];
    if (!inst) continue;
    const wDur = inst.widthMs;
    const wEase = inst.widthEasing;

    if (inst.exiting) {
      inst.widthSV.set(withDelay(inst.delay, withTiming(0, { duration: wDur, easing: wEase })));
      inst.opacitySV.set(withDelay(inst.delay, withTiming(0, opacityTiming)));
      if (bloomBlur > 0) {
        inst.blurSV.set(0);
        inst.blurSV.set(withDelay(inst.delay, withTiming(bloomBlur, { duration: wDur, easing: wEase })));
      }
    } else {
      inst.widthSV.set(withDelay(inst.delay, withTiming(inst.target, { duration: wDur, easing: wEase })));
      inst.opacitySV.set(withDelay(inst.delay, withTiming(1, opacityTiming)));
      if (inst.entering && bloomBlur > 0) {
        inst.blurSV.set(bloomBlur);
        inst.blurSV.set(withDelay(inst.delay, withTiming(0, { duration: wDur, easing: wEase })));
      } else {
        inst.blurSV.set(withDelay(inst.delay, withTiming(0, { duration: wDur, easing: wEase })));
      }
    }
  }
};
