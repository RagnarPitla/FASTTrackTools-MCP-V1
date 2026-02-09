import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";

export function registerGetCustomer(server: McpServer): void {
  server.tool(
    "get_customer",
    "Get detailed information about a specific FastTrack customer by ID or name.",
    {
      identifier: z
        .string()
        .describe("Customer ID (e.g. cust-001) or customer name"),
    },
    async ({ identifier }) => {
      // Search by ID first, then by name
      let customer = store.customers.get(identifier);

      if (!customer) {
        const byName = Array.from(store.customers.values()).find(
          (c) => c.name.toLowerCase().includes(identifier.toLowerCase())
        );
        customer = byName;
      }

      if (!customer) {
        return {
          content: [
            { type: "text", text: `Customer not found: "${identifier}". Use list_customers to see available customers.` },
          ],
        };
      }

      // Get environments for this customer
      const environments = Array.from(store.environments.values()).filter(
        (e) => e.customerId === customer!.id
      );

      // Get checklist for this customer
      const checklist = store.checklists.get(customer.id) || [];
      const checklistSummary = {
        total: checklist.length,
        completed: checklist.filter((i) => i.status === "Completed").length,
        inProgress: checklist.filter((i) => i.status === "In Progress").length,
        notStarted: checklist.filter((i) => i.status === "Not Started").length,
        blocked: checklist.filter((i) => i.status === "Blocked").length,
      };

      const envList =
        environments.length > 0
          ? environments
              .map((e) => `  - ${e.name} (${e.type}) — v${e.version} — ${e.status}`)
              .join("\n")
          : "  No environments configured";

      const detail = `## ${customer.name}

| Field | Value |
|-------|-------|
| ID | ${customer.id} |
| Industry | ${customer.industry} |
| Region | ${customer.region} |
| Engagement | ${customer.engagementType} |
| Status | ${customer.status} |
| Go-Live Date | ${customer.goLiveDate || "TBD"} |
| Architect | ${customer.assignedArchitect || "Unassigned"} |
| Modules | ${customer.d365Modules.join(", ")} |

### Environments
${envList}

### Implementation Progress
- Total items: ${checklistSummary.total}
- Completed: ${checklistSummary.completed}
- In Progress: ${checklistSummary.inProgress}
- Not Started: ${checklistSummary.notStarted}
- Blocked: ${checklistSummary.blocked}

${customer.notes ? `### Notes\n${customer.notes}` : ""}`;

      return {
        content: [{ type: "text", text: detail }],
      };
    }
  );
}
