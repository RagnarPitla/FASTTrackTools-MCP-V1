import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllPrompts } from "./prompts/index.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "fasttrack-d365-mcp",
    version: "1.0.0",
  });

  registerAllTools(server);
  registerAllResources(server);
  registerAllPrompts(server);

  return server;
}
