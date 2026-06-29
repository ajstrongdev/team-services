import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "renderer"), { recursive: true });

const mainOptions = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
};

const builds = [
  {
    ...mainOptions,
    entryPoints: [join(root, "src/main/main.ts")],
    outfile: join(dist, "main/main.js"),
  },
  {
    ...mainOptions,
    entryPoints: [join(root, "src/main/preload.ts")],
    outfile: join(dist, "main/preload.js"),
  },
  {
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "chrome120",
    sourcemap: true,
    logLevel: "info",
    entryPoints: [join(root, "src/renderer/renderer.ts")],
    outfile: join(dist, "renderer/renderer.js"),
  },
];

function copyStatic() {
  cpSync(join(root, "src/renderer/index.html"), join(dist, "renderer/index.html"));
  cpSync(join(root, "src/renderer/assets"), join(dist, "renderer/assets"), {
    recursive: true,
  });
}

if (watch) {
  const contexts = await Promise.all(builds.map((b) => esbuild.context(b)));
  await Promise.all(contexts.map((c) => c.watch()));
  copyStatic();
  console.log("esbuild watching for changes…");
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  copyStatic();
  console.log("Build complete -> dist/");
}
