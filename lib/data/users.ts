/**
 * User & Role Management Data Repository
 */

import fs from "fs/promises";
import path from "path";
import { getDb } from "./mongodb";
import { hashPassword } from "@/lib/auth/auth";
import type { UserDocument, ApprovalRecord, AccountStatus } from "@/types";

export type { AccountStatus, ApprovalRecord, UserDocument };

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const APPROVALS_FILE = path.join(DATA_DIR, "approvals_registry.json");

const DEFAULT_INITIAL_HASH =
  "scrypt:4a8f9b2c1d3e5f7a9b0c2d4e6f8a1b3c:d44c5835f55a91ae4d05e5e2260503dd043f056b42a963dd4444ec5ad93153dea984ffbc5d2d784554663b9afce0f9f0594d5551111c8574559e67cb784193d3";

const DEFAULT_INITIAL_USERS: UserDocument[] = [
  {
    name: "Lav Kumar",
    email: "lav@gmail.com",
    password: DEFAULT_INITIAL_HASH,
    role: "worker",
    requestedRole: "worker",
    badgeId: "OIL-FLD-5542",
    designation: "HSE Field Safety Officer (Derrick Floor)",
    station: "Moran Rig #04 • Wellhead Section",
    radioChannel: "UHF CH-04",
    phone: "+91 94350 44521",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    status: "approved",
    approval: {
      approvedByManagerName: "Priyanka Bora",
      approvedByManagerBadge: "OIL-MGR-1002",
      approvedByManagerEmail: "priyanka@oilindia.in",
      approvedByManagerDesignation: "Chief General Manager (Process Safety & SIF Control)",
      approvedAt: "2026-09-01T09:30:00.000Z",
      assignedRole: "worker",
      remarks: "Verified field competencies and rig safety clearance.",
    },
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:30:00.000Z",
  },
  {
    name: "Priyanka Bora",
    email: "priyanka@oilindia.in",
    password: DEFAULT_INITIAL_HASH,
    role: "manager",
    requestedRole: "manager",
    badgeId: "OIL-MGR-1002",
    designation: "Chief General Manager (Process Safety & SIF Control)",
    station: "Assam & Assam-Arakan Basin (Duliajan HQ)",
    radioChannel: "COMMAND CH-01",
    phone: "+91 374 280 4501 • Ext 402",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    status: "approved",
    approval: {
      approvedByManagerName: "OIL HSE Directorate",
      approvedByManagerBadge: "OIL-DIR-001",
      approvedByManagerEmail: "directorate@oilindia.in",
      approvedByManagerDesignation: "Executive Director (HSE Corporate Services)",
      approvedAt: "2026-08-15T10:00:00.000Z",
      assignedRole: "manager",
      remarks: "Corporate HSE Manager Clearance Authorization.",
    },
    createdAt: "2026-08-15T09:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
  },
  {
    name: "Debajit Saikia",
    email: "debajit.saikia@oilindia.in",
    password: DEFAULT_INITIAL_HASH,
    role: "worker",
    requestedRole: "worker",
    badgeId: "OIL-FLD-5543",
    designation: "HSE Field Safety Officer (Derrick Operations)",
    station: "Moran Rig #04 • Wellhead Section",
    radioChannel: "UHF CH-04",
    phone: "+91 94350 44521",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let inMemoryUsers: UserDocument[] = JSON.parse(JSON.stringify(DEFAULT_INITIAL_USERS));

async function syncLocalUsers(users: UserDocument[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");

    const approvals = users
      .filter((u) => u.approval)
      .map((u) => ({
        candidateName: u.name,
        candidateEmail: u.email,
        candidateBadgeId: u.badgeId,
        candidateStation: u.station,
        candidateRadioChannel: u.radioChannel,
        candidatePhone: u.phone,
        grantedRole: u.role,
        approvedByManagerName: u.approval!.approvedByManagerName,
        approvedByManagerBadge: u.approval!.approvedByManagerBadge,
        approvedByManagerEmail: u.approval!.approvedByManagerEmail,
        approvedByManagerDesignation: u.approval!.approvedByManagerDesignation,
        approvedAt: u.approval!.approvedAt,
        remarks: u.approval!.remarks || "Verified credentials and operational clearance.",
      }));

    await fs.writeFile(APPROVALS_FILE, JSON.stringify(approvals, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Users] Local file sync failed:", err);
  }
}

async function loadLocalUsers(): Promise<UserDocument[]> {
  try {
    const content = await fs.readFile(USERS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // File doesn't exist yet
  }
  return inMemoryUsers;
}

export async function getAllUsers(): Promise<UserDocument[]> {
  try {
    const db = await getDb();
    const col = db.collection<UserDocument>("users");
    const dbUsers = await col.find().toArray();

    if (dbUsers && dbUsers.length > 0) {
      inMemoryUsers = dbUsers;
      await syncLocalUsers(dbUsers);
      return dbUsers;
    }

    await col.insertMany(DEFAULT_INITIAL_USERS as any);
    inMemoryUsers = DEFAULT_INITIAL_USERS;
    await syncLocalUsers(DEFAULT_INITIAL_USERS);
    return DEFAULT_INITIAL_USERS;
  } catch (err) {
    console.warn("[Users] Atlas fetch failed, using local/in-memory:", err);
    inMemoryUsers = await loadLocalUsers();
    return inMemoryUsers;
  }
}

export async function getUserByEmail(email: string): Promise<UserDocument | null> {
  const cleanEmail = (email || "").toLowerCase().trim();
  const all = await getAllUsers();
  return all.find((u) => u.email.toLowerCase() === cleanEmail) || null;
}

export async function createUserRequest(
  payload: Omit<UserDocument, "_id" | "status" | "createdAt" | "updatedAt" | "approval" | "role" | "password"> & {
    requestedRole: "worker" | "manager";
    password?: string;
  }
): Promise<UserDocument> {
  const cleanEmail = payload.email.toLowerCase().trim();
  const existing = await getUserByEmail(cleanEmail);
  if (existing) {
    throw new Error("An account or request with this email already exists.");
  }

  const now = new Date().toISOString();
  const hashedPassword = hashPassword(payload.password || "");
  const newUser: UserDocument = {
    name: payload.name.trim(),
    email: cleanEmail,
    password: hashedPassword,
    role: payload.requestedRole,
    requestedRole: payload.requestedRole,
    badgeId: (payload.badgeId || "").trim(),
    designation: (payload.designation || "").trim(),
    station: (payload.station || "").trim(),
    radioChannel: (payload.radioChannel || "").trim(),
    phone: (payload.phone || "").trim(),
    avatarUrl:
      payload.avatarUrl ||
      (payload.requestedRole === "manager"
        ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();
    const col = db.collection<UserDocument>("users");
    await col.insertOne(newUser as any);
  } catch (err) {
    console.warn("[Users] Atlas insert failed, saving to local state:", err);
  }

  const index = inMemoryUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (index >= 0) {
    inMemoryUsers[index] = newUser;
  } else {
    inMemoryUsers.push(newUser);
  }
  await syncLocalUsers(inMemoryUsers);

  return newUser;
}

export async function migrateUserPassword(email: string, hashedPassword: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();

  try {
    const db = await getDb();
    const col = db.collection<UserDocument>("users");
    await col.updateOne({ email: cleanEmail }, { $set: { password: hashedPassword, updatedAt: now } });
  } catch (err) {
    console.warn("[Users] Atlas password migration failed:", err);
  }

  const idx = inMemoryUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx >= 0) {
    inMemoryUsers[idx].password = hashedPassword;
    inMemoryUsers[idx].updatedAt = now;
  }
  await syncLocalUsers(inMemoryUsers);
}

export function sanitizeUser(user: UserDocument): Omit<UserDocument, "password"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...sanitized } = user;
  return sanitized;
}

export async function approveUserRequest(params: {
  userEmail: string;
  assignedRole: "worker" | "manager";
  manager: {
    name: string;
    badgeId: string;
    email: string;
    designation: string;
  };
  remarks?: string;
}): Promise<UserDocument> {
  const cleanEmail = params.userEmail.toLowerCase().trim();
  const all = await getAllUsers();
  const user = all.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    throw new Error("Applicant request not found.");
  }

  const now = new Date().toISOString();
  const approvalRecord: ApprovalRecord = {
    approvedByManagerName: params.manager.name,
    approvedByManagerBadge: params.manager.badgeId || "OIL-MGR",
    approvedByManagerEmail: params.manager.email,
    approvedByManagerDesignation: params.manager.designation || "HSE Operations Manager",
    approvedAt: now,
    assignedRole: params.assignedRole,
    remarks: params.remarks || "Verified credentials and operational clearance.",
  };

  user.status = "approved";
  user.role = params.assignedRole;
  user.approval = approvalRecord;
  user.updatedAt = now;

  try {
    const db = await getDb();
    const usersCol = db.collection<UserDocument>("users");
    await usersCol.updateOne(
      { email: cleanEmail },
      {
        $set: {
          status: "approved",
          role: params.assignedRole,
          approval: approvalRecord,
          updatedAt: now,
        },
      }
    );

    const auditCol = db.collection("approvals_audit");
    await auditCol.insertOne({
      candidateEmail: cleanEmail,
      candidateName: user.name,
      candidateBadgeId: user.badgeId,
      candidateStation: user.station,
      grantedRole: params.assignedRole,
      ...approvalRecord,
      recordedAt: new Date(),
    });
  } catch (err) {
    console.warn("[Users] Atlas approval update failed, updating locally:", err);
  }

  const idx = inMemoryUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx >= 0) inMemoryUsers[idx] = user;

  await syncLocalUsers(inMemoryUsers);
  return user;
}

export async function rejectUserRequest(params: {
  userEmail: string;
  manager: {
    name: string;
    badgeId: string;
    email: string;
  };
  reason?: string;
}): Promise<UserDocument> {
  const cleanEmail = params.userEmail.toLowerCase().trim();
  const all = await getAllUsers();
  const user = all.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    throw new Error("Applicant request not found.");
  }

  const now = new Date().toISOString();
  user.status = "rejected";
  user.rejectionReason = params.reason || "Declined by HSE management";
  user.updatedAt = now;

  try {
    const db = await getDb();
    const usersCol = db.collection<UserDocument>("users");
    await usersCol.updateOne(
      { email: cleanEmail },
      {
        $set: {
          status: "rejected",
          rejectionReason: user.rejectionReason,
          updatedAt: now,
        },
      }
    );
  } catch (err) {
    console.warn("[Users] Atlas rejection update failed:", err);
  }

  const idx = inMemoryUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx >= 0) inMemoryUsers[idx] = user;

  await syncLocalUsers(inMemoryUsers);
  return user;
}

export async function getApprovalsRegistry() {
  const users = await getAllUsers();
  return users
    .filter((u) => u.approval)
    .map((u) => ({
      candidateName: u.name,
      candidateEmail: u.email,
      candidateBadgeId: u.badgeId,
      candidateDesignation: u.designation,
      candidateStation: u.station,
      candidateRadioChannel: u.radioChannel,
      candidatePhone: u.phone,
      candidateAvatarUrl: u.avatarUrl,
      grantedRole: u.role,
      approvedByManagerName: u.approval!.approvedByManagerName,
      approvedByManagerBadge: u.approval!.approvedByManagerBadge,
      approvedByManagerEmail: u.approval!.approvedByManagerEmail,
      approvedByManagerDesignation: u.approval!.approvedByManagerDesignation,
      approvedAt: u.approval!.approvedAt,
      remarks: u.approval!.remarks || "Verified operational credentials.",
    }))
    .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());
}

export async function updateUserProfile(params: {
  email: string;
  name?: string;
  designation?: string;
  station?: string;
  radioChannel?: string;
  phone?: string;
  avatarUrl?: string;
}): Promise<UserDocument> {
  const cleanEmail = params.email.toLowerCase().trim();
  const all = await getAllUsers();
  const user = all.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    throw new Error("User account not found.");
  }

  const now = new Date().toISOString();
  if (params.name) user.name = params.name.trim();
  if (params.designation) user.designation = params.designation.trim();
  if (params.station) user.station = params.station.trim();
  if (params.radioChannel) user.radioChannel = params.radioChannel.trim();
  if (params.phone) user.phone = params.phone.trim();
  if (params.avatarUrl !== undefined) user.avatarUrl = params.avatarUrl;
  user.updatedAt = now;

  try {
    const db = await getDb();
    const usersCol = db.collection<UserDocument>("users");
    await usersCol.updateOne(
      { email: cleanEmail },
      {
        $set: {
          name: user.name,
          designation: user.designation,
          station: user.station,
          radioChannel: user.radioChannel,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          updatedAt: now,
        },
      }
    );
  } catch (err) {
    console.warn("[Users] Atlas profile update failed:", err);
  }

  const idx = inMemoryUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx >= 0) inMemoryUsers[idx] = user;

  await syncLocalUsers(inMemoryUsers);
  return user;
}
