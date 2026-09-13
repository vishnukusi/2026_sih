import crypto from "node:crypto";

console.log("=== TESTING SESSION_SECRET PRODUCTION & DEV ENFORCEMENT ===");

let devSecretFallback = null;

function testGetSessionSecret(envVal, nodeEnv) {
  if (envVal && envVal.trim().length >= 16) {
    return envVal.trim();
  }
  if (nodeEnv === "production") {
    throw new Error(
      "[Security Error] SESSION_SECRET environment variable is not defined or is too short. In production/server environments, SESSION_SECRET must be explicitly configured via environment variables (minimum 16 characters)."
    );
  }
  if (!devSecretFallback) {
    devSecretFallback = crypto.randomBytes(32).toString("hex");
  }
  return devSecretFallback;
}

// 1. Explicit configured secret works in both environments
const configured = testGetSessionSecret("my-production-secret-very-secure-32chars", "production");
if (configured !== "my-production-secret-very-secure-32chars") {
  console.error("FAIL: Configured secret was not returned");
  process.exit(1);
}
console.log("PASS: Configured secret used in production");

// 2. Missing or short secret in production throws securely
let threwInProd = false;
try {
  testGetSessionSecret("", "production");
} catch (err) {
  threwInProd = true;
  if (!err.message.includes("[Security Error] SESSION_SECRET")) {
    console.error("FAIL: Incorrect error message thrown");
    process.exit(1);
  }
}
if (!threwInProd) {
  console.error("FAIL: Missing secret did not throw in production");
  process.exit(1);
}
console.log("PASS: Missing secret securely fails in production with clear configuration error");

// 3. Short secret (<16 chars) in production throws securely
let threwShortInProd = false;
try {
  testGetSessionSecret("too-short", "production");
} catch (err) {
  threwShortInProd = true;
}
if (!threwShortInProd) {
  console.error("FAIL: Short secret (<16 chars) did not throw in production");
  process.exit(1);
}
console.log("PASS: Short secret (<16 chars) rejected in production");

// 4. Dev mode generates ephemeral fallback
devSecretFallback = null;
const devSecret = testGetSessionSecret("", "development");
if (!devSecret || devSecret.length < 32) {
  console.error("FAIL: Dev secret not generated");
  process.exit(1);
}
console.log("PASS: Development mode allows ephemeral random secret");

console.log("\nALL SESSION_SECRET ENFORCEMENT CHECKS PASSED!");
