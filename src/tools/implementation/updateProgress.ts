import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";
import type { ChecklistItem, ChecklistPhase } from "../../types/index.js";

export function registerUpdateProgress(server: McpServer): void {
  server.tool(
    "update_checklist_item",
    "Update the status of a checklist item for a customer implementation.",
    {
      customerId: z.string().describe("Customer ID (e.g. cust-001)"),
      itemId: z.string().describe("Checklist item ID (e.g. chk-001)"),
      status: z
        .enum(["Not Started", "In Progress", "Completed", "Blocked", "N/A"])
        .describe("New status for the item"),
      notes: z.string().optional().describe("Optional notes about the update"),
    },
    async ({ customerId, itemId, status, notes }) => {
      const checklist = store.checklists.get(customerId);
      if (!checklist) {
        return {
          content: [
            { type: "text", text: `No checklist found for customer: ${customerId}` },
          ],
        };
      }

      const item = checklist.find((i) => i.id === itemId);
      if (!item) {
        return {
          content: [
            { type: "text", text: `Checklist item not found: ${itemId}` },
          ],
        };
      }

      const previous = item.status;
      item.status = status;
      if (notes) {
        item.notes = notes;
      }

      return {
        content: [
          {
            type: "text",
            text: `Checklist item updated.\n\n**${item.title}** (${item.id})\n${previous} → ${status}${notes ? `\nNotes: ${notes}` : ""}`,
          },
        ],
      };
    }
  );

  server.tool(
    "add_checklist_item",
    "Add a new item to a customer's implementation checklist.",
    {
      customerId: z.string().describe("Customer ID"),
      phase: z
        .enum(["Initiate", "Implement", "Prepare", "Operate"])
        .describe("Implementation phase"),
      category: z
        .string()
        .describe("Category (e.g. Solution Design, Data Migration, Testing)"),
      title: z.string().describe("Item title"),
      description: z.string().describe("Item description"),
      owner: z.string().optional().describe("Responsible person or role"),
      dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    },
    async ({ customerId, phase, category, title, description, owner, dueDate }) => {
      const customer = store.customers.get(customerId);
      if (!customer) {
        return {
          content: [{ type: "text", text: `Customer not found: ${customerId}` }],
        };
      }

      let checklist = store.checklists.get(customerId);
      if (!checklist) {
        checklist = [];
        store.checklists.set(customerId, checklist);
      }

      const id = `chk-${String(checklist.length + 1).padStart(3, "0")}`;
      const item: ChecklistItem = {
        id,
        phase: phase as ChecklistPhase,
        category,
        title,
        description,
        status: "Not Started",
        owner,
        dueDate,
      };

      checklist.push(item);

      return {
        content: [
          {
            type: "text",
            text: `Checklist item added for ${customer.name}.\n\n**ID:** ${id}\n**Phase:** ${phase}\n**Title:** ${title}${owner ? `\n**Owner:** ${owner}` : ""}${dueDate ? `\n**Due:** ${dueDate}` : ""}`,
          },
        ],
      };
    }
  );
}
