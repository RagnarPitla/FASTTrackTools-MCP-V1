import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";
import type { Customer } from "../../types/index.js";

export function registerManageCustomer(server: McpServer): void {
  server.tool(
    "add_customer",
    "Add a new customer engagement to the FastTrack MCP server.",
    {
      name: z.string().describe("Customer/organization name"),
      industry: z.string().describe("Industry (e.g. Manufacturing, Retail, Distribution)"),
      region: z.string().describe("Region (e.g. North America, Europe, Asia Pacific)"),
      engagementType: z
        .enum(["FastTrack", "Unified", "Direct"])
        .describe("Type of engagement"),
      d365Modules: z
        .string()
        .describe("Comma-separated list of D365 modules (e.g. Finance, Supply Chain Management)"),
      goLiveDate: z.string().optional().describe("Planned go-live date (YYYY-MM-DD)"),
      assignedArchitect: z.string().optional().describe("Assigned solution architect name"),
    },
    async ({ name, industry, region, engagementType, d365Modules, goLiveDate, assignedArchitect }) => {
      const id = `cust-${String(store.customers.size + 1).padStart(3, "0")}`;
      const now = new Date().toISOString();

      const customer: Customer = {
        id,
        name,
        industry,
        region,
        engagementType,
        status: "Onboarding",
        d365Modules: d365Modules.split(",").map((m) => m.trim()),
        goLiveDate,
        assignedArchitect,
        createdAt: now,
        updatedAt: now,
      };

      store.customers.set(id, customer);

      return {
        content: [
          {
            type: "text",
            text: `Customer added successfully.\n\n**ID:** ${id}\n**Name:** ${name}\n**Status:** Onboarding\n**Modules:** ${customer.d365Modules.join(", ")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "update_customer_status",
    "Update the status of an existing customer engagement.",
    {
      customerId: z.string().describe("Customer ID (e.g. cust-001)"),
      status: z
        .enum(["Active", "Onboarding", "Go-Live", "Post-Go-Live", "Completed"])
        .describe("New engagement status"),
      notes: z.string().optional().describe("Optional notes about the status change"),
    },
    async ({ customerId, status, notes }) => {
      const customer = store.customers.get(customerId);
      if (!customer) {
        return {
          content: [{ type: "text", text: `Customer not found: ${customerId}` }],
        };
      }

      const previousStatus = customer.status;
      customer.status = status;
      customer.updatedAt = new Date().toISOString();
      if (notes) {
        customer.notes = notes;
      }

      return {
        content: [
          {
            type: "text",
            text: `Customer **${customer.name}** status updated: ${previousStatus} → ${status}${notes ? `\nNotes: ${notes}` : ""}`,
          },
        ],
      };
    }
  );
}
