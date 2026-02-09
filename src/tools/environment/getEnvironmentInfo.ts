import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";

export function registerGetEnvironmentInfo(server: McpServer): void {
  server.tool(
    "get_environments",
    "Get D365 F&O environment information for a customer. Lists all environments (Sandbox, UAT, Production, etc.).",
    {
      customerId: z.string().describe("Customer ID (e.g. cust-001)"),
    },
    async ({ customerId }) => {
      const customer = store.customers.get(customerId);
      if (!customer) {
        return {
          content: [{ type: "text", text: `Customer not found: ${customerId}` }],
        };
      }

      const environments = Array.from(store.environments.values()).filter(
        (e) => e.customerId === customerId
      );

      if (environments.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No environments configured for ${customer.name} (${customerId}).`,
            },
          ],
        };
      }

      const envTable = environments
        .map(
          (e) =>
            `| ${e.name} | ${e.type} | ${e.region} | v${e.version} | ${e.status} | ${e.lcsProjectId || "N/A"} |`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `## Environments for ${customer.name}\n\n| Name | Type | Region | Version | Status | LCS Project |\n|------|------|--------|---------|--------|-------------|\n${envTable}`,
          },
        ],
      };
    }
  );

  server.tool(
    "add_environment",
    "Add a new D365 F&O environment for a customer.",
    {
      customerId: z.string().describe("Customer ID"),
      name: z.string().describe("Environment name (e.g. Contoso-UAT)"),
      type: z
        .enum(["Sandbox", "UAT", "Production", "DevTest", "Build"])
        .describe("Environment type"),
      region: z.string().describe("Azure region (e.g. East US, West Europe)"),
      version: z.string().describe("D365 F&O version (e.g. 10.0.40)"),
      lcsProjectId: z.string().optional().describe("LCS Project ID"),
      url: z.string().optional().describe("Environment URL"),
    },
    async ({ customerId, name, type, region, version, lcsProjectId, url }) => {
      const customer = store.customers.get(customerId);
      if (!customer) {
        return {
          content: [{ type: "text", text: `Customer not found: ${customerId}` }],
        };
      }

      const id = `env-${String(store.environments.size + 1).padStart(3, "0")}`;

      store.environments.set(id, {
        id,
        customerId,
        name,
        type,
        region,
        version,
        lcsProjectId,
        url,
        status: "Active",
      });

      return {
        content: [
          {
            type: "text",
            text: `Environment added for ${customer.name}.\n\n**ID:** ${id}\n**Name:** ${name}\n**Type:** ${type}\n**Version:** v${version}\n**Region:** ${region}`,
          },
        ],
      };
    }
  );
}
