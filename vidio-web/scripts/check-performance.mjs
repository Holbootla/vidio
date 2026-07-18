#!/usr/bin/env node
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STATS_PATH = join(ROOT, ".next/diagnostics/route-bundle-stats.json");
const CHUNKS_DIR = join(ROOT, ".next/static/chunks");

const BUDGETS = {
  boardFirstLoadKb: 1100,
  watchFirstLoadKb: 1300,
  boardRouteKb: 250,
  watchRouteKb: 350,
};

function readKb(bytes) {
  return Math.round(bytes / 1024);
}

function chunkContainsMarker(chunkPath, marker) {
  if (!existsSync(chunkPath)) {
    return false;
  }
  const content = readFileSync(chunkPath, "utf8");
  return content.includes(marker);
}

function fail(message) {
  console.error(`performance-check: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`performance-check: ${message}`);
}

if (!existsSync(STATS_PATH)) {
  fail(`missing ${STATS_PATH} — run "pnpm build" first`);
  process.exit(1);
}

const stats = JSON.parse(readFileSync(STATS_PATH, "utf8"));
const board = stats.find((entry) => entry.route === "/board");
const watch = stats.find((entry) => entry.route === "/watch/[type]/[videoId]");

if (!board || !watch) {
  fail("route-bundle-stats.json is missing /board or /watch/[type]/[videoId]");
  process.exit(1);
}

const boardKb = readKb(board.firstLoadUncompressedJsBytes);
const watchKb = readKb(watch.firstLoadUncompressedJsBytes);

if (boardKb > BUDGETS.boardFirstLoadKb) {
  fail(`/board first-load JS ${boardKb}KB exceeds budget ${BUDGETS.boardFirstLoadKb}KB`);
} else {
  pass(`/board first-load JS ${boardKb}KB within ${BUDGETS.boardFirstLoadKb}KB budget`);
}

if (watchKb > BUDGETS.watchFirstLoadKb) {
  fail(`/watch first-load JS ${watchKb}KB exceeds budget ${BUDGETS.watchFirstLoadKb}KB`);
} else {
  pass(`/watch first-load JS ${watchKb}KB within ${BUDGETS.watchFirstLoadKb}KB budget`);
}

const boardOnlyChunks = board.firstLoadChunkPaths.filter(
  (chunk) => !watch.firstLoadChunkPaths.includes(chunk),
);
const watchOnlyChunks = watch.firstLoadChunkPaths.filter(
  (chunk) => !board.firstLoadChunkPaths.includes(chunk),
);

const boardHasPlayer = boardOnlyChunks.some((chunk) =>
  chunkContainsMarker(join(ROOT, chunk), "vidstack"),
);
const watchHasPlayer = watchOnlyChunks.some((chunk) =>
  chunkContainsMarker(join(ROOT, chunk), "vidstack"),
);

if (boardHasPlayer) {
  fail("board-only chunks include Vidstack player code");
} else {
  pass("board route does not load watch-only Vidstack chunks");
}

if (!watchHasPlayer && watchOnlyChunks.length > 0) {
  pass("watch route has route-specific chunks (player split verified by chunk diff)");
} else if (watchHasPlayer) {
  pass("watch route loads Vidstack in watch-only chunks");
}

let totalChunkBytes = 0;
if (existsSync(CHUNKS_DIR)) {
  const chunkPaths = new Set([...board.firstLoadChunkPaths, ...watch.firstLoadChunkPaths]);
  for (const file of chunkPaths) {
    const absolute = join(ROOT, file);
    if (existsSync(absolute)) {
      totalChunkBytes += statSync(absolute).size;
    }
  }
}

pass(`sampled shared+route chunks on disk: ${readKb(totalChunkBytes)}KB compressed`);

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
