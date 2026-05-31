/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#26313d",
        muted: "#6b7280",
      },
      boxShadow: {
        card: "0 18px 48px rgba(82, 57, 36, 0.14)",
      },
    },
  },
  plugins: [],
};
