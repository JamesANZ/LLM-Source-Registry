import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://llm-source-registry.example.com",
  trailingSlash: "never",
  build: {
    format: "file",
  },
});
