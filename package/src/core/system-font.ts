import { type SkFont, Skia } from "@shopify/react-native-skia";
import { Platform } from "react-native";

// Empty family name doesn't match anything on iOS; try platform-appropriate names in order.
const FALLBACK_FAMILIES: readonly string[] = Platform.select({
  ios: ["Helvetica Neue", "Helvetica", "Arial"],
  android: ["Roboto", "sans-serif"],
  default: [""],
}) ?? [""];

/** System-fallback Skia font used when no `font` is supplied. Returns null if unavailable. */
export const resolveSystemFont = (fontSize: number, weight = 700): SkFont | null => {
  const mgr = Skia.FontMgr.System();
  for (const family of FALLBACK_FAMILIES) {
    const tf = mgr.matchFamilyStyle(family, { weight });
    if (tf) return Skia.Font(tf, fontSize);
  }
  return null;
};
