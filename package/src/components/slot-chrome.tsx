import { Blur, Group, Paint } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";

interface SlotChromeProps {
  transform: SharedValue<{ translateX: number }[]>;
  opacity: SharedValue<number>;
  blur: SharedValue<number>;
  /** When 0, skip the blur layer entirely — a per-slot offscreen GPU buffer is expensive at idle. */
  bloomEnabled: boolean;
  children: ReactNode;
}

/** Per-slot wrapper for opacity + (optional) blur + translateX. */
export const SlotChrome = ({ transform, opacity, blur, bloomEnabled, children }: SlotChromeProps) => {
  // Snap the animated blur radius to 0.25-pt steps. Skia's blur-mask cache keys
  // on sigma, so the raw tween (a unique float every vsync) misses the cache and
  // recomputes the Gaussian each frame for every entering slot. Quantizing turns
  // a 0→2 ramp into ~8 cache keys; the step is too small to see mid-bloom.
  const quantizedBlur = useDerivedValue(() => {
    "worklet";
    return Math.round(blur.get() * 4) / 4;
  });
  if (!bloomEnabled) {
    return (
      <Group transform={transform} opacity={opacity}>
        {children}
      </Group>
    );
  }
  return (
    <Group transform={transform}>
      <Group
        layer={
          <Paint opacity={opacity}>
            <Blur blur={quantizedBlur} mode="clamp" />
          </Paint>
        }
      >
        {children}
      </Group>
    </Group>
  );
};
