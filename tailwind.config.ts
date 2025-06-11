import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        // Airbnb-inspired brand colors
        primary: "var(--primary)",
        secondary: "var(--secondary)", 
        accent: "var(--accent)",
        neutral: "var(--neutral)",
        // Additional color utilities
        border: "var(--border-color)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-accent": "var(--text-accent)",
      },
    },
  },
  plugins: [],
} satisfies Config;