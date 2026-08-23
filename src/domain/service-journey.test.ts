import { describe, expect, it } from "vitest";
import { deriveServiceJourney } from "./service-journey";

describe("citizen service journey", () => {
  it("makes route reasoning and all closure steps visible", () => {
    const journey = deriveServiceJourney({
      now: "2026-08-24T10:00:00.000Z",
      signal: { status: "en_route", createdAt: "2026-08-24T09:30:00.000Z", etaMinutes: 7 },
      routeReason: "Waste is outside and ready for pickup",
      proofAccepted: false,
      confirmationStatus: undefined,
    });
    expect(journey.map((step) => step.id)).toEqual(["segregate", "ready", "eta", "reason", "proof", "confirm", "sla"]);
    expect(journey.find((step) => step.id === "reason")?.detail).toContain("outside");
    expect(journey.find((step) => step.id === "eta")?.state).toBe("current");
  });

  it("escalates an uncollected ready signal after the four-hour demo SLA", () => {
    const journey = deriveServiceJourney({
      now: "2026-08-24T13:30:00.000Z",
      signal: { status: "queued", createdAt: "2026-08-24T09:30:00.000Z" },
      proofAccepted: false,
    });
    const sla = journey.find((step) => step.id === "sla");
    expect(sla?.state).toBe("attention");
    expect(sla?.detail).toContain("escalated");
  });

  it("shows citizen-controlled closure and reopening", () => {
    const confirmed = deriveServiceJourney({ now: "2026-08-24T10:00:00.000Z", proofAccepted: true, confirmationStatus: "confirmed" });
    const reopened = deriveServiceJourney({ now: "2026-08-24T10:00:00.000Z", proofAccepted: true, confirmationStatus: "reopened" });
    expect(confirmed.find((step) => step.id === "confirm")?.state).toBe("complete");
    expect(reopened.find((step) => step.id === "confirm")?.state).toBe("attention");
  });
});
