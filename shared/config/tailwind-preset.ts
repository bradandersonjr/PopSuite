import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import path from "path";

/**
 * Shared Tailwind config for PopSuite apps.
 * App-relative globs resolve against the process CWD (the app root). pop-shared
 * is a sibling of the app, so its source is referenced by an absolute POSIX glob
 * (a leading "../" glob is unreliable with fast-glob).
 */
const sharedSrc = path.resolve(process.cwd(), "../pop-shared/src").replace(/\\/g, "/");

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", `${sharedSrc}/**/*.{ts,tsx}`],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        brand: ['"Cherry Bomb One"', 'cursive'],
        display: ['"Space Mono"', 'monospace'],
        body: ['"Space Grotesk"', 'sans-serif'],
        comfortaa: ['"Comfortaa"', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "pop-blue": "hsl(var(--pop-blue))",
        "pop-orange": "hsl(var(--pop-orange))",
        "pop-pink": "hsl(var(--pop-pink))",
        "pop-yellow": "hsl(var(--pop-yellow))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "float": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-8px) rotate(1deg)" },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
      },
      animation: {
        "float": "float 3s ease-in-out infinite",
        "wiggle": "wiggle 2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
