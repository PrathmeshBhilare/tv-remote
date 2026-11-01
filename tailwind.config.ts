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
          bg: "#0B0E14",
          surface: "#141923",
          surfaceHover: "#1E2536",
          surfaceActive: "#283248",
          border: "#20283A",
          borderActive: "#3B82F6",
          accent: "#3B82F6",
          accentHover: "#2563EB",
          accentMuted: "rgba(59, 130, 246, 0.15)",
          danger: "#EF4444",
          dangerHover: "#DC2626",
          dangerMuted: "rgba(239, 68, 68, 0.15)",
          success: "#10B981",
          warning: "#F59E0B",
          textPrimary: "#F8FAFC",
          textSecondary: "#94A3B8",
          textMuted: "#64748B",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        remoteButton: "0 4px 14px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        remotePad: "0 8px 24px 0 rgba(0, 0, 0, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)",
        activeGlow: "0 0 20px 2px rgba(59, 130, 246, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;

