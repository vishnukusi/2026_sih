/**
 * MongoDB Atlas Connection Pool & DoH Patch
 */

import { MongoClient, Db } from "mongodb";
import dnsPromises from "dns/promises";

// Install DNS-over-HTTPS (DoH) resolver hook for SRV & TXT records.
// This ensures MongoDB Atlas (mongodb+srv://) connects reliably across Windows systems,
// corporate firewalls, and university campus networks where local UDP port 53 DNS fails SRV queries.
if (typeof window === "undefined" && !globalThis._dohPatched) {
  globalThis._dohPatched = true;
  const origResolve = dnsPromises.resolve;
  dnsPromises.resolve = async function (hostname: string, rrtype: string = "A") {
    if (rrtype === "SRV") {
      try {
        const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=SRV`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.Answer && data.Answer.length > 0) {
          return data.Answer.map((a: { data: string }) => {
            const parts = a.data.trim().split(/\s+/);
            return {
              priority: parseInt(parts[0], 10),
              weight: parseInt(parts[1], 10),
              port: parseInt(parts[2], 10),
              name: parts[3].replace(/\.$/, ""),
            };
          });
        }
      } catch (err) {
        console.warn("[MongoDB DoH] SRV lookup fallback error:", err);
      }
    } else if (rrtype === "TXT") {
      try {
        const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=TXT`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.Answer && data.Answer.length > 0) {
          return data.Answer.map((a: { data: string }) => [a.data.replace(/^"|"$/g, "")]);
        }
      } catch (err) {
        console.warn("[MongoDB DoH] TXT lookup fallback error:", err);
      }
    }
    return origResolve.apply(this, arguments as unknown as [string, string]);
  };
}

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "datasih";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _dohPatched: boolean | undefined;
}

/**
 * Creates and connects a new MongoClient with retry capability.
 */
async function createConnectedClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }
  let lastError: Error | null = null;
  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 6000,
        connectTimeoutMS: 6000,
        maxPoolSize: 10,
        retryWrites: true,
      });

      await client.connect();
      return client;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[MongoDB Atlas] Connection attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error("Failed to connect to MongoDB Atlas after retries");
}

let clientPromise: Promise<MongoClient> | null = null;

/**
 * Returns the active MongoClient instance connected to MongoDB Atlas.
 * Connects lazily upon first database request.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  if (process.env.NODE_ENV === "development") {
    if (!globalThis._mongoClientPromise) {
      globalThis._mongoClientPromise = createConnectedClient();
    }
    return await globalThis._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = createConnectedClient();
  }
  return await clientPromise;
}

/**
 * Returns the target database in MongoDB Atlas ('datasih').
 */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

/**
 * Checks whether MongoDB Atlas is reachable and healthy.
 */
export async function isMongoConnected(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
