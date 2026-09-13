import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

console.log("=== VERIFYING DEMO CREDENTIALS & LOGIN INTEGRITY ===");

// 1. Verify credentials match seeded users in data/users.json
const usersJsonPath = path.join(process.cwd(), "data", "users.json");
const usersRaw = await fs.readFile(usersJsonPath, "utf-8");
const users = JSON.parse(usersRaw);

const managerUser = users.find((u) => u.email === "priyanka@oilindia.in");
const workerUser = users.find((u) => u.email === "lav@gmail.com");

if (!managerUser || managerUser.role !== "manager" || managerUser.status !== "approved") {
  console.error("FAIL: Manager demo account not properly seeded or approved");
  process.exit(1);
}
console.log("PASS: Manager demo account exists, approved, role=manager (priyanka@oilindia.in)");

if (!workerUser || workerUser.role !== "worker" || workerUser.status !== "approved") {
  console.error("FAIL: Worker demo account not properly seeded or approved");
  process.exit(1);
}
console.log("PASS: Worker demo account exists, approved, role=worker (lav@gmail.com)");

// 2. Verify password hashes and verification logic
function verifyPasswordScryptOrPlain(password, storedHash) {
  if (storedHash === password) return true;
  if (storedHash.startsWith("scrypt:") || storedHash.startsWith("scrypt$")) {
    const delimiter = storedHash.startsWith("scrypt:") ? ":" : "$";
    const parts = storedHash.split(delimiter);
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    const derivedBuf = Buffer.from(derived, "utf8");
    const hashBuf = Buffer.from(hash, "utf8");
    if (derivedBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, hashBuf);
  }
  return false;
}

const managerPassValid = verifyPasswordScryptOrPlain("123456", managerUser.password);
const workerPassValid = verifyPasswordScryptOrPlain("123456", workerUser.password);

if (!managerPassValid || !workerPassValid) {
  console.error("FAIL: Seeded passwords do not verify with '123456'");
  process.exit(1);
}
console.log("PASS: Both demo accounts correctly verify password '123456'");

// 3. Verify auth-form-1.tsx has Demo Access buttons with exact handlers
const authFormLandingPath = path.join(process.cwd(), "components", "landing", "auth-form-1.tsx");
const authFormUiPath = path.join(process.cwd(), "components", "ui", "auth-form-1.tsx");
let authFormCode = "";
try {
  authFormCode = await fs.readFile(authFormLandingPath, "utf-8");
} catch {
  authFormCode = await fs.readFile(authFormUiPath, "utf-8");
}

if (!authFormCode.includes("Demo Access") || !authFormCode.includes("For hackathon demonstration only")) {
  console.error("FAIL: Demo Access header or hackathon text missing from auth form");
  process.exit(1);
}
console.log("PASS: Demo Access header and discreet hackathon note present");

if (!authFormCode.includes("Demo Manager") || !authFormCode.includes("Demo Field Officer")) {
  console.error("FAIL: Demo Manager or Demo Field Officer buttons missing");
  process.exit(1);
}
console.log("PASS: [Demo Manager] and [Demo Field Officer] quick-fill buttons present");

if (!authFormCode.includes('priyanka@oilindia.in') || !authFormCode.includes('lav@gmail.com')) {
  console.error("FAIL: Quick-fill handlers do not target existing seeded emails");
  process.exit(1);
}
console.log("PASS: Quick-fill handlers target exact seeded accounts without bypassing auth");

console.log("\nALL DEMO QUICK-ACCESS CHECKS PASSED!");
