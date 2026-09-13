/**
 * Standardized Safety Protection & Barrier Failure State Extraction
 */

import type { FailureState, ProtectionExtraction } from "../../types";
import { isCompliantStatement } from "./validation";

/**
 * Standardized safety protection & barrier failure state extractor.
 * Maps free text and barrier hints into canonical HSE barrier definitions.
 */
export function extractProtectionAndFailureState(
  text?: string,
  hazard?: string,
  rawBarrier?: string
): ProtectionExtraction {
  const combined = `${text || ""} ${hazard || ""} ${rawBarrier || ""}`.toLowerCase();

  // 1. Identify Failure State
  let failureState: FailureState = "Unspecified";

  if (isCompliantStatement(text)) {
    failureState = "Verified Compliant";
  } else if (
    combined.includes("bypass") ||
    combined.includes("override") ||
    combined.includes("defeat") ||
    combined.includes("tamper") ||
    combined.includes("bridged") ||
    combined.includes("disabled")
  ) {
    failureState = "Bypassed";
  } else if (
    combined.includes("frayed") ||
    combined.includes("broken") ||
    combined.includes("damaged") ||
    combined.includes("cracked") ||
    combined.includes("corroded") ||
    combined.includes("leak") ||
    combined.includes("worn")
  ) {
    failureState = "Damaged";
  } else if (
    combined.includes("missing") ||
    combined.includes("no guard") ||
    combined.includes("without") ||
    combined.includes("uninstalled") ||
    combined.includes("unprovided")
  ) {
    failureState = "Missing";
  } else if (
    combined.includes("not checked") ||
    combined.includes("unverified") ||
    combined.includes("not tested") ||
    combined.includes("skipped check") ||
    combined.includes("assumed") ||
    combined.includes("not verified")
  ) {
    failureState = "Not Checked";
  } else if (
    combined.includes("not followed") ||
    combined.includes("unclipped") ||
    combined.includes("unlatched") ||
    combined.includes("skipped") ||
    combined.includes("ignored") ||
    combined.includes("disregarded") ||
    combined.includes("unauthorized")
  ) {
    failureState = "Not Followed";
  } else if (
    combined.includes("loose") ||
    combined.includes("inadequate") ||
    combined.includes("undersized") ||
    combined.includes("expired")
  ) {
    failureState = "Inadequate";
  }

  // 2. Identify Physical Safety Protection
  let protection = rawBarrier?.trim() || "Safety Barrier Control";

  if (
    combined.includes("harness") ||
    combined.includes("lanyard") ||
    combined.includes("monkey board") ||
    combined.includes("fall arrest") ||
    combined.includes("scaffold") ||
    combined.includes("height")
  ) {
    protection = "Fall Arrest System / Safety Harness";
  } else if (
    combined.includes("gas detector") ||
    combined.includes("h2s") ||
    combined.includes("scba") ||
    combined.includes("blower") ||
    combined.includes("toxic gas")
  ) {
    protection = "Atmospheric Gas Detection & SCBA";
  } else if (
    combined.includes("loto") ||
    combined.includes("lockout") ||
    combined.includes("breaker") ||
    combined.includes("hasp") ||
    combined.includes("isolation")
  ) {
    protection = "Positive Physical Energy Isolation (LOTO)";
  } else if (
    combined.includes("crane") ||
    combined.includes("sling") ||
    combined.includes("rigging") ||
    combined.includes("drop zone") ||
    combined.includes("suspended load")
  ) {
    protection = "Drop Zone Barricade & Rigging Certification";
  } else if (
    combined.includes("confined space") ||
    combined.includes("manhole") ||
    combined.includes("vessel") ||
    combined.includes("entry permit")
  ) {
    protection = "Confined Space Entry Permit & Forced Ventilation";
  } else if (
    combined.includes("guard") ||
    combined.includes("pinch point") ||
    combined.includes("machine") ||
    combined.includes("interlock")
  ) {
    protection = "Physical Machine Guarding & Interlocks";
  } else if (
    combined.includes("hot work") ||
    combined.includes("welding") ||
    combined.includes("spark") ||
    combined.includes("fire watch")
  ) {
    protection = "Hot Work Permit & Fire Retardant Watch";
  } else if (
    combined.includes("seatbelt") ||
    combined.includes("speed limit") ||
    combined.includes("driving")
  ) {
    protection = "Vehicle Safety Control & Speed Restrictor";
  }

  return {
    safety_protection: protection,
    protection_failure_state: failureState,
  };
}
