import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoMode } from "@/lib/supabase/client";
import { readDemoRecords, writeDemoRecords } from "./moduleHelpers";

describe("demo persistence", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disables demo mode in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isDemoMode()).toBe(false);
    expect(() => readDemoRecords("demo-key")).toThrow(/Demo persistence is disabled/);
    expect(() => writeDemoRecords("demo-key", [])).toThrow(/Demo persistence is disabled/);
  });
});
