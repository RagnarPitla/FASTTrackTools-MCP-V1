import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Customer tools
import { registerListCustomers } from "./customer/listCustomers.js";
import { registerGetCustomer } from "./customer/getCustomer.js";
import { registerManageCustomer } from "./customer/manageCustomer.js";

// Environment tools
import { registerGetEnvironmentInfo } from "./environment/getEnvironmentInfo.js";
import { registerValidateEnvironment } from "./environment/validateEnvironment.js";

// Implementation tools
import { registerGetChecklist } from "./implementation/getChecklist.js";
import { registerUpdateProgress } from "./implementation/updateProgress.js";

// Best Practices tools
import { registerSearchBestPractices } from "./bestPractices/searchBestPractices.js";

// Data Extraction tools
import { registerExtractEmail } from "./extraction/extractEmail.js";
import { registerExtractPdf } from "./extraction/extractPdf.js";
import { registerExtractDataverse } from "./extraction/extractDataverse.js";
import { registerExtractCode } from "./extraction/extractCode.js";
import { registerExtractJson } from "./extraction/extractJson.js";

export function registerAllTools(server: McpServer): void {
  // Customer Management
  registerListCustomers(server);
  registerGetCustomer(server);
  registerManageCustomer(server);

  // Environment Management
  registerGetEnvironmentInfo(server);
  registerValidateEnvironment(server);

  // Implementation Tracking
  registerGetChecklist(server);
  registerUpdateProgress(server);

  // Knowledge Base
  registerSearchBestPractices(server);

  // Data Extraction
  registerExtractEmail(server);
  registerExtractPdf(server);
  registerExtractDataverse(server);
  registerExtractCode(server);
  registerExtractJson(server);
}
