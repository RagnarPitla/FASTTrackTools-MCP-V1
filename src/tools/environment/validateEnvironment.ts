import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { store } from "../../data/store.js";

export function registerValidateEnvironment(server: McpServer): void {
  server.tool(
    "validate_environment_readiness",
    "Validate a customer's environment setup against FastTrack best practices. Checks for common issues like missing UAT, version mismatches, and production readiness.",
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

      const findings: string[] = [];
      let score = 100;

      // Check: Has production environment
      const hasProd = environments.some((e) => e.type === "Production");
      if (!hasProd) {
        findings.push("CRITICAL: No Production environment configured.");
        score -= 30;
      }

      // Check: Has UAT environment
      const hasUAT = environments.some((e) => e.type === "UAT");
      if (!hasUAT) {
        findings.push("HIGH: No UAT environment configured. UAT is required before go-live.");
        score -= 20;
      }

      // Check: Has at least one Sandbox
      const hasSandbox = environments.some((e) => e.type === "Sandbox");
      if (!hasSandbox) {
        findings.push("MEDIUM: No Sandbox environment configured for development/testing.");
        score -= 10;
      }

      // Check: Version consistency
      const versions = new Set(environments.map((e) => e.version));
      if (versions.size > 1) {
        findings.push(
          `WARNING: Version mismatch across environments: ${Array.from(versions).join(", ")}. Ensure all environments are on the same version before go-live.`
        );
        score -= 15;
      }

      // Check: Production version is latest
      if (hasProd && hasUAT) {
        const prodEnv = environments.find((e) => e.type === "Production");
        const uatEnv = environments.find((e) => e.type === "UAT");
        if (prodEnv && uatEnv && prodEnv.version !== uatEnv.version) {
          findings.push(
            `WARNING: Production (v${prodEnv.version}) and UAT (v${uatEnv.version}) are on different versions.`
          );
          score -= 10;
        }
      }

      // Check: Decommissioned environments
      const decommissioned = environments.filter((e) => e.status === "Decommissioned");
      if (decommissioned.length > 0) {
        findings.push(
          `INFO: ${decommissioned.length} decommissioned environment(s) found. Consider cleaning up LCS resources.`
        );
      }

      if (findings.length === 0) {
        findings.push("All environment checks passed.");
      }

      const scoreLabel =
        score >= 90
          ? "Excellent"
          : score >= 70
            ? "Good"
            : score >= 50
              ? "Needs Attention"
              : "Critical Issues";

      return {
        content: [
          {
            type: "text",
            text: `## Environment Readiness Report — ${customer.name}\n\n**Score:** ${Math.max(0, score)}/100 (${scoreLabel})\n**Environments:** ${environments.length}\n\n### Findings\n${findings.map((f) => `- ${f}`).join("\n")}`,
          },
        ],
      };
    }
  );
}
