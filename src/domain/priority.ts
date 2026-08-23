import { z } from "zod";

/** The explainable, additive priority model used by the BBMP pilot. */
export const PRIORITY_VERSION = "priority-v1" as const;
export const PRIORITY_FACTOR_COUNT = 10 as const;

export const priorityFactorKeySchema = z.enum([
  "garbageAmount",
  "affectedArea",
  "peopleAffected",
  "hygieneRisk",
  "obstruction",
  "reportAge",
  "density",
  "corroboration",
  "nearbyBinFill",
  "activeCitizenDemand",
]);
export type PriorityFactorKey = z.infer<typeof priorityFactorKeySchema>;

export const priorityBandSchema = z.enum([
  "routine",
  "scheduled",
  "high",
  "urgent",
  "critical",
]);
export type PriorityBand = z.infer<typeof priorityBandSchema>;

export const hygieneRiskSchema = z.enum(["none", "low", "moderate", "high", "severe"]);
export type HygieneRisk = z.infer<typeof hygieneRiskSchema>;
export const HYGIENE_RISK_VALUE: Record<HygieneRisk, number> = {
  none: 0,
  low: 0.25,
  moderate: 0.5,
  high: 0.75,
  severe: 1,
};

export const obstructionSchema = z.enum(["none", "partial", "significant", "traffic_lane"]);
export type Obstruction = z.infer<typeof obstructionSchema>;
export const OBSTRUCTION_VALUE: Record<Obstruction, number> = {
  none: 0,
  partial: 0.25,
  significant: 0.6,
  traffic_lane: 1,
};

export const specialWasteSchema = z.enum(["none", "biomedical", "chemical", "unknown"]);
export type SpecialWaste = z.infer<typeof specialWasteSchema>;

const nonNegativeNumber = z.number().finite().min(0);
const optionalNonNegativeNumber = nonNegativeNumber.optional();

/** Raw observations. Optional fields are intentionally allowed: omission is surfaced as missing, never treated as safe. */
export const priorityInputSchema = z.object({
  reportId: z.string().trim().min(1),
  observedAt: z.string().datetime({ offset: true }),
  calculatedAt: z.string().datetime({ offset: true }).optional(),

  garbageAmountLitres: optionalNonNegativeNumber,
  affectedAreaSqM: optionalNonNegativeNumber,
  peopleAffected: optionalNonNegativeNumber,
  hygieneRisk: hygieneRiskSchema.optional(),
  obstruction: obstructionSchema.optional(),
  reportAgeHours: optionalNonNegativeNumber,
  populationDensityPerKm2: optionalNonNegativeNumber,
  buildingDensityPerKm2: optionalNonNegativeNumber,
  corroboratingReports: optionalNonNegativeNumber,
  nearbyBinFillFraction: z.number().finite().min(0).max(1).optional(),
  activeCitizenDemand24h: optionalNonNegativeNumber,

  // Safety observations are separate from the weighted factors. Missing values force manual review.
  verifiedSpecialWaste: specialWasteSchema.optional(),
  trafficLaneBlocked: z.boolean().optional(),
});
export type PriorityInput = z.infer<typeof priorityInputSchema>;

export const PRIORITY_WEIGHTS: Readonly<Record<PriorityFactorKey, number>> = {
  garbageAmount: 15,
  affectedArea: 10,
  peopleAffected: 15,
  hygieneRisk: 15,
  obstruction: 15,
  reportAge: 10,
  density: 8,
  corroboration: 5,
  nearbyBinFill: 4,
  activeCitizenDemand: 3,
};

export const PRIORITY_FACTOR_ORDER: readonly PriorityFactorKey[] = [
  "garbageAmount",
  "affectedArea",
  "peopleAffected",
  "hygieneRisk",
  "obstruction",
  "reportAge",
  "density",
  "corroboration",
  "nearbyBinFill",
  "activeCitizenDemand",
] as const;

export const priorityFactorDefinitionSchema = z.object({
  key: priorityFactorKeySchema,
  label: z.string().min(1),
  weight: z.number().finite().min(0).max(100),
  unit: z.string().min(1),
  normalization: z.string().min(1),
});
export type PriorityFactorDefinition = z.infer<typeof priorityFactorDefinitionSchema>;

export const PRIORITY_FACTOR_DEFINITIONS: readonly PriorityFactorDefinition[] = [
  { key: "garbageAmount", label: "Garbage amount", weight: 15, unit: "litres", normalization: "clamp(litres / 500, 0, 1)" },
  { key: "affectedArea", label: "Affected area", weight: 10, unit: "m²", normalization: "clamp(m² / 1000, 0, 1)" },
  { key: "peopleAffected", label: "People affected", weight: 15, unit: "people", normalization: "clamp(people / 1000, 0, 1)" },
  { key: "hygieneRisk", label: "Hygiene risk", weight: 15, unit: "level", normalization: "none=0, low=.25, moderate=.5, high=.75, severe=1" },
  { key: "obstruction", label: "Obstruction", weight: 15, unit: "level", normalization: "none=0, partial=.25, significant=.6, traffic_lane=1" },
  { key: "reportAge", label: "Report age", weight: 10, unit: "hours", normalization: "clamp(hours / 48, 0, 1)" },
  { key: "density", label: "Population/building density", weight: 8, unit: "composite", normalization: ".6×clamp(population/km² ÷ 25000)+.4×clamp(buildings/km² ÷ 7500)" },
  { key: "corroboration", label: "Independent corroboration", weight: 5, unit: "reports", normalization: "clamp(reports / 3, 0, 1)" },
  { key: "nearbyBinFill", label: "Nearby smart-bin fill", weight: 4, unit: "fraction", normalization: "clamp(fill fraction, 0, 1)" },
  { key: "activeCitizenDemand", label: "Active citizen demand", weight: 3, unit: "signals/24h", normalization: "clamp(signals / 5, 0, 1)" },
] as const;

export const prioritySafetyEscalationSchema = z.object({
  kind: z.enum(["none", "special_waste", "blocked_traffic_lane"]),
  reasonCodes: z.array(z.enum(["biomedical_waste", "chemical_waste", "blocked_traffic_lane"])),
  minimumEffectiveScore: z.number().finite().min(0).max(100),
});
export type PrioritySafetyEscalation = z.infer<typeof prioritySafetyEscalationSchema>;

export const priorityFactorResultSchema = z.object({
  key: priorityFactorKeySchema,
  present: z.boolean(),
  // The original observation is retained for an operator-facing audit. Missing is undefined.
  rawValue: z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.object({
      populationDensityPerKm2: nonNegativeNumber,
      buildingDensityPerKm2: nonNegativeNumber,
    }),
  ]).optional(),
  normalizedValue: z.number().finite().min(0).max(1),
  weight: z.number().finite().min(0).max(100),
  contribution: z.number().finite().min(0).max(100),
  explanation: z.string().min(1),
});
export type PriorityFactorResult = z.infer<typeof priorityFactorResultSchema>;

export const priorityOverrideSchema = z.object({
  actorId: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  score: z.number().finite().min(0).max(100).optional(),
  band: priorityBandSchema.optional(),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).optional(),
}).superRefine((value, context) => {
  if (value.score === undefined && value.band === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "An override must specify score, band, or both.", path: ["score"] });
  }
  if (value.expiresAt && Date.parse(value.expiresAt) < Date.parse(value.createdAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "expiresAt must not precede createdAt.", path: ["expiresAt"] });
  }
});
export type PriorityOverride = z.infer<typeof priorityOverrideSchema>;

export const priorityAuditSchema = z.object({
  version: z.literal(PRIORITY_VERSION),
  calculatedAt: z.string().datetime({ offset: true }),
  modelScore: z.number().finite().min(0).max(100),
  effectiveScore: z.number().finite().min(0).max(100),
  modelBand: priorityBandSchema,
  effectiveBand: priorityBandSchema,
  factors: z.array(priorityFactorResultSchema).length(PRIORITY_FACTOR_COUNT),
  missingFactors: z.array(priorityFactorKeySchema),
  coverage: z.number().finite().min(0).max(1),
  safetyEscalation: prioritySafetyEscalationSchema,
  requiresManualReview: z.boolean(),
  manualReviewReasons: z.array(z.string().min(1)),
  override: priorityOverrideSchema.optional(),
});
export type PriorityAudit = z.infer<typeof priorityAuditSchema>;

export const priorityResultSchema = z.object({
  reportId: z.string().trim().min(1),
  audit: priorityAuditSchema,
});
export type PriorityResult = z.infer<typeof priorityResultSchema>;

export const PRIORITY_TEST_VECTOR: PriorityInput = {
  reportId: "report-test-vector",
  observedAt: "2026-01-01T00:00:00.000Z",
  garbageAmountLitres: 250,
  affectedAreaSqM: 400,
  peopleAffected: 500,
  hygieneRisk: "high",
  obstruction: "significant",
  reportAgeHours: 24,
  populationDensityPerKm2: 12500,
  buildingDensityPerKm2: 3750,
  corroboratingReports: 2,
  nearbyBinFillFraction: 0.9,
  activeCitizenDemand24h: 3,
  verifiedSpecialWaste: "none",
  trafficLaneBlocked: false,
};
export const PRIORITY_TEST_VECTOR_EXPECTED = {
  modelScore: 56.98,
  effectiveScore: 56.98,
  band: "high" as const,
  coverage: 1,
  requiresManualReview: false,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const bandFor = (score: number): PriorityBand => {
  if (score >= 90) return "critical";
  if (score >= 75) return "urgent";
  if (score >= 50) return "high";
  if (score >= 25) return "scheduled";
  return "routine";
};

type FactorComputation = {
  rawValue: number | string | boolean | { populationDensityPerKm2: number; buildingDensityPerKm2: number } | undefined;
  normalizedValue: number;
  explanation: string;
};

const factorComputations = (input: PriorityInput): Record<PriorityFactorKey, FactorComputation> => {
  const density = input.populationDensityPerKm2 === undefined || input.buildingDensityPerKm2 === undefined
    ? { rawValue: undefined, normalizedValue: 0, explanation: "Population/building density observation is missing." }
    : {
        rawValue: {
          populationDensityPerKm2: input.populationDensityPerKm2,
          buildingDensityPerKm2: input.buildingDensityPerKm2,
        },
        normalizedValue: clamp01(0.6 * clamp01(input.populationDensityPerKm2 / 25000) + 0.4 * clamp01(input.buildingDensityPerKm2 / 7500)),
        explanation: `${input.populationDensityPerKm2} people/km² and ${input.buildingDensityPerKm2} buildings/km² combined by the documented .6/.4 rule.`,
      };
  return {
    garbageAmount: { rawValue: input.garbageAmountLitres, normalizedValue: input.garbageAmountLitres === undefined ? 0 : clamp01(input.garbageAmountLitres / 500), explanation: input.garbageAmountLitres === undefined ? "Garbage amount is missing." : `${input.garbageAmountLitres} L ÷ 500, clamped to 0–1.` },
    affectedArea: { rawValue: input.affectedAreaSqM, normalizedValue: input.affectedAreaSqM === undefined ? 0 : clamp01(input.affectedAreaSqM / 1000), explanation: input.affectedAreaSqM === undefined ? "Affected area is missing." : `${input.affectedAreaSqM} m² ÷ 1000, clamped to 0–1.` },
    peopleAffected: { rawValue: input.peopleAffected, normalizedValue: input.peopleAffected === undefined ? 0 : clamp01(input.peopleAffected / 1000), explanation: input.peopleAffected === undefined ? "People affected is missing." : `${input.peopleAffected} people ÷ 1000, clamped to 0–1.` },
    hygieneRisk: { rawValue: input.hygieneRisk, normalizedValue: input.hygieneRisk === undefined ? 0 : HYGIENE_RISK_VALUE[input.hygieneRisk], explanation: input.hygieneRisk === undefined ? "Hygiene risk is missing." : `${input.hygieneRisk} hygiene risk maps to ${HYGIENE_RISK_VALUE[input.hygieneRisk]}.` },
    obstruction: { rawValue: input.obstruction, normalizedValue: input.obstruction === undefined ? 0 : OBSTRUCTION_VALUE[input.obstruction], explanation: input.obstruction === undefined ? "Obstruction level is missing." : `${input.obstruction} obstruction maps to ${OBSTRUCTION_VALUE[input.obstruction]}.` },
    reportAge: { rawValue: input.reportAgeHours, normalizedValue: input.reportAgeHours === undefined ? 0 : clamp01(input.reportAgeHours / 48), explanation: input.reportAgeHours === undefined ? "Report age is missing." : `${input.reportAgeHours} h ÷ 48, clamped to 0–1.` },
    density,
    corroboration: { rawValue: input.corroboratingReports, normalizedValue: input.corroboratingReports === undefined ? 0 : clamp01(input.corroboratingReports / 3), explanation: input.corroboratingReports === undefined ? "Independent corroboration is missing." : `${input.corroboratingReports} reports ÷ 3, clamped to 0–1.` },
    nearbyBinFill: { rawValue: input.nearbyBinFillFraction, normalizedValue: input.nearbyBinFillFraction ?? 0, explanation: input.nearbyBinFillFraction === undefined ? "Nearby smart-bin fill is missing." : `${input.nearbyBinFillFraction} fill fraction.` },
    activeCitizenDemand: { rawValue: input.activeCitizenDemand24h, normalizedValue: input.activeCitizenDemand24h === undefined ? 0 : clamp01(input.activeCitizenDemand24h / 5), explanation: input.activeCitizenDemand24h === undefined ? "Active citizen demand is missing." : `${input.activeCitizenDemand24h} signals ÷ 5, clamped to 0–1.` },
  };
};

export function calculatePriority(rawInput: PriorityInput): PriorityResult {
  const input = priorityInputSchema.parse(rawInput);
  const calculatedAt = input.calculatedAt ?? input.observedAt;
  const computations = factorComputations(input);
  const factors = PRIORITY_FACTOR_ORDER.map((key): PriorityFactorResult => {
    const computation = computations[key];
    const present = computation.rawValue !== undefined;
    return {
      key,
      present,
      rawValue: computation.rawValue,
      normalizedValue: round(computation.normalizedValue, 6),
      weight: PRIORITY_WEIGHTS[key],
      contribution: round(computation.normalizedValue * PRIORITY_WEIGHTS[key], 4),
      explanation: computation.explanation,
    };
  });
  const missingFactors = factors.filter((factor) => !factor.present).map((factor) => factor.key);
  const modelScore = round(factors.reduce((sum, factor) => sum + factor.contribution, 0), 2);
  const safetyReasons = [
    input.verifiedSpecialWaste === "biomedical" ? "biomedical_waste" as const : undefined,
    input.verifiedSpecialWaste === "chemical" ? "chemical_waste" as const : undefined,
    input.trafficLaneBlocked === true ? "blocked_traffic_lane" as const : undefined,
  ].filter((value): value is "biomedical_waste" | "chemical_waste" | "blocked_traffic_lane" => value !== undefined);
  const safetyEscalation: PrioritySafetyEscalation = safetyReasons.length === 0
    ? { kind: "none", reasonCodes: [], minimumEffectiveScore: 0 }
    : {
        kind: safetyReasons.includes("blocked_traffic_lane") ? "blocked_traffic_lane" : "special_waste",
        reasonCodes: safetyReasons,
        minimumEffectiveScore: 90,
      };
  const safetyMissing = input.verifiedSpecialWaste === undefined || input.trafficLaneBlocked === undefined;
  const manualReviewReasons = [
    ...(factors.length - missingFactors.length < 6 ? ["Fewer than 60% of weighted factor observations are present."] : []),
    ...(safetyMissing ? ["One or more safety observations are missing."] : []),
    ...(input.verifiedSpecialWaste === "unknown" ? ["Special-waste classification is unknown."] : []),
  ];
  const coverage = round((factors.length - missingFactors.length) / PRIORITY_FACTOR_COUNT, 2);
  const effectiveScore = round(Math.max(modelScore, safetyEscalation.minimumEffectiveScore), 2);
  return {
    reportId: input.reportId,
    audit: {
      version: PRIORITY_VERSION,
      calculatedAt,
      modelScore,
      effectiveScore,
      modelBand: bandFor(modelScore),
      effectiveBand: bandFor(effectiveScore),
      factors,
      missingFactors,
      coverage,
      safetyEscalation,
      requiresManualReview: manualReviewReasons.length > 0,
      manualReviewReasons,
    },
  };
}

/**
 * Apply a documented human override while preserving the model result and all
 * factor contributions in the audit. A band-only override intentionally keeps
 * the calculated score; a score-only override derives its band from thresholds.
 */
export function applyPriorityOverride(rawResult: PriorityResult, rawOverride: PriorityOverride): PriorityResult {
  const result = priorityResultSchema.parse(rawResult);
  const override = priorityOverrideSchema.parse(rawOverride);
  // A human override may raise or annotate a result, but cannot lower a
  // verified safety escalation below its policy minimum.
  const effectiveScore = round(Math.max(
    override.score ?? result.audit.effectiveScore,
    result.audit.safetyEscalation.minimumEffectiveScore,
  ), 2);
  const effectiveBand = result.audit.safetyEscalation.minimumEffectiveScore > 0
    ? bandFor(effectiveScore)
    : override.band ?? bandFor(effectiveScore);
  return {
    reportId: result.reportId,
    audit: {
      ...result.audit,
      effectiveScore,
      effectiveBand,
      override,
    },
  };
}

export const priorityConfig = {
  version: PRIORITY_VERSION,
  weights: PRIORITY_WEIGHTS,
  factorOrder: PRIORITY_FACTOR_ORDER,
  factorDefinitions: PRIORITY_FACTOR_DEFINITIONS,
  rounding: { normalizedDecimals: 6, contributionDecimals: 4, scoreDecimals: 2 },
  bands: { routineMaxExclusive: 25, scheduledMaxExclusive: 50, highMaxExclusive: 75, urgentMaxExclusive: 90, criticalMaxInclusive: 90 },
  safetyEscalationMinimumScore: 90,
  manualReviewCoverageThreshold: 0.6,
} as const;
