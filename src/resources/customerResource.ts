import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { store } from "../data/store.js";

export function registerCustomerResources(server: McpServer): void {
  // Static resource: list of all customers
  server.resource(
    "customer-list",
    "fasttrack://customers",
    { mimeType: "application/json" },
    async (uri) => {
      const customers = Array.from(store.customers.values());
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(customers, null, 2),
          },
        ],
      };
    }
  );

  // Dynamic resource: individual customer by ID
  server.resource(
    "customer-detail",
    new ResourceTemplate("fasttrack://customers/{customerId}", { list: undefined }),
    { mimeType: "application/json" },
    async (uri, { customerId }) => {
      const customer = store.customers.get(customerId as string);
      if (!customer) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Customer not found: ${customerId}`,
            },
          ],
        };
      }

      const environments = Array.from(store.environments.values()).filter(
        (e) => e.customerId === customer.id
      );
      const checklist = store.checklists.get(customer.id) || [];

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ customer, environments, checklist }, null, 2),
          },
        ],
      };
    }
  );
}
