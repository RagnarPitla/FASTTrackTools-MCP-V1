import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";

export function registerListCustomers(server: McpServer): void {
  server.tool(
    "list_customers",
    "List all FastTrack customer engagements. Optionally filter by status, region, or module.",
    {
      status: z
        .enum(["Active", "Onboarding", "Go-Live", "Post-Go-Live", "Completed"])
        .optional()
        .describe("Filter by engagement status"),
      region: z.string().optional().describe("Filter by region (e.g. North America, Europe)"),
      module: z.string().optional().describe("Filter by D365 module (e.g. Finance, Supply Chain Management)"),
    },
    async ({ status, region, module }) => {
      let customers = Array.from(store.customers.values());

      if (status) {
        customers = customers.filter((c) => c.status === status);
      }
      if (region) {
        customers = customers.filter((c) =>
          c.region.toLowerCase().includes(region.toLowerCase())
        );
      }
      if (module) {
        customers = customers.filter((c) =>
          c.d365Modules.some((m) =>
            m.toLowerCase().includes(module.toLowerCase())
          )
        );
      }

      if (customers.length === 0) {
        return {
          content: [{ type: "text", text: "No customers found matching the criteria." }],
        };
      }

      const summary = customers
        .map(
          (c) =>
            `- **${c.name}** (${c.id})\n  Status: ${c.status} | Region: ${c.region} | Type: ${c.engagementType}\n  Modules: ${c.d365Modules.join(", ")}\n  Go-Live: ${c.goLiveDate || "TBD"}${c.assignedArchitect ? `\n  Architect: ${c.assignedArchitect}` : ""}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `## FastTrack Customers (${customers.length})\n\n${summary}`,
          },
        ],
      };
    }
  );
}
