/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        proclima: {
          yellow: "#FFD200",
          orange: "#F59E0B",
          blue: "#1E40AF",
          dark: "#0B0F1A",
          panel: "#111827"
        }
      }
    }
  },
  plugins: [],
}
