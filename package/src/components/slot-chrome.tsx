import { Blur, Group, Paint } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";

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
            <Blur blur={blur} mode="clamp" />
          </Paint>
        }
      >
        {children}
      </Group>
    </Group>
  );
};
