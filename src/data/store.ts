import type {
  Customer,
  D365Environment,
  ChecklistItem,
  BestPractice,
} from "../types/index.js";

/**
 * In-memory data store for the FastTrack MCP Server.
 *
 * Replace this with a database connection (Dataverse, SQL, CosmosDB, etc.)
 * when moving to production.
 */
class FastTrackStore {
  customers: Map<string, Customer> = new Map();
  environments: Map<string, D365Environment> = new Map();
  checklists: Map<string, ChecklistItem[]> = new Map();
  bestPractices: BestPractice[] = [];

  constructor() {
    this.seedData();
  }

  private seedData() {
    // ── Sample Customers ──
    const sampleCustomers: Customer[] = [
      {
        id: "cust-001",
        name: "Contoso Manufacturing",
        industry: "Manufacturing",
        region: "North America",
        engagementType: "FastTrack",
        status: "Active",
        d365Modules: [
          "Finance",
          "Supply Chain Management",
          "Production Control",
        ],
        goLiveDate: "2026-06-15",
        assignedArchitect: "Ragnar Pitla",
        createdAt: "2025-11-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "cust-002",
        name: "Northwind Traders",
        industry: "Retail",
        region: "Europe",
        engagementType: "FastTrack",
        status: "Onboarding",
        d365Modules: ["Finance", "Commerce", "Warehouse Management"],
        goLiveDate: "2026-09-01",
        assignedArchitect: "Ragnar Pitla",
        createdAt: "2026-01-15T00:00:00Z",
        updatedAt: "2026-02-05T00:00:00Z",
      },
      {
        id: "cust-003",
        name: "Adventure Works",
        industry: "Distribution",
        region: "Asia Pacific",
        engagementType: "Unified",
        status: "Go-Live",
        d365Modules: [
          "Finance",
          "Supply Chain Management",
          "Transportation Management",
        ],
        goLiveDate: "2026-03-01",
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2026-02-08T00:00:00Z",
      },
    ];

    for (const c of sampleCustomers) {
      this.customers.set(c.id, c);
    }

    // ── Sample Environments ──
    const sampleEnvironments: D365Environment[] = [
      {
        id: "env-001",
        customerId: "cust-001",
        name: "Contoso-Sandbox-T1",
        type: "Sandbox",
        region: "East US",
        version: "10.0.40",
        status: "Active",
      },
      {
        id: "env-002",
        customerId: "cust-001",
        name: "Contoso-UAT",
        type: "UAT",
        region: "East US",
        version: "10.0.40",
        status: "Active",
      },
      {
        id: "env-003",
        customerId: "cust-001",
        name: "Contoso-Prod",
        type: "Production",
        region: "East US",
        version: "10.0.39",
        status: "Active",
      },
    ];

    for (const e of sampleEnvironments) {
      this.environments.set(e.id, e);
    }

    // ── Sample Checklist for cust-001 ──
    const contosoChecklist: ChecklistItem[] = [
      {
        id: "chk-001",
        phase: "Initiate",
        category: "Project Governance",
        title: "Define project scope and objectives",
        description:
          "Document the business objectives, project scope, and success criteria for the D365 F&O implementation.",
        status: "Completed",
        owner: "Project Manager",
      },
      {
        id: "chk-002",
        phase: "Initiate",
        category: "Project Governance",
        title: "Establish governance model",
        description:
          "Define roles, responsibilities, escalation paths, and decision-making processes.",
        status: "Completed",
        owner: "Project Manager",
      },
      {
        id: "chk-003",
        phase: "Implement",
        category: "Solution Design",
        title: "Complete Fit-Gap analysis",
        description:
          "Conduct fit-gap workshops for all in-scope modules to identify customization needs.",
        status: "In Progress",
        owner: "Solution Architect",
      },
      {
        id: "chk-004",
        phase: "Implement",
        category: "Data Migration",
        title: "Define data migration strategy",
        description:
          "Plan data migration approach including entity mapping, data cleansing, and validation.",
        status: "Not Started",
        owner: "Data Architect",
      },
      {
        id: "chk-005",
        phase: "Implement",
        category: "Integration",
        title: "Design integration architecture",
        description:
          "Define integration patterns, middleware, and data flows for all external systems.",
        status: "Not Started",
        owner: "Integration Architect",
      },
      {
        id: "chk-006",
        phase: "Prepare",
        category: "Testing",
        title: "Execute UAT",
        description:
          "Run user acceptance testing with business stakeholders across all configured processes.",
        status: "Not Started",
        owner: "Test Lead",
      },
      {
        id: "chk-007",
        phase: "Prepare",
        category: "Cutover",
        title: "Create cutover plan",
        description:
          "Define step-by-step cutover plan including rollback procedures.",
        status: "Not Started",
        owner: "Project Manager",
      },
      {
        id: "chk-008",
        phase: "Operate",
        category: "Support",
        title: "Establish hypercare support model",
        description:
          "Set up post-go-live support structure with escalation matrix and SLAs.",
        status: "Not Started",
        owner: "Support Lead",
      },
    ];

    this.checklists.set("cust-001", contosoChecklist);

    // ── Sample Best Practices ──
    this.bestPractices = [
      {
        id: "bp-001",
        module: "Finance",
        category: "Chart of Accounts",
        title: "Keep the chart of accounts flat",
        description:
          "Avoid deeply nested account structures. Use financial dimensions for reporting granularity instead of creating separate main accounts.",
        recommendation:
          "Limit main accounts to 4-5 digit codes. Use financial dimensions (Business Unit, Department, Cost Center) for reporting segmentation.",
        severity: "High",
        tags: ["finance", "chart-of-accounts", "configuration"],
      },
      {
        id: "bp-002",
        module: "Supply Chain Management",
        category: "Warehouse Management",
        title: "Plan warehouse configuration before go-live",
        description:
          "Warehouse management module configurations are difficult to change post-go-live. Plan thoroughly.",
        recommendation:
          "Complete all warehouse zone, location profile, and work template configurations during the Implement phase. Test with realistic volumes.",
        severity: "Critical",
        tags: ["scm", "warehouse", "configuration"],
      },
      {
        id: "bp-003",
        module: "General",
        category: "Performance",
        title: "Optimize batch job scheduling",
        description:
          "Poorly scheduled batch jobs can cause performance degradation and timeout issues.",
        recommendation:
          "Stagger batch jobs, use batch groups to distribute load, and monitor batch job execution times regularly.",
        severity: "High",
        tags: ["performance", "batch-jobs", "operations"],
      },
      {
        id: "bp-004",
        module: "General",
        category: "Data Migration",
        title: "Use data entities for migration",
        description:
          "Leverage standard D365 F&O data entities through the Data Management Framework for data import/export.",
        recommendation:
          "Identify all required data entities early. Run test migrations in sandbox. Validate data integrity with reconciliation reports.",
        severity: "High",
        tags: ["data-migration", "data-entities", "dmf"],
      },
      {
        id: "bp-005",
        module: "General",
        category: "Integration",
        title: "Use OData and Dataverse virtual entities for integrations",
        description:
          "Prefer standard integration patterns over custom APIs to reduce maintenance burden.",
        recommendation:
          "Use OData endpoints for synchronous calls, Dataverse virtual entities for Power Platform integration, and Business Events for event-driven patterns.",
        severity: "Medium",
        tags: ["integration", "odata", "dataverse", "business-events"],
      },
      {
        id: "bp-006",
        module: "Finance",
        category: "Number Sequences",
        title: "Plan number sequences before configuration",
        description:
          "Number sequences affect voucher numbers, document numbers, and master data IDs across all modules.",
        recommendation:
          "Document all number sequence requirements across modules. Use continuous sequences only when legally required. Prefer non-continuous for performance.",
        severity: "Medium",
        tags: ["finance", "number-sequences", "configuration"],
      },
      {
        id: "bp-007",
        module: "General",
        category: "Go-Live",
        title: "Complete Go-Live Readiness Review",
        description:
          "The FastTrack Go-Live Readiness Review ensures all critical areas are validated before production cutover.",
        recommendation:
          "Submit the Go-Live Readiness checklist at least 4 weeks before planned go-live. Address all critical findings before proceeding.",
        severity: "Critical",
        tags: ["go-live", "readiness", "fasttrack"],
      },
    ];
  }
}

export const store = new FastTrackStore();
