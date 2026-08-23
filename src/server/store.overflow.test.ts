import { describe, expect, it } from "vitest";
import { getState, reset } from "./store";

// Integration check against the live 1 s engine loop: a bin pushed to 100%
// must raise the top-priority alert and be pinned as the very next stop.
describe("overflow dispatch (live engine)", () => {
  it("pins a newly overflowed bin as the next stop", async () => {
    reset();
    const seeded = getState();
    const bin = seeded.bins.find(b => b.status !== "offline")!;
    bin.fillPercent = 100;

    // Give the engine a couple of ticks to notice and re-route.
    await new Promise(resolve => setTimeout(resolve, 2600));

    const after = getState();
    expect(after.events.some(e => e.type === "alert.bin.overflow")).toBe(true);
    expect(after.route.routes[0].stops.length).toBeGreaterThan(0);
    expect(after.route.routes[0].stops[0].workId).toBe(bin.id);
    expect(after.bins.find(b => b.id === bin.id)?.overflowedAt).toBeTruthy();
    reset();
  }, 15000);
});
