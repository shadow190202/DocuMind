/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          body: "var(--bg-body)",
          panel: "var(--bg-panel)",
          divider: "var(--border-divider)",
          text: "var(--text-main)",
          muted: "var(--text-muted)",
          primary: "var(--bg-primary)",
          primaryHover: "var(--bg-primary-hover)",
          primaryBtn: "var(--text-primary-btn)",
          ai: "var(--bg-ai)",
          aiHover: "var(--bg-ai-hover)",
          aiAccent: "var(--text-ai-accent)",
        },
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "var(--primary-foreground)",
        },
        ai: {
          DEFAULT: "var(--ai)",
          hover: "var(--ai-hover)",
          foreground: "var(--ai-foreground)",
          surface: "var(--ai-surface)",
          border: "var(--ai-border)",
        },
      },
    },
  },
  plugins: [],
};
