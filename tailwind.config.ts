import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tv: {
          bg: "#10110E",             // Deep charcoal / warm black
          surface: "#191A15",        // Primary surface: Dark charcoal
          surfaceHover: "#20221B",
          surfaceActive: "#25261F",   // Secondary surface: Warm graphite
          surfaceMuted: "#141511",
          border: "#2A2C23",         // Subtle warm grey border
          borderSubtle: "rgba(182, 173, 131, 0.12)",
          borderActive: "#B6AD83",   // Muted olive
          accent: "#B6AD83",         // Accent: Muted olive
          accentHover: "#C4BB91",
          accentMuted: "rgba(182, 173, 131, 0.15)",
          highlight: "#D5CBA8",      // Highlight: Soft champagne / ivory
          textPrimary: "#F1EEE3",    // Text: Warm ivory
          textSecondary: "#A8A69A",  // Warm grey
          textMuted: "#737267",      // Muted graphite grey
          danger: "#C95D53",         // Subtle terracotta red (no bright neon)
          dangerMuted: "rgba(201, 93, 83, 0.15)",
          success: "#8F9E6D",        // Muted sage green
          successMuted: "rgba(143, 158, 109, 0.15)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Display'",
          "'SF Pro Text'",
          "'Inter'",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        remoteButton: "0 3px 10px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(241, 238, 227, 0.05)",
        remoteButtonActive: "0 1px 3px 0 rgba(0, 0, 0, 0.6), inset 0 1px 2px 0 rgba(0, 0, 0, 0.5)",
        remotePad: "0 12px 36px 0 rgba(0, 0, 0, 0.75), inset 0 1px 1px 0 rgba(241, 238, 227, 0.08)",
        dpadCenter: "0 4px 14px 0 rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(213, 203, 168, 0.18)",
        card: "0 4px 20px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 0 rgba(241, 238, 227, 0.04)",
        activeOliveGlow: "0 0 16px 0 rgba(182, 173, 131, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
