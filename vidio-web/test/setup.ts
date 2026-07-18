import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll } from "vitest";
import { deleteSyncDb, closeSyncDb } from "@/lib/sync/db";
import { server } from "@/test/server";
import { resetTestState } from "@/test/handlers";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(async () => {
  cleanup();
  server.resetHandlers();
  resetTestState();
  await closeSyncDb();
  await deleteSyncDb();
});
afterAll(() => server.close());
