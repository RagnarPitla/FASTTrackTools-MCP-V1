import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMethodologyResources(server: McpServer): void {
  // FastTrack Implementation Methodology
  server.resource(
    "fasttrack-methodology",
    "fasttrack://methodology",
    { mimeType: "text/markdown" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Microsoft FastTrack Implementation Methodology

## Overview
The FastTrack for Dynamics 365 methodology guides enterprise implementations through four key phases, ensuring successful deployment of D365 Finance & Operations.

## Phases

### 1. Initiate
- Define project scope, objectives, and success criteria
- Establish governance model (roles, responsibilities, escalation)
- Conduct solution overview and architecture review
- Set up LCS project and provision environments
- Identify key stakeholders and form project team

### 2. Implement
- Conduct Fit-Gap analysis workshops for all modules
- Design solution architecture (integrations, data model, security)
- Configure and customize D365 F&O
- Develop integrations with external systems
- Plan and execute data migration strategy
- Build reports and analytics
- Conduct unit testing and system integration testing

### 3. Prepare
- Execute User Acceptance Testing (UAT)
- Conduct performance testing and optimization
- Complete end-user training
- Finalize cutover plan and rehearsal
- Submit Go-Live Readiness Review to FastTrack
- Address all critical findings from readiness review
- Final data migration rehearsal

### 4. Operate
- Execute cutover plan
- Go-Live deployment
- Hypercare support period
- Monitor system performance and user adoption
- Transition to steady-state operations
- Post-implementation review and lessons learned

## Key Deliverables
- Solution Blueprint Document
- Fit-Gap Analysis Report
- Data Migration Plan
- Integration Architecture Document
- Test Strategy and Test Plans
- Cutover Plan
- Go-Live Readiness Checklist
- Hypercare Support Plan

## FastTrack Resources
- FastTrack Solution Architecture Reviews
- Go-Live Readiness Workshops
- Performance Optimization Guidance
- Best Practices Knowledge Base
- TechTalks and Community Resources
`,
        },
      ],
    })
  );

  // Best practices summary resource
  server.resource(
    "best-practices-summary",
    "fasttrack://best-practices",
    { mimeType: "application/json" },
    async (uri) => {
      const { store } = await import("../data/store.js");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(store.bestPractices, null, 2),
          },
        ],
      };
    }
  );
}
