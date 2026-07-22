import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        purple: {
          primary: "#a855f7",
          hover: "#9333ea",
          active: "#7e22ce",
          light: "#c084fc",
        },
        dark: {
          bg: "#0f0a1a",
          surface: "#1a1025",
        },
      },
    },
  },
  plugins: [],
};
export default config;
