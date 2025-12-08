/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "selector",
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"]
      },
      colors: {
        border: "hsl(var(--border, 0 0% 90%))",
        input: "hsl(var(--input, 0 0% 100%))",
        ring: "hsl(var(--ring, 0 0% 80%))",
        background: "hsl(var(--background, 0 0% 97%))",
        foreground: "hsl(var(--foreground, 0 0% 10%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 14 100% 60%))",
          foreground: "hsl(var(--primary-foreground, 0 0% 100%))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 240 5% 96%))",
          foreground: "hsl(var(--secondary-foreground, 240 6% 10%))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 240 5% 90%))",
          foreground: "hsl(var(--muted-foreground, 240 7% 40%))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 220 13% 91%))",
          foreground: "hsl(var(--accent-foreground, 222 47% 11%))"
        }
      },
      borderRadius: {
        lg: "var(--radius, 1rem)",
        md: "calc(var(--radius, 1rem) - 2px)",
        sm: "calc(var(--radius, 1rem) - 4px)"
      },
      keyframes: {
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" }
        },
        "float-slow": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(20px, -20px) scale(1.05)" }
        },
        "float-medium": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-15px, 15px) scale(1.1)" }
        },
        "float-fast": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(10px, 10px) scale(1.02)" }
        }
      },
      animation: {
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "float-slow": "float-slow 25s ease-in-out infinite",
        "float-medium": "float-medium 20s ease-in-out infinite",
        "float-fast": "float-fast 15s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
