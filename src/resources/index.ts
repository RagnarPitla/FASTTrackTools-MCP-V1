import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCustomerResources } from "./customerResource.js";
import { registerMethodologyResources } from "./methodologyResource.js";

export function registerAllResources(server: McpServer): void {
  registerCustomerResources(server);
  registerMethodologyResources(server);
}
