import { describe, expect, it } from "vitest";
import { confirmSignal, createSignal, getState, reset, tick } from "./store";

describe("Waste Ready operational journey", () => {
  it("preserves the citizen case id and creates a real dispatcher escalation at four hours", () => {
    reset();
    const { signal } = createSignal({
      clientSignalId: "sig-citizen-test-case",
      type: "waste_outside",
      category: "wet",
      amountBand: "medium",
      location: { lat: 12.9716, lng: 77.7507 },
    });
    expect(signal.id).toBe("sig-citizen-test-case");
    tick(4 * 60 * 60);
    const escalated = getState().signals.find(item => item.id === signal.id);
    expect(escalated?.dispatchReviewAt).toBeTruthy();
    expect(getState().events.some(event => event.type === "signal.sla_escalated" && event.entityId === signal.id)).toBe(true);
  });

  it("allows only an accepted signal proof to be citizen-confirmed or reopened", () => {
    reset();
    const { signal } = createSignal({
      clientSignalId: "sig-citizen-confirm-case",
      type: "waste_outside",
      category: "dry",
      amountBand: "small",
      location: { lat: 12.9716, lng: 77.7507 },
    });
    expect(() => confirmSignal(signal.id, "cleaned")).toThrow("INVALID_STATUS_TRANSITION");
    signal.proofStatus = "accepted";
    expect(confirmSignal(signal.id, "still_present").citizenOutcome).toBe("reopened");
    expect(getState().events.some(event => event.type === "signal.reopened" && event.entityId === signal.id)).toBe(true);
  });
});
