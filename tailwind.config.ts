// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        canvas: "#0A0A0A",
        surface: {
          DEFAULT: "#121212",
          hover: "#171717",
          active: "#1E1E1E",
        },
        content: {
          DEFAULT: "#FAFAFA",
          muted: "#A1A1AA",
        },
        divider: "rgba(255, 255, 255, 0.1)",
        accent: {
          primary: "#06B6D4",
        },
      },
      boxShadow: {
        stamped:
          "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 0 rgba(255,255,255,0.1)",
        "stamped-hover":
          "inset 0 0 0 1px rgba(255,255,255,0.15), inset 0 1px 0 0 rgba(255,255,255,0.2)",
      },
      transitionTimingFunction: {
        snappy: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        "250": "250ms",
      },
      animation: {
        "fade-up": "fadeUp 300ms cubic-bezier(0.16,1,0.3,1) forwards",
        blink: "blink 1s step-end infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      maxWidth: {
        reading: "65ch",
      },
    },
  },
  plugins: [],
};
export default config;
