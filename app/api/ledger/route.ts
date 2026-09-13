import { NextResponse } from "next/server";
import {
  getLedgerBlocks,
  lockAndSealFix,
  appendEffectivenessAudit,
  verifyLedgerIntegrity,
  generateRcaAndFix,
  simulateTamper,
  restoreBlock,
  EffectivenessScore,
} from "@/lib/fixledger";

export const dynamic = "force-dynamic";

/**
 * GET /api/ledger
 * Returns all blocks in the immutable FixLedger blockchain.
 * Optional query params:
 * - ?verify=true : performs full cryptographic SHA-256 verification and returns integrity audit report
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shouldVerify = searchParams.get("verify") === "true";

    const blocks = await getLedgerBlocks();
    let integrityReport = null;

    if (shouldVerify) {
      integrityReport = await verifyLedgerIntegrity();
    }

    const totalAudits = blocks.reduce(
      (acc, b) => acc + (b.effectivenessAudits?.length || 0),
      0
    );

    return NextResponse.json({
      success: true,
      blocks,
      integrity: integrityReport,
      summary: {
        totalBlocks: blocks.length,
        totalEffectivenessAudits: totalAudits,
        genesisHash: blocks[0]?.ledger_hash,
        latestHash: blocks[blocks.length - 1]?.ledger_hash,
        latestBlockId: blocks[blocks.length - 1]?.blockId,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load FixLedger";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/ledger
 * Handles cryptographic operations, 5-Whys generation, and closed-loop audits.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // 1. Generate automated 5-Whys RCA & Recommended Engineering Fix
    if (action === "generate_rca") {
      const { hazard, failed_barrier, observation } = body;
      const rca = generateRcaAndFix(hazard, failed_barrier, observation);
      return NextResponse.json({ success: true, rca });
    }

    // 2. The Trigger (Data Lock): Approve 5-Whys RCA & Seal to FixLedger
    if (action === "lock_and_seal") {
      const { concernId, incidentPayload, rcaFiveWhys, approvedEngineeringFix, auditor } = body;

      if (!concernId || !incidentPayload || !approvedEngineeringFix || !auditor?.id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Missing required fields for lock and seal: concernId, incidentPayload, approvedEngineeringFix, and auditor ID are mandatory.",
          },
          { status: 400 }
        );
      }

      const block = await lockAndSealFix(
        concernId,
        incidentPayload,
        Array.isArray(rcaFiveWhys) ? rcaFiveWhys : [],
        approvedEngineeringFix,
        {
          id: auditor.id || "OIL-HSE-AUDITOR",
          name: auditor.name || "HSE Authorized Auditor",
          role: auditor.role || "HSE Process Safety Lead",
        }
      );

      return NextResponse.json({ success: true, block });
    }

    // 3. Closed-Loop Tracking: Append Effectiveness Score Audit
    if (action === "append_audit") {
      const { blockId, inspector } = body;
      if (!blockId || !inspector?.badgeId || !inspector?.effectivenessScore || !inspector?.findings) {
        return NextResponse.json(
          {
            success: false,
            error: "blockId and complete inspector details (badgeId, effectivenessScore, findings) are required.",
          },
          { status: 400 }
        );
      }

      const validScores: EffectivenessScore[] = ["Effective", "Minor Breach", "Ineffective"];
      if (!validScores.includes(inspector.effectivenessScore)) {
        return NextResponse.json(
          { success: false, error: "effectivenessScore must be 'Effective', 'Minor Breach', or 'Ineffective'." },
          { status: 400 }
        );
      }

      const res = await appendEffectivenessAudit(blockId, {
        badgeId: inspector.badgeId,
        name: inspector.name || "Field HSE Inspector",
        station: inspector.station || "Moran Rig #04",
        effectivenessScore: inspector.effectivenessScore,
        findings: inspector.findings,
      });

      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, auditTransaction: res.auditTransaction });
    }

    // 4. Verify Ledger Cryptographic Integrity (SHA-256)
    if (action === "verify_integrity") {
      const report = await verifyLedgerIntegrity();
      return NextResponse.json({ success: true, report });
    }

    // 5. Simulate Malicious Database Alteration (DGMS / OSHA Regulatory Demo)
    if (action === "simulate_tamper") {
      const { blockId, fieldToMutate, tamperedValue } = body;
      if (!blockId || !fieldToMutate || tamperedValue === undefined) {
        return NextResponse.json(
          { success: false, error: "blockId, fieldToMutate, and tamperedValue are required." },
          { status: 400 }
        );
      }

      const res = await simulateTamper(blockId, fieldToMutate, tamperedValue);
      return NextResponse.json({ success: true, block: res.block });
    }

    // 6. Restore Block from Tampered State
    if (action === "restore_block") {
      const { blockId } = body;
      if (!blockId) {
        return NextResponse.json({ success: false, error: "blockId is required." }, { status: 400 });
      }

      const res = await restoreBlock(blockId);
      return NextResponse.json({ success: true, block: res.block });
    }

    return NextResponse.json(
      { success: false, error: `Unrecognized action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error processing FixLedger operation";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
