import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
  },
  build: {
    rollupOptions: {
      input: {
        home: "index.html",
        app: "app.html",
      },
    },
  },
});