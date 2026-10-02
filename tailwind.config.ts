import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Charte graphique Qonforme
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Primaires
        primary: {
          DEFAULT: "#2563EB",
          foreground: "#FFFFFF",
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          900: "#1E3A8A",
        },
        // Fond & bordures
        surface: "#F8FAFC",
        border: "#E2E8F0",
        dark: "#0F172A",
        // États
        success: "#10B981",
        error:   "#EF4444",
        warning: "#D97706",
        // Jetons du canevas (app/globals.css, --q-*) : thème sombre compris
        q: {
          bg:            "var(--q-bg)",
          surface:       "var(--q-surface)",
          "surface-2":   "var(--q-surface-2)",
          sunken:        "var(--q-sunken)",
          hover:         "var(--q-hover)",
          "row-hover":   "var(--q-row-hover)",
          line:          "var(--q-line)",
          "line-soft":   "var(--q-line-soft)",
          field:         "var(--q-field)",
          ink:           "var(--q-ink)",
          "ink-strong":  "var(--q-ink-strong)",
          "text-2":      "var(--q-text-2)",
          "text-3":      "var(--q-text-3)",
          "text-4":      "var(--q-text-4)",
          placeholder:   "var(--q-placeholder)",
          accent:        "var(--q-accent)",
          "accent-strong": "var(--q-accent-strong)",
          "accent-ink":  "var(--q-accent-ink)",
          wash:          "var(--q-wash)",
          "wash-line":   "var(--q-wash-line)",
          ok:            "var(--q-ok)",
          "ok-bg":       "var(--q-ok-bg)",
          info:          "var(--q-info)",
          "info-bg":     "var(--q-info-bg)",
          warn:          "var(--q-warn)",
          "warn-bg":     "var(--q-warn-bg)",
          "warn-line":   "var(--q-warn-line)",
          danger:        "var(--q-danger)",
          "danger-bg":   "var(--q-danger-bg)",
          "danger-line": "var(--q-danger-line)",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "DM Mono", "JetBrains Mono", "monospace"],
        display: ["var(--font-bricolage)", "Bricolage Grotesque", "system-ui", "sans-serif"],
        serif: ["var(--font-serif-accent)", "Instrument Serif", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // ShimmerButton keyframes
        "shimmer-slide": {
          to: { transform: "translate(calc(100cqw - 100%), 0)" },
        },
        "spin-around": {
          "0%": { transform: "translateZ(0) rotate(0)" },
          "15%, 35%": { transform: "translateZ(0) rotate(90deg)" },
          "65%, 85%": { transform: "translateZ(0) rotate(270deg)" },
          "100%": { transform: "translateZ(0) rotate(360deg)" },
        },
        // Marquee logos
        marquee: {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(-50%)" },
        },
        // Aurora keyframes — déplace le background-position pour l'effet mouvant
        aurora: {
          "0%":   { backgroundPosition: "0% 50%" },
          "25%":  { backgroundPosition: "50% 0%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "75%":  { backgroundPosition: "50% 100%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "shimmer-slide": "shimmer-slide var(--speed) ease-in-out infinite alternate",
        "spin-around": "spin-around calc(var(--speed) * 2) infinite linear",
        marquee: "marquee 28s linear infinite",
        aurora: "aurora 30s linear infinite",
      },
    },
  },
  plugins: [
    animate,
    // États posés par Base UI sur les fenêtres, menus et feuilles (data-open, data-closed…) :
    // les primitives de components/ui les utilisent pour leurs animations d'ouverture.
    plugin(({ addVariant }) => {
      addVariant("data-open", "&[data-open]")
      addVariant("data-closed", "&[data-closed]")
      addVariant("data-starting-style", "&[data-starting-style]")
      addVariant("data-ending-style", "&[data-ending-style]")
    }),
  ],
};

export default config;
