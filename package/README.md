<h1 align="center">React Native Number Bloom</h1>

<p align="center" style="font-size: 1.2em;">
  Smooth animated numbers for React Native. Digits roll, fade, and blur as the value changes.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-number-bloom"><img src="https://img.shields.io/npm/v/react-native-number-bloom" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/react-native-number-bloom"><img src="https://img.shields.io/npm/dm/react-native-number-bloom" alt="npm downloads" /></a>
  <a href="https://github.com/alialshehri/react-native-number-bloom/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-number-bloom" alt="license" /></a>
</p>

Drop-in animated number component rendered on Skia, with full `Intl.NumberFormat` support (currency, percent, locales, grouping, compact). Built for the New Architecture. Requires `@shopify/react-native-skia` 2.x.

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

## API

### `<NumberBloom />`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` | - | The number to display. Required. |
| `format` | `Intl.NumberFormatOptions` | - | Currency, percent, units, compact, grouping, fraction digits. |
| `locales` | `Intl.LocalesArgument` | - | BCP 47 locale(s). Controls separators and numbering system. |
| `prefix` | `string` | `""` | Static text prepended; animates in/out. |
| `suffix` | `string` | `""` | Static text appended; animates in/out. |
| `font` | `SkFont \| null` | system font | Pre-loaded Skia font, e.g. `useFont(require("./Inter-Bold.otf"), fontSize)`. |
| `fontSize` | `number` | `16` | Font size in points. |
| `color` | `string` | `"black"` | Text color. |
| `letterSpacing` | `number` | `0` | Extra space between glyphs, in points. |
| `animated` | `boolean` | `true` | When `false`, value changes apply instantly. |
| `bloomBlur` | `number` | `2` | Bloom blur radius in points. `0` disables. |
| `maxIntegerDigits` | `number` | `5` | Upper bound for pre-allocated digit slots. `5` fits up to 99,999; `6` up to 999,999. Needed for performance. |
| `valueTiming` | `TimingConfig \| (prev, next) => TimingConfig` | scales with delta | Tween for the master value (drives digit roll). |
| `entranceTiming` | `TimingConfig` | `{ duration: 280, easing: Easing.out(Easing.cubic) }` | Tween for digit slot width + blur. |
| `symbolEntranceTiming` | `TimingConfig` | `{ duration: 190, easing: Easing.out(Easing.cubic) }` | Tween for symbol slots (commas, decimals, currency). |
| `opacityTiming` | `TimingConfig` | `{ duration: 300, easing: bezier(0.25, 0.1, 0.25, 1) }` | Tween for slot opacity. |
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
