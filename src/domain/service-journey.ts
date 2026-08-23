export type JourneyState = "complete" | "current" | "upcoming" | "attention";
export type JourneyStepId = "segregate" | "ready" | "eta" | "reason" | "proof" | "confirm" | "sla";
export interface JourneyStep { id: JourneyStepId; label: string; detail: string; state: JourneyState }

type SignalLike = { status: "received" | "queued" | "assigned" | "en_route" | "collected" | "cancelled"; createdAt: string; etaMinutes?: number };
export function deriveServiceJourney(input: {
  now: string;
  signal?: SignalLike;
  routeReason?: string;
  proofAccepted: boolean;
  confirmationStatus?: "confirmed" | "reopened";
  dispatchReviewAt?: string;
}): JourneyStep[] {
  const ageMinutes = input.signal ? Math.max(0, (Date.parse(input.now) - Date.parse(input.signal.createdAt)) / 60_000) : 0;
  const collected = input.signal?.status === "collected" || input.proofAccepted;
  const ready = Boolean(input.signal);
  const routed = Boolean(input.routeReason) || (input.signal ? ["assigned", "en_route", "collected"].includes(input.signal.status) : false);
  const overdue = ready && !collected && ageMinutes >= 240;
  const escalated = overdue || Boolean(input.dispatchReviewAt);
  const confirmed = input.confirmationStatus === "confirmed";
  const reopened = input.confirmationStatus === "reopened";

  return [
    { id: "segregate", label: "Separate four streams", detail: "Wet, dry, sanitary and special-care waste kept apart.", state: ready ? "complete" : "current" },
    { id: "ready", label: "Waste Ready", detail: ready ? "Signal received without a mandatory account form." : "Tap when segregated waste is ready outside.", state: ready ? "complete" : "upcoming" },
    { id: "eta", label: "Track pickup", detail: input.signal?.etaMinutes ? `Estimated arrival in ${input.signal.etaMinutes} minutes.` : routed ? "Vehicle assigned; ETA is recalculating." : "ETA appears after assignment.", state: collected ? "complete" : routed ? "current" : "upcoming" },
    { id: "reason", label: "Why this route?", detail: input.routeReason ?? "The published route will show the demand, urgency and travel reason.", state: routed ? "complete" : "upcoming" },
    { id: "proof", label: "Pickup proof", detail: input.proofAccepted ? "Collector proof accepted with time and location audit." : "Before/after proof is required after collection.", state: input.proofAccepted ? "complete" : collected ? "current" : "upcoming" },
    { id: "confirm", label: "Citizen controls closure", detail: reopened ? "Reopened: waste remains and has returned to the queue." : confirmed ? "Citizen confirmed the street is clean." : input.proofAccepted ? "Confirm clean, partly clean, or still present." : "Available after accepted proof.", state: reopened ? "attention" : confirmed ? "complete" : input.proofAccepted ? "current" : "upcoming" },
    { id: "sla", label: "SLA safety net", detail: escalated ? `Pickup overdue after ${Math.floor(ageMinutes / 60)} hours; escalated through a dispatcher-review event.` : collected ? "Pickup completed within the demo service window." : "Creates a dispatcher-review event at 4 hours in this prototype.", state: escalated ? "attention" : collected ? "complete" : "upcoming" },
  ];
}
