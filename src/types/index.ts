// ── Customer Types ──

export interface Customer {
  id: string;
  name: string;
  industry: string;
  region: string;
  engagementType: "FastTrack" | "Unified" | "Direct";
  status: "Active" | "Onboarding" | "Go-Live" | "Post-Go-Live" | "Completed";
  d365Modules: string[];
  goLiveDate?: string;
  assignedArchitect?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Environment Types ──

export interface D365Environment {
  id: string;
  customerId: string;
  name: string;
  type: "Sandbox" | "UAT" | "Production" | "DevTest" | "Build";
  region: string;
  version: string;
  lcsProjectId?: string;
  url?: string;
  status: "Active" | "Provisioning" | "Decommissioned";
}

// ── Implementation Types ──

export type ChecklistPhase =
  | "Initiate"
  | "Implement"
  | "Prepare"
  | "Operate";

export interface ChecklistItem {
  id: string;
  phase: ChecklistPhase;
  category: string;
  title: string;
  description: string;
  status: "Not Started" | "In Progress" | "Completed" | "Blocked" | "N/A";
  owner?: string;
  dueDate?: string;
  notes?: string;
}

// ── Best Practices Types ──

export interface BestPractice {
  id: string;
  module: string;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  tags: string[];
}
