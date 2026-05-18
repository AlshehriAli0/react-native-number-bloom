<h1 align="center">React Native Number Bloom</h1>

<p align="center" style="font-size: 1.2em;">
  Smooth animated numbers for React Native. Digits roll, fade, and blur as the value changes.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-number-bloom"><img src="https://img.shields.io/npm/v/react-native-number-bloom" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/react-native-number-bloom"><img src="https://img.shields.io/npm/dm/react-native-number-bloom" alt="npm downloads" /></a>
  <a href="https://github.com/AlshehriAli0/react-native-number-bloom/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-number-bloom" alt="license" /></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/AlshehriAli0/react-native-number-bloom/main/.github/demo.gif" alt="demo" width="720" />
</p>

Animated number component rendered on Skia, with full `Intl.NumberFormat` support (currency, percent, locales, grouping, compact). Built for the New Architecture. Requires `@shopify/react-native-skia` 2.x.

Unlike a typical odometer that rolls loudly through every digit, NumberBloom snaps to the new value with a soft bloom effect. The result feels smooth and calm, never overwhelming, even on rapidly changing numbers.

## Features

- **Fast even on low-end devices.** GPU-accelerated rendering through Skia, with animations running on the UI thread via Reanimated and Worklets, so the JS thread stays free. React Compiler safe.
- **Bloom, not odometer.** A soft snap-and-bloom transition instead of a noisy digit roll, easier on the eye for rapidly changing values.
- **Full `Intl.NumberFormat` support.** Currency, percent, units, compact, locales, grouping, fraction digits.
- **RTL support.** Renders correctly under `I18nManager.forceRTL(true)` and Arabic locales.
- **Conditional animation.** `shouldAnimate(prev, next)` decides per update whether to animate or jump straight to the new number.
- **Stable layout.** Pre-allocated digit slots keep the width steady as numbers grow, so surrounding UI never shifts.

## Installation

You'll need `@shopify/react-native-skia`, `react-native-reanimated`, and `react-native-worklets` installed alongside this package. Each has its own native setup. Follow their install guides:

- [Skia install guide](https://shopify.github.io/react-native-skia/docs/getting-started/installation)
- [Reanimated install guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started)
- [Worklets install guide](https://docs.swmansion.com/react-native-worklets/docs/)

**Already have the peer deps installed:**

```bash
bun add react-native-number-bloom
```

**Fresh install (peers included):**

```bash
bun add react-native-number-bloom @shopify/react-native-skia react-native-reanimated react-native-worklets
```

## Quick start

```tsx
import { useState } from "react";
import { NumberBloom } from "react-native-number-bloom";

export function PriceDisplay() {
  const [price, setPrice] = useState(42.99);
  return (
    <NumberBloom
      value={price}
      format={{ style: "currency", currency: "USD" }}
      fontSize={32}
      color="#000"
    />
  );
}
```

Customized example with locale and currency formatting, sizing, bloom and stagger tuning, and conditional animation:

```tsx
import { useEffect, useState } from "react";
import { Easing } from "react-native-reanimated";
import { NumberBloom } from "react-native-number-bloom";

export function LiveTicker({ stream }: { stream: () => number }) {
  const [price, setPrice] = useState(1234.56);

  useEffect(() => {
    const id = setInterval(() => setPrice(stream()), 250);
    return () => clearInterval(id);
  }, [stream]);

  return (
    <NumberBloom
      value={price} // the number to display; changes animate
      locales="de-DE" // BCP 47 locale; controls grouping/decimal marks (1.234,56)
      format={{ style: "currency", currency: "EUR" }} // Intl.NumberFormat options
      fontSize={40} // font size in points
      color="#0a84ff" // text color
      bloomBlur={4} // bloom blur radius; 0 disables the glow
      letterSpacing={0.5} // extra space between glyphs
      maxIntegerDigits={6} // pre-allocates digit slots; 6 fits up to 999,999
      staggerGap={80} // min ms between consecutive digit bloom entrances
      entranceTiming={{ duration: 360, easing: Easing.out(Easing.cubic) }} // duration and easing for digits blooming in
      shouldAnimate={(prev, next) => Math.abs(next - prev) >= 0.01} // only animate when the change is at least 1 cent; smaller jumps snap instantly
      onAnimationEnd={() => console.log("settled at", price)} // fires once all updates settle
    />
  );
}
```

## API

### `<NumberBloom />`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` | - | The number to display. Required. |
| `format` | `Intl.NumberFormatOptions` | - | Currency, percent, units, compact, grouping, fraction digits. |
| `locales` | `Intl.LocalesArgument` | - | BCP 47 locale(s). Controls separators and numbering system. |
| `prefix` | `string` | - | Static text prepended; animates in/out. |
| `suffix` | `string` | - | Static text appended; animates in/out. |
| `font` | `SkFont \| null` | system font | Pre-loaded Skia font, e.g. `useFont(require("./Inter-Bold.otf"), fontSize)`. |
| `fontSize` | `number` | `16` | Font size in points. |
| `color` | `string` | `"black"` | Text color. |
| `letterSpacing` | `number` | `0` | Extra space between glyphs, in points. |
| `animated` | `boolean` | `true` | When `false`, value changes apply instantly. |
| `shouldAnimate` | `(prev, next) => boolean` | - | Decide whether each value change should animate. Return `true` to animate, or `false` to jump straight to the new number. Useful for skipping tiny updates or huge jumps. When `format.style` is `"percent"`, the values are pre-scaled by 100 (so `0.42` arrives as `42`). Ignored when `animated` is `false`. |
| `bloomBlur` | `number` | `2` | Bloom blur radius in points. `0` disables. |
| `maxIntegerDigits` | `number` | `5` | Upper bound for pre-allocated digit slots. `5` fits up to 99,999; `6` up to 999,999. Needed for performance. |
| `valueTiming` | `TimingConfig \| (prev, next) => TimingConfig` | scales with delta | Animation that drives the digit roll between values. |
| `entranceTiming` | `TimingConfig` | `{ duration: 280, easing: Easing.out(Easing.cubic) }` | Animation for digits blooming in (width + blur). |
| `symbolEntranceTiming` | `TimingConfig` | `{ duration: 190, easing: Easing.out(Easing.cubic) }` | Animation for symbols blooming in (commas, decimals, currency). |
| `opacityTiming` | `TimingConfig` | `{ duration: 300, easing: bezier(0.25, 0.1, 0.25, 1) }` | Animation for slot fade in/out. |
| `staggerGap` | `number` | `150` | Minimum ms between consecutive bloom entrances. |
| `onAnimationStart` | `() => void` | - | Fires when an animated update begins. |
| `onAnimationEnd` | `() => void` | - | Fires after all updates settle. |

### Types

```ts
interface TimingConfig {
  duration: number;
  easing: EasingFunction | EasingFunctionFactory;
}

type ValueTiming = TimingConfig | ((prev: number, next: number) => TimingConfig);
```

## Compatibility

| peer                            | min     |
| ------------------------------- | ------- |
| `react`                         | 19.0.0  |
| `react-native`                  | 0.78.0  |
| `@shopify/react-native-skia`    | 2.0.0   |
| `react-native-reanimated`       | 4.0.0   |
| `react-native-worklets`         | 0.5.0   |

## License

MIT
