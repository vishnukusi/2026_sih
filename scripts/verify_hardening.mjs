import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// ─── 1. PII SANITIZATION TEST ────────────────────────────────────────────────
console.log("\n=== TEST 1: Conservative PII Sanitization ===");
function sanitizePii(text) {
  if (!text || typeof text !== "string") return "";
  let cleaned = text;
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]");
  cleaned = cleaned.replace(/\bOIL-(?:FLD|MGR|EMP|ENG|DIR|SEC|STN)-\d{3,6}\b/gi, "[BADGE_REDACTED]");
  cleaned = cleaned.replace(/\b(?:EMP|BADGE)[\s:#-]*[0-9]{4,6}\b/gi, "[BADGE_REDACTED]");
  cleaned = cleaned.replace(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, "[PHONE_REDACTED]");
  cleaned = cleaned.replace(/(?:\+91[\s-]?)?\(?0?\d{3,4}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[PHONE_REDACTED]");
  return cleaned;
}

const sampleText = `Field Operator Lav Kumar (OIL-FLD-5542, phone +91 9435044521, email lav.kumar@oilindia.in)
reported that at Moran Rig #04 near Well #12, technician serviced Valve V-104 on BOP Stack BOP-02.`;

const sanitized = sanitizePii(sampleText);
assert(!sanitized.includes("lav.kumar@oilindia.in"), "Email redacted");
assert(sanitized.includes("[EMAIL_REDACTED]"), "Email placeholder present");
assert(!sanitized.includes("OIL-FLD-5542"), "Badge redacted");
assert(sanitized.includes("[BADGE_REDACTED]"), "Badge placeholder present");
assert(!sanitized.includes("9435044521"), "Phone redacted");
assert(sanitized.includes("[PHONE_REDACTED]"), "Phone placeholder present");

// Ensure operational terms are strictly preserved
assert(sanitized.includes("Moran Rig #04"), "Preserved Rig #04");
assert(sanitized.includes("Well #12"), "Preserved Well #12");
assert(sanitized.includes("Valve V-104"), "Preserved Valve V-104");
assert(sanitized.includes("BOP Stack BOP-02"), "Preserved BOP-02 equipment ID");

// ─── 2. SESSION TOKEN MINIMAL CLAIMS TEST ────────────────────────────────────
console.log("\n=== TEST 2: Session Token Minimal Claims & Signature ===");
const SESSION_SECRET = "test-secret-salt-key-for-verification-32ch";

function createSessionToken(payload) {
  const minimalPayload = {
    userId: payload.userId,
    role: payload.role,
    issuedAt: payload.issuedAt || Date.now(),
    expiresAt: payload.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(minimalPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySessionToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [bodyB64, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(bodyB64).digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  const parsed = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
  if (parsed.expiresAt < Date.now()) return null;
  return parsed;
}

// User tries to inject sensitive user object or password into session payload
const sensitiveInput = {
  userId: "worker@oilindia.in",
  role: "worker",
  password: "super-secret-password-123",
  salary: 1200000,
  secretQuestions: "first pet",
};

const token = createSessionToken(sensitiveInput);
const decoded = verifySessionToken(token);

assert(decoded !== null, "Valid session token verifies successfully");
assert(decoded.userId === "worker@oilindia.in", "userId present in claims");
assert(decoded.role === "worker", "role present in claims");
assert(decoded.issuedAt > 0 && decoded.expiresAt > 0, "Timestamps present");
assert(decoded.password === undefined, "Password is NEVER placed in session claims");
assert(decoded.salary === undefined, "Salary is NOT in session claims");
assert(decoded.secretQuestions === undefined, "Sensitive fields excluded from token");

// Tampered token test
const tamperedToken = token.slice(0, -4) + "XXXX";
assert(verifySessionToken(tamperedToken) === null, "Tampered session token is rejected");

// ─── 3. PASSWORD HASHING (SCRYPT + SALT) TEST ────────────────────────────────
console.log("\n=== TEST 3: Password Hashing (scrypt + salt) ===");
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash.startsWith("scrypt$")) return { verified: false, needsMigration: false };
  const parts = storedHash.split("$");
  if (parts.length !== 3) return { verified: false, needsMigration: false };
  const [, salt, hash] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const valid = crypto.timingSafeEqual(Buffer.from(derived, "utf8"), Buffer.from(hash, "utf8"));
  return { verified: valid, needsMigration: false };
}

const pwd = "TestPassword@2026";
const hashed = hashPassword(pwd);
assert(hashed.startsWith("scrypt$"), "Hash formatted with scrypt scheme and salt");
assert(verifyPassword(pwd, hashed).verified === true, "Correct password verifies");
assert(verifyPassword("WrongPassword", hashed).verified === false, "Wrong password fails verification");

// ─── 4. RFC 4180 CSV PARSER & COMMENT-LINE HANDLING TEST ─────────────────────
console.log("\n=== TEST 4: CSV Parser & Comment Skipping ===");
function parseCsvContent(content) {
  const clean = content.replace(/^\uFEFF/, "");
  const lines = [];
  let currentLine = "";
  let insideQuote = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"') {
      if (insideQuote && clean[i + 1] === '"') {
        currentLine += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
        currentLine += char;
      }
    } else if ((char === "\n" || char === "\r") && !insideQuote) {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      if (currentLine.trim().length > 0) lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim().length > 0) lines.push(currentLine);

  const nonCommentLines = lines.filter((line) => !line.trim().startsWith("#"));
  if (nonCommentLines.length === 0) return { headers: [], rows: [] };

  function splitCsvRow(rowStr) {
    const cells = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const ch = rowStr[i];
      if (ch === '"') {
        if (inQuotes && rowStr[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  const headerRow = splitCsvRow(nonCommentLines[0]).map((h) =>
    h.replace(/^["']|["']$/g, "").trim().toLowerCase().replace(/[\s_-]+/g, "_")
  );

  const parsedRows = [];
  for (let r = 1; r < nonCommentLines.length; r++) {
    const cells = splitCsvRow(nonCommentLines[r]);
    if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) continue;
    const rowObj = {};
    for (let c = 0; c < headerRow.length; c++) {
      rowObj[headerRow[c]] = (cells[c] ?? "").replace(/^["']|["']$/g, "").trim();
    }
    parsedRows.push(rowObj);
  }

  return { headers: headerRow, rows: parsedRows };
}

const testCsv = `# ILLUSTRATIVE DEMO DATA — NOT ACTUAL OIL OPERATIONAL DATA
# Another comment line
report_text,location,activity,equipment,report_type,date
"Floorman working at monkey board, 28m high, without lanyard.",Moran Rig #04,Derrick Operations,Monkey Board M-01,Unsafe Act,Sep 01 2026
"Electrical switchgear serviced without LOTO.",Duliajan Central GGS,Substation,Breaker B-104,Unsafe Act,Sep 01 2026
`;

const parsedCsv = parseCsvContent(testCsv);
assert(parsedCsv.headers.includes("report_text"), "Header report_text parsed");
assert(parsedCsv.rows.length === 2, "2 rows parsed, comments skipped cleanly");
assert(parsedCsv.rows[0].location === "Moran Rig #04", "Row 1 location correct");
assert(parsedCsv.rows[0].report_text.includes("28m high"), "Commas inside quotes parsed without split");

// ─── 5. EXACT DUPLICATE DETECTION TEST ───────────────────────────────────────
console.log("\n=== TEST 5: Exact Duplicate Detection Fingerprint ===");
function computeReportFingerprint(text, location, date) {
  const normText = text.toLowerCase().replace(/\s+/g, " ").trim();
  const normLoc = location.toLowerCase().replace(/\s+/g, " ").trim();
  const normDate = date.toLowerCase().replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(`${normText}|${normLoc}|${normDate}`).digest("hex");
}

const fp1 = computeReportFingerprint("Monkey board lanyard missing", "Moran Rig #04", "Sep 01 2026");
const fp2 = computeReportFingerprint("  Monkey board   lanyard missing  ", "moran rig #04", "sep 01 2026");
const fpDifferent = computeReportFingerprint("Monkey board lanyard missing", "Moran Rig #04", "Sep 02 2026");

assert(fp1 === fp2, "Exact content with varying whitespace/casing matches same fingerprint");
assert(fp1 !== fpDifferent, "Different date produces distinct fingerprint (legitimate recurring event preserved)");

// ─── 6. COMPLIANT STATEMENT DETECTION TEST ──────────────────────────────────
console.log("\n=== TEST 6: Compliant Statement Detection ===");
function isCompliantStatement(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const compliantPhrases = [
    "completed successfully",
    "verified compliant",
    "100% compliant",
    "no breach observed",
    "passed safety inspection",
    "verified and signed off",
    "properly isolated and locked",
    "zero energy confirmed",
    "clear of hazards",
  ];
  const negativeModifiers = ["not ", "failed", "skipped", "bypassed", "violation", "breached", "compromised", "missing"];
  const hasCompliantPhrase = compliantPhrases.some((phrase) => lower.includes(phrase));
  const hasNegativeModifier = negativeModifiers.some((neg) => lower.includes(neg));
  return hasCompliantPhrase && !hasNegativeModifier;
}

assert(isCompliantStatement("Lockout verification was completed successfully with zero energy confirmed") === true, "Compliant text detected");
assert(isCompliantStatement("Lockout verification was not completed successfully, bypassed by crew") === false, "Negative modifier overrides compliant phrase");
assert(isCompliantStatement("Floorman slipped from ladder missing rungs") === false, "Normal hazard not marked compliant");

// ─── 7. CHECK SAMPLE DEMO CSV DATASET ────────────────────────────────────────
console.log("\n=== TEST 7: Demo Dataset File Validation ===");
const demoCsvPath = path.join(process.cwd(), "data", "sample_reports_demo.csv");
const demoContent = await fs.readFile(demoCsvPath, "utf-8");
assert(demoContent.startsWith("# ILLUSTRATIVE DEMO DATA — NOT ACTUAL OIL OPERATIONAL DATA"), "Demo CSV begins with required disclaimer comment");

const parsedDemo = parseCsvContent(demoContent);
assert(parsedDemo.rows.length === 50, `Demo CSV contains exactly 50 rows (found ${parsedDemo.rows.length})`);
assert(parsedDemo.headers.includes("report_text"), "Demo CSV has report_text header");
assert(parsedDemo.headers.includes("location"), "Demo CSV has location header");
assert(parsedDemo.headers.includes("activity"), "Demo CSV has activity header");
assert(parsedDemo.headers.includes("equipment"), "Demo CSV has equipment header");
assert(parsedDemo.headers.includes("report_type"), "Demo CSV has report_type header");
assert(parsedDemo.headers.includes("date"), "Demo CSV has date header");

// Check diversity of locations and equipment
const locations = new Set(parsedDemo.rows.map((r) => r.location));
assert(locations.size >= 6, `Demo CSV covers diverse locations (${locations.size} unique locations)`);

// ─── 8. CANONICAL SAFETY VALIDATION GATE TEST ────────────────────────────────
console.log("\n=== TEST 8: Domain Safety Validation Gate & Barrier Extraction ===");
function extractProtectionAndFailureState(text, hazard, rawBarrier) {
  const combined = `${text || ""} ${hazard || ""} ${rawBarrier || ""}`.toLowerCase();
  let failureState = "Unspecified";
  if (isCompliantStatement(text)) failureState = "Verified Compliant";
  else if (combined.includes("bypass") || combined.includes("override")) failureState = "Bypassed";
  else if (combined.includes("broken") || combined.includes("frayed")) failureState = "Damaged";
  else if (combined.includes("not followed") || combined.includes("unclipped")) failureState = "Not Followed";
  else if (combined.includes("not checked") || combined.includes("unverified")) failureState = "Not Checked";

  let protection = rawBarrier || "Safety Barrier Control";
  if (combined.includes("harness") || combined.includes("monkey board")) protection = "Fall Arrest System / Safety Harness";
  else if (combined.includes("loto") || combined.includes("isolation")) protection = "Positive Physical Energy Isolation (LOTO)";

  return { safety_protection: protection, protection_failure_state: failureState };
}

function validateSafetyRules(originalText, aiSifPotential, aiCriticalBarrierFailure) {
  const isCompliant = isCompliantStatement(originalText);
  if (isCompliant && (aiSifPotential || aiCriticalBarrierFailure)) {
    return {
      validation_flag: "NEEDS_HSE_REVIEW",
      validation_notes: "Compliant condition with AI SIF flag. Marked for HSE review.",
      flagged_for_review: true,
    };
  }
  return { validation_flag: "PASSED", flagged_for_review: false };
}

const b1 = extractProtectionAndFailureState("Roustabout working on monkey board with unclipped harness", "Work at Height", "Harness");
assert(b1.safety_protection.includes("Fall Arrest"), "Identified Fall Arrest protection");
assert(b1.protection_failure_state === "Not Followed", "Identified Not Followed failure mode");

const valConflict = validateSafetyRules("Lockout verification completed successfully with zero energy confirmed", true, true);
assert(valConflict.validation_flag === "NEEDS_HSE_REVIEW", "Safety rule conflicts flag NEEDS_HSE_REVIEW");
assert(valConflict.flagged_for_review === true, "Marked for review without silently overwriting AI");

const valNormal = validateSafetyRules("Roustabout unclipped safety harness on monkey board", true, true);
assert(valNormal.validation_flag === "PASSED", "Genuine breach passes domain validation");

console.log(`\n========================================`);
console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
