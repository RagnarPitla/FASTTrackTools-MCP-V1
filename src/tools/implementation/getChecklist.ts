import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";

export function registerGetChecklist(server: McpServer): void {
  server.tool(
    "get_implementation_checklist",
    "Get the FastTrack implementation checklist for a customer. Optionally filter by phase (Initiate, Implement, Prepare, Operate) or status.",
    {
      customerId: z.string().describe("Customer ID (e.g. cust-001)"),
      phase: z
        .enum(["Initiate", "Implement", "Prepare", "Operate"])
        .optional()
        .describe("Filter by implementation phase"),
      status: z
        .enum(["Not Started", "In Progress", "Completed", "Blocked", "N/A"])
        .optional()
        .describe("Filter by item status"),
    },
    async ({ customerId, phase, status }) => {
      const customer = store.customers.get(customerId);
      if (!customer) {
        return {
          content: [{ type: "text", text: `Customer not found: ${customerId}` }],
        };
      }

      let checklist = store.checklists.get(customerId) || [];

      if (checklist.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No implementation checklist found for ${customer.name}. Use add_checklist_item to create one.`,
            },
          ],
        };
      }

      if (phase) {
        checklist = checklist.filter((i) => i.phase === phase);
      }
      if (status) {
        checklist = checklist.filter((i) => i.status === status);
      }

      // Group by phase
      const grouped: Record<string, typeof checklist> = {};
      for (const item of checklist) {
        if (!grouped[item.phase]) grouped[item.phase] = [];
        grouped[item.phase].push(item);
      }

      let output = `## Implementation Checklist — ${customer.name}\n\n`;

      for (const [phaseName, items] of Object.entries(grouped)) {
        const completed = items.filter((i) => i.status === "Completed").length;
        output += `### ${phaseName} (${completed}/${items.length} complete)\n\n`;

        for (const item of items) {
          const icon =
            item.status === "Completed"
              ? "[x]"
              : item.status === "In Progress"
                ? "[-]"
                : item.status === "Blocked"
                  ? "[!]"
                  : "[ ]";
          output += `- ${icon} **${item.title}** (${item.id})\n  ${item.description}\n  Status: ${item.status}${item.owner ? ` | Owner: ${item.owner}` : ""}${item.dueDate ? ` | Due: ${item.dueDate}` : ""}\n\n`;
        }
      }

      return {
        content: [{ type: "text", text: output }],
      };
    }
  );
}
