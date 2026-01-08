/** @type {import('tailwindcss').Config} */
module.exports = {
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
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px"
      }
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"]
      },
      colors: {
        // Background colors
        background: {
          DEFAULT: "hsl(var(--color-bg))",
          subtle: "hsl(var(--color-bg-subtle))",
          muted: "hsl(var(--color-bg-muted))"
        },
        // Surface colors
        surface: {
          DEFAULT: "hsl(var(--color-surface))",
          raised: "hsl(var(--color-surface-raised))",
          overlay: "hsl(var(--color-surface-overlay))"
        },
        // Border colors
        border: {
          DEFAULT: "hsl(var(--color-border))",
          subtle: "hsl(var(--color-border-subtle))",
          strong: "hsl(var(--color-border-strong))"
        },
        // Text colors
        foreground: {
          DEFAULT: "hsl(var(--color-text))",
          secondary: "hsl(var(--color-text-secondary))",
          muted: "hsl(var(--color-text-muted))",
          inverse: "hsl(var(--color-text-inverse))"
        },
        // Primary accent
        primary: {
          DEFAULT: "hsl(var(--color-primary))",
          hover: "hsl(var(--color-primary-hover))",
          subtle: "hsl(var(--color-primary-subtle))",
          foreground: "hsl(var(--color-primary-foreground))"
        },
        // Secondary
        secondary: {
          DEFAULT: "hsl(var(--color-secondary))",
          hover: "hsl(var(--color-secondary-hover))",
          foreground: "hsl(var(--color-secondary-foreground))"
        },
        // Accent
        accent: {
          DEFAULT: "hsl(var(--color-accent))",
          hover: "hsl(var(--color-accent-hover))",
          subtle: "hsl(var(--color-accent-subtle))"
        },
        // Semantic colors
        success: {
          DEFAULT: "hsl(var(--color-success))",
          subtle: "hsl(var(--color-success-subtle))"
        },
        warning: {
          DEFAULT: "hsl(var(--color-warning))",
          subtle: "hsl(var(--color-warning-subtle))"
        },
        error: {
          DEFAULT: "hsl(var(--color-error))",
          subtle: "hsl(var(--color-error-subtle))"
        },
        info: {
          DEFAULT: "hsl(var(--color-info))",
          subtle: "hsl(var(--color-info-subtle))"
        },
        // Ring color
        ring: "hsl(var(--ring-color))"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        full: "var(--radius-full)"
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
        "glow-strong": "var(--shadow-glow-strong)"
      },
      spacing: {
        "1": "var(--space-1)",
        "2": "var(--space-2)",
        "3": "var(--space-3)",
        "4": "var(--space-4)",
        "5": "var(--space-5)",
        "6": "var(--space-6)",
        "8": "var(--space-8)",
        "10": "var(--space-10)",
        "12": "var(--space-12)",
        "16": "var(--space-16)",
        "20": "var(--space-20)",
        "24": "var(--space-24)"
      },
      transitionDuration: {
        fast: "150ms",
        base: "200ms",
        slow: "300ms",
        spring: "400ms"
      },
      transitionTimingFunction: {
        "ease-out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" }
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" }
        },
        "typing-cursor": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "fade-in-down": "fade-in-down 0.5s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.4s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "typing-cursor": "typing-cursor 1s step-end infinite",
        float: "float 3s ease-in-out infinite",
        spin: "spin 1s linear infinite"
      }
    }
  },
  plugins: []
};
