/**
 * High-Contrast Dark-Mode UI Multiplier Color Engine (1.00x - 50.00x)
 * Granular HEX color mapping specifically calibrated for deep navy (#0A0E17)
 * and pure black (#000000) canvas backgrounds.
 */

export interface MultiplierColorTier {
  color: string;        // Text & glow color HEX
  borderColor: string;  // Explicit border color
  bgColor: string;      // Background tint
  shadow: string;       // Box shadow glow
  label: string;        // Descriptive tier name
  min: number;
  max: number;
}

export function getMultiplierColorTier(val: number): MultiplierColorTier {
  const v = Math.round(val * 100) / 100;

  if (v < 2.00) {
    // 1.00x - 1.99x: Pure White / Ice Blue -> HEX: #FFFFFF / #00E5FF
    return {
      color: "#00E5FF",
      borderColor: "rgba(0, 229, 255, 0.85)",
      bgColor: "rgba(0, 229, 255, 0.15)",
      shadow: "0 0 10px rgba(0, 229, 255, 0.45)",
      label: "Pure White / Ice Blue",
      min: 1.00,
      max: 1.99,
    };
  } else if (v < 3.00) {
    // 2.00x - 2.99x: Vibrant Lime Green -> HEX: #00FF66
    return {
      color: "#00FF66",
      borderColor: "rgba(0, 255, 102, 0.85)",
      bgColor: "rgba(0, 255, 102, 0.15)",
      shadow: "0 0 12px rgba(0, 255, 102, 0.45)",
      label: "Vibrant Lime Green",
      min: 2.00,
      max: 2.99,
    };
  } else if (v < 4.00) {
    // 3.00x - 3.99x: Bright Electric Yellow -> HEX: #FFEA00
    return {
      color: "#FFEA00",
      borderColor: "rgba(255, 234, 0, 0.85)",
      bgColor: "rgba(255, 234, 0, 0.15)",
      shadow: "0 0 12px rgba(255, 234, 0, 0.45)",
      label: "Bright Electric Yellow",
      min: 3.00,
      max: 3.99,
    };
  } else if (v < 5.00) {
    // 4.00x - 4.99x: Radiant Vivid Orange -> HEX: #FF9100
    return {
      color: "#FF9100",
      borderColor: "rgba(255, 145, 0, 0.85)",
      bgColor: "rgba(255, 145, 0, 0.15)",
      shadow: "0 0 14px rgba(255, 145, 0, 0.50)",
      label: "Radiant Vivid Orange",
      min: 4.00,
      max: 4.99,
    };
  } else if (v < 7.00) {
    // 5.00x - 6.99x: Hot Neon Pink -> HEX: #FF007F
    return {
      color: "#FF007F",
      borderColor: "rgba(255, 0, 127, 0.85)",
      bgColor: "rgba(255, 0, 127, 0.15)",
      shadow: "0 0 16px rgba(255, 0, 127, 0.55)",
      label: "Hot Neon Pink",
      min: 5.00,
      max: 6.99,
    };
  } else if (v < 10.00) {
    // 7.00x - 9.99x: Electric Violet -> HEX: #B000FF
    return {
      color: "#B000FF",
      borderColor: "rgba(176, 0, 255, 0.85)",
      bgColor: "rgba(176, 0, 255, 0.15)",
      shadow: "0 0 18px rgba(176, 0, 255, 0.60)",
      label: "Electric Violet",
      min: 7.00,
      max: 9.99,
    };
  } else if (v < 20.00) {
    // 10.00x - 19.99x: Brilliant Gold -> HEX: #FFD700
    return {
      color: "#FFD700",
      borderColor: "rgba(255, 215, 0, 0.85)",
      bgColor: "rgba(255, 215, 0, 0.15)",
      shadow: "0 0 20px rgba(255, 215, 0, 0.70)",
      label: "Brilliant Gold",
      min: 10.00,
      max: 19.99,
    };
  } else if (v === 20.00) {
    // 20.00x (Real Player Max Win Cap): Platinum Cyan Diamond -> HEX: #00FFFF
    return {
      color: "#00FFFF",
      borderColor: "rgba(0, 255, 255, 0.90)",
      bgColor: "rgba(0, 255, 255, 0.20)",
      shadow: "0 0 24px rgba(0, 255, 255, 0.90)",
      label: "Platinum Cyan Diamond (Max Cap)",
      min: 20.00,
      max: 20.00,
    };
  } else if (v < 30.00) {
    // 20.01x - 29.99x (Bot High Win): Deep Neon Purple -> HEX: #A000FF
    return {
      color: "#A000FF",
      borderColor: "rgba(160, 0, 255, 0.85)",
      bgColor: "rgba(160, 0, 255, 0.15)",
      shadow: "0 0 22px rgba(160, 0, 255, 0.75)",
      label: "Deep Neon Purple (Bot High Win)",
      min: 20.01,
      max: 29.99,
    };
  } else if (v < 40.00) {
    // 30.00x - 39.99x (Bot Super Win): Electric Magenta -> HEX: #FF00E5
    return {
      color: "#FF00E5",
      borderColor: "rgba(255, 0, 229, 0.85)",
      bgColor: "rgba(255, 0, 229, 0.15)",
      shadow: "0 0 26px rgba(255, 0, 229, 0.85)",
      label: "Electric Magenta (Bot Super Win)",
      min: 30.00,
      max: 39.99,
    };
  } else {
    // 40.00x - 50.00x (Bot Ultra FOMO Spike): Hyper Crimson Red -> HEX: #FF0033
    return {
      color: "#FF0033",
      borderColor: "rgba(255, 0, 51, 0.90)",
      bgColor: "rgba(255, 0, 51, 0.20)",
      shadow: "0 0 30px rgba(255, 0, 51, 0.95)",
      label: "Hyper Crimson Red (Ultra FOMO Spike)",
      min: 40.00,
      max: 50.00,
    };
  }
}
