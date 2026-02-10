import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { logger } from "../../utils/logger.js";
import { OutputFormatter } from "../../utils/outputFormatter.js";
import { resolveJsonPath, flattenObject } from "../../utils/jsonPath.js";
import type { ExtractionResult } from "../../types/index.js";

export function registerExtractJson(server: McpServer): void {
  server.tool(
    "extract_json",
    "Extract and transform data from JSON files or inline JSON strings. Supports JSONPath-like queries, field selection, and flattening of nested structures.",
    {
      source: z
        .string()
        .describe(
          "Either an absolute file path to a .json file, or an inline JSON string"
        ),
      jsonPath: z
        .string()
        .optional()
        .describe(
          "Dot-notation path to extract a nested value (e.g. 'data.customers' or 'results[0].name'). Extracts from root if omitted."
        ),
      selectFields: z
        .string()
        .optional()
        .describe(
          "Comma-separated list of fields to keep (e.g. 'name,id,status'). All fields returned if omitted."
        ),
      flatten: z
        .boolean()
        .optional()
        .describe(
          "Flatten nested objects into dot-notation keys. Default: false"
        ),
      outputFormat: z
        .enum(["json", "markdown", "summary", "key-value", "csv"])
        .optional()
        .describe(
          "Force a specific output format. If omitted, auto-detected from data shape and targetTool."
        ),
      targetTool: z
        .string()
        .optional()
        .describe(
          "Hint: name of the tool that will consume this output (e.g. 'add_customer'). Helps optimize output format and field mapping."
        ),
    },
    async ({ source, jsonPath, selectFields, flatten, outputFormat, targetTool }) => {
      try {
        // Determine if source is a file path or inline JSON
        let rawData: unknown;
        const trimmed = source.trim();
        const isFilePath =
          trimmed.startsWith("/") ||
          trimmed.startsWith("~") ||
          /^[A-Za-z]:\\/.test(trimmed);

        if (isFilePath) {
          const content = await readFile(trimmed, "utf-8");
          rawData = JSON.parse(content);
        } else {
          rawData = JSON.parse(trimmed);
        }

        // Apply JSONPath if provided
        let resolved = rawData;
        if (jsonPath) {
          resolved = resolveJsonPath(rawData, jsonPath);
          if (resolved === undefined) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No data found at path: ${jsonPath}`,
                },
              ],
            };
          }
        }

        // Normalize to array of records
        let records: Record<string, unknown>[];
        if (Array.isArray(resolved)) {
          records = resolved.map((item) => {
            if (typeof item === "object" && item !== null) {
              return item as Record<string, unknown>;
            }
            return { value: item };
          });
        } else if (typeof resolved === "object" && resolved !== null) {
          records = [resolved as Record<string, unknown>];
        } else {
          records = [{ value: resolved }];
        }

        // Apply field selection
        if (selectFields) {
          const fields = selectFields.split(",").map((f) => f.trim());
          records = records.map((r) => {
            const filtered: Record<string, unknown> = {};
            for (const field of fields) {
              if (field in r) {
                filtered[field] = r[field];
              }
            }
            return filtered;
          });
        }

        // Apply flattening
        if (flatten) {
          records = records.map((r) => flattenObject(r));
        }

        const warnings: string[] = [];
        if (records.length > 500) {
          records = records.slice(0, 500);
          warnings.push("Results truncated to 500 records.");
        }

        const result: ExtractionResult = {
          metadata: {
            source: "json",
            extractedAt: new Date().toISOString(),
            outputFormat: "json",
            recordCount: records.length,
            warnings: warnings.length > 0 ? warnings : undefined,
          },
          records,
        };

        const formatted = OutputFormatter.format(result, outputFormat, targetTool);
        return { content: [{ type: "text" as const, text: formatted }] };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        logger.error(`extract_json failed: ${message}`);
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
