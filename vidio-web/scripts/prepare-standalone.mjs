#!/usr/bin/env node
import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standaloneRoot = join(root, ".next", "standalone");

await mkdir(join(standaloneRoot, ".next"), { recursive: true });
await Promise.all([
  cp(join(root, ".next", "static"), join(standaloneRoot, ".next", "static"), {
    recursive: true,
  }),
  cp(join(root, "public"), join(standaloneRoot, "public"), { recursive: true }),
]);
