/**
 * Decouples potential serious injury/fatality consequences from initiating hazards.
 * Follows formal HSE SIF analysis:
 * - Hazard: Initiating energy source / unsafe condition (e.g. Work at Height, H2S gas)
 * - Possible Consequence: The worst-case credible physical outcome (e.g. Fatal fall, acute toxic asphyxiation)
 */

export function derivePossibleConsequence(
  hazard?: string,
  observation?: string,
  raw?: Record<string, unknown>
): string {
  if (raw && typeof raw.possible_consequence === "string" && raw.possible_consequence.trim().length > 3) {
    return raw.possible_consequence.trim();
  }
  if (raw && typeof raw.consequence === "string" && raw.consequence.trim().length > 3) {
    return raw.consequence.trim();
  }

  const combined = `${hazard || ""} ${observation || ""}`.toLowerCase();

  if (combined.includes("height") || combined.includes("fall") || combined.includes("harness") || combined.includes("derrick") || combined.includes("scaffold")) {
    return "Fatal fall from height or catastrophic permanent spinal trauma";
  }
  if (combined.includes("gas") || combined.includes("h2s") || combined.includes("toxic") || combined.includes("vapor") || combined.includes("asphyx")) {
    return "Acute respiratory paralysis, fatal toxic asphyxiation, or multiple-casualty knockdown";
  }
  if (combined.includes("hot work") || combined.includes("weld") || combined.includes("spark") || combined.includes("fire") || combined.includes("explos")) {
    return "Hydrocarbon flash fire, catastrophic vapor cloud explosion (VCE), or severe third-degree thermal burns";
  }
  if (combined.includes("loto") || combined.includes("isolation") || combined.includes("energ") || combined.includes("electric") || combined.includes("volt")) {
    return "High-voltage electrocution, arc flash blast injury, or fatal unexpected machine actuation";
  }
  if (combined.includes("lift") || combined.includes("crane") || combined.includes("sling") || combined.includes("rigging") || combined.includes("suspended")) {
    return "Massive crush trauma from dropped heavy suspended load or catastrophic rigging collapse";
  }
  if (combined.includes("confined") || combined.includes("tank") || combined.includes("vessel") || combined.includes("entry")) {
    return "Atmospheric oxygen deficiency asphyxiation, toxic entrapment, or delayed rescue fatality";
  }
  if (combined.includes("line of fire") || combined.includes("pinch") || combined.includes("crush") || combined.includes("pressur") || combined.includes("whip")) {
    return "High-pressure fluid injection injury, severe projectile impact puncture, or traumatic limb amputation";
  }
  if (combined.includes("driv") || combined.includes("vehicle") || combined.includes("rollover") || combined.includes("truck")) {
    return "High-speed vehicular rollover, head-on impact collision trauma, or passenger ejection";
  }

  return "Severe occupational physical trauma, barrier breach, or acute personal injury";
}
