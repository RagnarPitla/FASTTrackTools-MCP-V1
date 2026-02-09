import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerImplementationReviewPrompt } from "./implementationReview.js";
import { registerGoLiveReadinessPrompt } from "./goLiveReadiness.js";

export function registerAllPrompts(server: McpServer): void {
  registerImplementationReviewPrompt(server);
  registerGoLiveReadinessPrompt(server);
}
