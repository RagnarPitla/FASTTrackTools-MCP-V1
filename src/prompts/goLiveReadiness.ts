import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerGoLiveReadinessPrompt(server: McpServer): void {
  server.prompt(
    "golive_readiness_assessment",
    "Perform a Go-Live Readiness assessment for a D365 F&O customer following the FastTrack Go-Live Readiness Review framework.",
    {
      customerName: z.string().describe("Customer name"),
      customerId: z.string().describe("Customer ID for data lookup"),
      plannedGoLiveDate: z.string().describe("Planned go-live date (YYYY-MM-DD)"),
    },
    ({ customerName, customerId, plannedGoLiveDate }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are a Microsoft FastTrack Solution Architect performing the official Go-Live Readiness Review for a Dynamics 365 Finance & Operations implementation.

## Customer: ${customerName} (${customerId})
## Planned Go-Live Date: ${plannedGoLiveDate}

Please use the FastTrack MCP tools to gather all available data:
1. Call get_customer with identifier "${customerId}" for customer details
2. Call get_environments with customerId "${customerId}" for environment info
3. Call validate_environment_readiness with customerId "${customerId}" for env validation
4. Call get_implementation_checklist with customerId "${customerId}" for progress

Then provide a comprehensive Go-Live Readiness assessment covering:

### 1. Project Readiness
- Implementation progress against plan
- Outstanding blockers or critical items
- Change management and training status

### 2. Solution Readiness
- Configuration completeness
- Customization code quality and testing
- Integration testing results
- Data migration validation

### 3. Environment Readiness
- Production environment provisioned and validated
- Version alignment across environments
- Performance benchmarks met

### 4. Operational Readiness
- Cutover plan documented and rehearsed
- Rollback procedures defined
- Hypercare support team and processes ready
- Monitoring and alerting configured

### 5. Go/No-Go Recommendation
- Clear GO or NO-GO recommendation with justification
- If NO-GO: specific items that must be resolved
- If GO: remaining risk items and mitigation plans

### Risk Rating
Assign an overall risk rating: LOW / MEDIUM / HIGH / CRITICAL`,
          },
        },
      ],
    })
  );
}
