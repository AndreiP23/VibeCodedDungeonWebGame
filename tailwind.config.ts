import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        ring: "var(--ring)",
        torch: "var(--torch)",
        torch2: "var(--torch2)",
        gold: "var(--gold)",
        fire: "var(--fire)",
        hp: "var(--hp)",
        mp: "var(--mp)",
        xp: "var(--xp)",
        "gem-blue": "var(--gem-blue)",
        "gem-red": "var(--gem-red)",
        "gem-purple": "var(--gem-purple)",
        "gem-green": "var(--gem-green)",
        "text-dim": "var(--text-dim)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      fontFamily: {
        display: ["var(--font-display)", "Press Start 2P", "monospace"],
        body: ["var(--font-body)", "VT323", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
