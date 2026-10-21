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
  external: [
    "@google/generative-ai",
    "@clack/prompts",
    "chalk",
    "commander",
    "dotenv",
    "execa",
    "fast-glob",
    "ora",
  ],
});
