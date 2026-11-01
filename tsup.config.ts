import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.jsxImportSource = "react";
  },
  external: [
    "@google/generative-ai",
    "@clack/prompts",
    "chalk",
    "commander",
    "dotenv",
    "execa",
    "fast-glob",
    "ora",
    "ink",
    "react",
    "@inkjs/ui",
    "ink-text-input",
    "ink-spinner",
  ],
});

