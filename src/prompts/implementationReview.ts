import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerImplementationReviewPrompt(server: McpServer): void {
  server.prompt(
    "implementation_review",
    "Conduct a FastTrack implementation review for a D365 F&O customer. Provides a structured template for solution architects.",
    {
      customerName: z.string().describe("Customer name"),
      modules: z.string().describe("Comma-separated D365 modules in scope"),
      phase: z
        .enum(["Initiate", "Implement", "Prepare", "Operate"])
        .describe("Current implementation phase"),
      concerns: z
        .string()
        .optional()
        .describe("Any specific concerns or focus areas"),
    },
    ({ customerName, modules, phase, concerns }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are a Microsoft FastTrack Solution Architect conducting an implementation review for a Dynamics 365 Finance & Operations project.

## Customer: ${customerName}
## Modules in Scope: ${modules}
## Current Phase: ${phase}
${concerns ? `## Specific Concerns: ${concerns}` : ""}

Please conduct a thorough review covering:

1. **Architecture Assessment**
   - Solution design alignment with D365 best practices
   - Customization vs configuration decisions
   - Integration architecture review
   - Security model design

2. **Implementation Progress**
   - Phase-appropriate milestone completion
   - Risk identification and mitigation
   - Resource allocation and skill gaps

3. **Technical Readiness**
   - Environment setup and management
   - Data migration strategy and progress
   - Performance considerations
   - ISV solution compatibility

4. **Go-Live Readiness** (if applicable)
   - UAT completion status
   - Cutover plan readiness
   - Support model preparation
   - Training completion

5. **Recommendations**
   - Priority action items
   - Best practices to adopt
   - Risks to mitigate

Use the FastTrack MCP tools (list_customers, get_implementation_checklist, validate_environment_readiness, search_best_practices) to gather data about this customer before providing your assessment.`,
          },
        },
      ],
    })
  );
}
