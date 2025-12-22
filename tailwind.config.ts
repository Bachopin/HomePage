import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    screens: {
      sm: "800px",
      tablet: "801px",
      desktop: "1200px",
    },
    extend: {
      fontSize: {
        "body-costum": [
          "0.9375rem",
          {
            lineHeight: "1.625rem",
            letterSpacing: "0.00938rem",
            fontWeight: "500",
          },
        ],
      },
      transitionProperty: {
        width: "width",
        height: "height",
        spacing: "margin, padding",
      },
    },
  },
  plugins: [],
};
export default config;
