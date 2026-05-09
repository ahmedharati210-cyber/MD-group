import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: {
          50: "#f5f3f0",
          100: "#e8e0d6",
          200: "#d1c0ad",
          300: "#baa084",
          400: "#a3805b",
          500: "#8c6032", // Main brown from logo text
          600: "#704d28",
          700: "#543a1e",
          800: "#382714",
          900: "#1c140a",
        },
        secondary: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444", // Red accent from logo
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        accent: {
          light: "#d1d5db", // Light gray
          DEFAULT: "#4b5563", // Medium gray from logo
          dark: "#1f2937", // Dark gray/black from logo
        },
      },
    },
  },
  plugins: [],
};
export default config;

