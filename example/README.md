# Example

Expo app demoing `react-native-number-bloom`. It links the local package via the bun workspace, so changes in `../package/src` hot-reload here.

## Prerequisites

- [Bun](https://bun.sh)
- Xcode (for iOS), including the iOS simulator
- Android Studio (for Android), with an emulator or device set up

## Setup

From the **monorepo root** (one level up):

```bash
bun install
```

Then generate native projects (Expo runs `pod install` automatically):

```bash
cd example
bunx expo prebuild
```

## Run

```bash
bun ios       # iOS simulator
bun android   # Android emulator
bun start     # Metro only (pick a target from the UI)
```

## Edit

- App entry: `App.tsx`
- Component source: `../package/src/number-bloom.tsx`

Saving either reloads via Fast Refresh.
