import type { Config } from "tailwindcss";

/**
 * 设计 token 直接映射到参考 HTML 的 CSS 变量，
 * 保证 Next.js 实现与原型的配色、圆角、字体气质一致。
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        paper: "var(--paper)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        violet: "var(--violet)",
        violet2: "var(--violet2)",
        warm: "var(--warm)",
      },
      fontFamily: {
        serif: ["Georgia", "Songti SC", "STSong", "SimSun", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "20px",
        soft: "14px",
        pill: "11px",
      },
      boxShadow: {
        paper: "0 8px 30px rgba(50,40,30,.035)",
      },
      maxWidth: {
        shell: "1320px",
      },
      spacing: {
        sidebar: "225px",
      },
    },
  },
  plugins: [],
};

export default config;
