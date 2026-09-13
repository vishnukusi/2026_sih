/**
 * Canonical Users & Auth Session Types
 */

export type UserRole = "worker" | "manager";
export type UserStatus = "pending" | "approved" | "rejected";
export type AccountStatus = UserStatus;

export interface ApprovalRecord {
  approvedByManagerName: string;
  approvedByManagerBadge: string;
  approvedByManagerEmail: string;
  approvedByManagerDesignation: string;
  approvedAt: string | Date;
  assignedRole: UserRole;
  remarks?: string;
}

export interface UserDocument {
  _id?: string;
  name: string;
  email: string;
  password?: string;
  passwordHash?: string;
  role: UserRole;
  requestedRole?: UserRole;
  badgeId?: string;
  designation?: string;
  station?: string;
  radioChannel?: string;
  phone?: string;
  avatarUrl?: string;
  status: UserStatus;
  approval?: ApprovalRecord;
  rejectionReason?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  approvedBy?: string;
  approvedAt?: string;
}

export interface SessionClaims {
  userId: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
}
