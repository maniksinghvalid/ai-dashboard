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
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
        },
        surface: {
          DEFAULT: "#111827",
          light: "#1f2937",
          dark: "#0b1120",
        },
      },
      spacing: {
        "widget": "1.5rem",
        "widget-lg": "2rem",
      },
      fontSize: {
        "widget-title": ["1.125rem", { lineHeight: "1.5", fontWeight: "600" }],
        "widget-value": ["2rem", { lineHeight: "1.2", fontWeight: "700" }],
      },
      borderRadius: {
        "widget": "0.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
