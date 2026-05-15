<h1 align="center">React Native Number Bloom</h1>

<p align="center" style="font-size: 1.2em;">
  Skia-powered animated numbers for React Native. Digits bloom in, collapse out.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-number-bloom"><img src="https://img.shields.io/npm/v/react-native-number-bloom" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/react-native-number-bloom"><img src="https://img.shields.io/npm/dm/react-native-number-bloom" alt="npm downloads" /></a>
  <a href="https://github.com/alialshehri/react-native-number-bloom/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-number-bloom" alt="license" /></a>
</p>

## Features

- **Bloom & collapse**: digits blur in with a width tween as the value grows, and reverse on shrink
- **Full `Intl.NumberFormat`**: currency, percent, units, compact notation, grouping, locales
- **Single master tween**: every digit derives from one `SharedValue` so the JS thread never throttles the animation
- **Threshold-staggered**: a new tens slot blooms in *as the value crosses 10*, not before
- **Customizable**: easings, durations, blur, stagger gap, fonts, colors
- **New architecture only**: built for Fabric + TurboModules

## Installation

```bash
# using bun
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

## Compatibility

The package targets new-architecture apps. Minimum peer versions:

| peer                            | min     |
| ------------------------------- | ------- |
| `react`                         | 19.0.0  |
| `react-native`                  | 0.78.0  |
| `@shopify/react-native-skia`    | 2.0.0   |
| `react-native-reanimated`       | 4.0.0   |
| `react-native-worklets`         | 0.5.0   |

## License

MIT
