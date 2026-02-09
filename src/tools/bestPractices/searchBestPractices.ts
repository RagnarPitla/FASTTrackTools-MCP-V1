import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";

export function registerSearchBestPractices(server: McpServer): void {
  server.tool(
    "search_best_practices",
    "Search the FastTrack best practices knowledge base for D365 F&O. Search by module, category, severity, or keyword.",
    {
      query: z
        .string()
        .optional()
        .describe("Free-text search across titles, descriptions, and tags"),
      module: z
        .string()
        .optional()
        .describe("Filter by D365 module (e.g. Finance, Supply Chain Management, General)"),
      severity: z
        .enum(["Critical", "High", "Medium", "Low"])
        .optional()
        .describe("Filter by severity level"),
    },
    async ({ query, module, severity }) => {
      let results = [...store.bestPractices];

      if (module) {
        results = results.filter(
          (bp) => bp.module.toLowerCase().includes(module.toLowerCase())
        );
      }

      if (severity) {
        results = results.filter((bp) => bp.severity === severity);
      }

      if (query) {
        const q = query.toLowerCase();
        results = results.filter(
          (bp) =>
            bp.title.toLowerCase().includes(q) ||
            bp.description.toLowerCase().includes(q) ||
            bp.recommendation.toLowerCase().includes(q) ||
            bp.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No best practices found matching your criteria. Try broadening your search.",
            },
          ],
        };
      }

      const output = results
        .map(
          (bp) =>
            `### ${bp.title} (${bp.id})\n**Module:** ${bp.module} | **Category:** ${bp.category} | **Severity:** ${bp.severity}\n\n${bp.description}\n\n**Recommendation:** ${bp.recommendation}\n\n**Tags:** ${bp.tags.join(", ")}`
        )
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text",
            text: `## FastTrack Best Practices (${results.length} results)\n\n${output}`,
          },
        ],
      };
    }
  );
}
