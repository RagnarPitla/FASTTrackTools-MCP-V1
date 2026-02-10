import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { authProvider } from "../../utils/authProvider.js";
import { OutputFormatter } from "../../utils/outputFormatter.js";
import type { ExtractionResult } from "../../types/index.js";

interface ODataResponse {
  value: Record<string, unknown>[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

function stripODataAnnotations(
  record: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (
      key.startsWith("@odata.") ||
      key.startsWith("@Microsoft.") ||
      key.startsWith("_") && key.endsWith("_value")
    ) {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

export function registerExtractDataverse(server: McpServer): void {
  server.tool(
    "extract_dataverse",
    "Extract data from Microsoft Dataverse via Web API (OData). Query any Dataverse table with filters, column selection, and expansions.",
    {
      table: z
        .string()
        .describe(
          "Dataverse table logical name (e.g. 'accounts', 'contacts', 'msdyn_projects')"
        ),
      select: z
        .string()
        .optional()
        .describe(
          "Comma-separated list of columns to return (OData $select)"
        ),
      filter: z
        .string()
        .optional()
        .describe(
          "OData $filter expression (e.g. \"statecode eq 0 and name eq 'Contoso'\")"
        ),
      expand: z
        .string()
        .optional()
        .describe(
          "OData $expand for related tables (e.g. 'primarycontactid($select=fullname,emailaddress1)')"
        ),
      top: z
        .number()
        .optional()
        .describe("Maximum records to return (default: 50, max: 500)"),
      orderBy: z
        .string()
        .optional()
        .describe("OData $orderby (e.g. 'createdon desc')"),
      environmentUrl: z
        .string()
        .optional()
        .describe(
          "Dataverse environment URL (e.g. 'https://org.crm.dynamics.com'). Overrides DATAVERSE_ENVIRONMENT_URL env var."
        ),
      outputFormat: z
        .enum(["json", "markdown", "summary", "key-value", "csv"])
        .optional()
        .describe(
          "Force a specific output format. If omitted, auto-detected."
        ),
      targetTool: z
        .string()
        .optional()
        .describe(
          "Hint: name of the tool that will consume this output."
        ),
      accessToken: z
        .string()
        .optional()
        .describe(
          "Pre-acquired Dataverse OAuth access token. Bypasses env-var auth if provided."
        ),
    },
    async ({
      table,
      select,
      filter,
      expand,
      top,
      orderBy,
      environmentUrl,
      outputFormat,
      targetTool,
      accessToken,
    }) => {
      try {
        // Resolve auth
        const token = accessToken || (await authProvider.getDataverseToken());

        // Resolve environment URL
        const envUrl =
          environmentUrl ||
          authProvider.getDataverseConfig()?.environmentUrl;
        if (!envUrl) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Dataverse environment URL not provided. Set DATAVERSE_ENVIRONMENT_URL or pass environmentUrl parameter.",
              },
            ],
          };
        }

        // Build OData URL
        const maxTop = Math.min(top || 50, 500);
        const baseUrl = `${envUrl.replace(/\/$/, "")}/api/data/v9.2/${table}`;

        const params = new URLSearchParams();
        params.set("$top", String(maxTop));
        if (select) params.set("$select", select);
        if (filter) params.set("$filter", filter);
        if (expand) params.set("$expand", expand);
        if (orderBy) params.set("$orderby", orderBy);

        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
          Prefer: "odata.include-annotations=*",
        };

        let allRecords: Record<string, unknown>[] = [];
        let nextLink: string | undefined =
          `${baseUrl}?${params.toString()}`;
        let pageCount = 0;
        const maxPages = 5;

        // Paginate through results
        while (nextLink && allRecords.length < maxTop && pageCount < maxPages) {
          const response = await fetch(nextLink, { headers });

          if (!response.ok) {
            const errorText = await response.text();
            logger.error(
              `Dataverse API error: ${response.status} ${errorText.substring(0, 200)}`
            );

            if (response.status === 401) {
              authProvider.clearCache();
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Authentication failed (401). Token may be expired or invalid. Check your Dataverse credentials.",
                  },
                ],
              };
            }

            if (response.status === 404) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Table '${table}' not found. Verify the logical name (e.g. 'accounts', 'contacts').`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Dataverse API error (${response.status}): ${errorText.substring(0, 300)}`,
                },
              ],
            };
          }

          const data = (await response.json()) as ODataResponse;
          const pageRecords = (data.value || []).map(stripODataAnnotations);
          allRecords = allRecords.concat(pageRecords);
          nextLink = data["@odata.nextLink"];
          pageCount++;
        }

        // Trim to requested max
        if (allRecords.length > maxTop) {
          allRecords = allRecords.slice(0, maxTop);
        }

        const warnings: string[] = [];
        if (nextLink && allRecords.length >= maxTop) {
          warnings.push(
            `More records available in Dataverse. Showing first ${allRecords.length} results.`
          );
        }

        const result: ExtractionResult = {
          metadata: {
            source: "dataverse",
            extractedAt: new Date().toISOString(),
            outputFormat: "json",
            recordCount: allRecords.length,
            warnings: warnings.length > 0 ? warnings : undefined,
          },
          records: allRecords,
        };

        const formatted = OutputFormatter.format(
          result,
          outputFormat,
          targetTool
        );
        return { content: [{ type: "text" as const, text: formatted }] };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        logger.error(`extract_dataverse failed: ${message}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Extraction failed: ${message}`,
            },
          ],
        };
      }
    }
  );
}
