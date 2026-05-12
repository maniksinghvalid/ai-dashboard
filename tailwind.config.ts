import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          DEFAULT: "#7c6eff",
          50: "#f3f0ff",
          100: "#e9e3ff",
          200: "#d4c9ff",
          300: "#b5a1ff",
          400: "#9b7fff",
          500: "#7c6eff",
          600: "#6c4fff",
          700: "#5a3de6",
          800: "#4a32bf",
          900: "#3d2b99",
          950: "#231a5c",
        },
        "accent-secondary": "#c084fc",
        platform: {
          youtube: "#ff3333",
          reddit: "#ff5700",
          x: "#e7e7f0",
        },
        surface: {
          DEFAULT: "#0d0d1f",
          2: "#13132b",
          dark: "#060610",
        },
        border: "var(--border)",
        green: {
          DEFAULT: "#22d3a5",
          400: "#22d3a5",
          500: "#22d3a5",
        },
        red: {
          DEFAULT: "#ff5c6a",
          400: "#ff5c6a",
          500: "#ff5c6a",
        },
        amber: {
          DEFAULT: "#ffb830",
          400: "#ffb830",
          500: "#ffb830",
        },
        muted: "#6b668a",
      },
      spacing: {
        widget: "1.5rem",
        "widget-lg": "2rem",
      },
      fontSize: {
        "widget-title": [
          "1.125rem",
          { lineHeight: "1.5", fontWeight: "600" },
        ],
        "widget-value": ["2rem", { lineHeight: "1.2", fontWeight: "700" }],
      },
      borderRadius: {
        widget: "0.75rem",
      },
      keyframes: {
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
      },
      animation: {
        "ticker-scroll": "ticker-scroll 35s linear infinite",
        "live-blink": "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
