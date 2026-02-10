import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile, access } from "fs/promises";
import { logger } from "../../utils/logger.js";
import { OutputFormatter } from "../../utils/outputFormatter.js";
import type { ExtractionResult } from "../../types/index.js";

export function registerExtractPdf(server: McpServer): void {
  server.tool(
    "extract_pdf",
    "Extract text content from PDF files. Parses PDF documents and returns structured text content formatted for downstream tool consumption.",
    {
      filePath: z
        .string()
        .describe("Absolute path to the PDF file on disk"),
      pages: z
        .string()
        .optional()
        .describe(
          "Page range to extract (e.g. '1-5', '1,3,7', 'all'). Default: all"
        ),
      extractTables: z
        .boolean()
        .optional()
        .describe(
          "Attempt to detect and extract tabular data from the PDF. Default: false"
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
    },
    async ({ filePath, pages, extractTables, outputFormat, targetTool }) => {
      try {
        // Verify file exists
        await access(filePath);

        const buffer = await readFile(filePath);

        // Import pdf-parse v2 (class-based API)
        let PDFParse: new (options: { data: Uint8Array }) => {
          getText(params?: { partial?: number[]; first?: number; last?: number; pageJoiner?: string }): Promise<{ pages: Array<{ num: number; text: string }>; text: string; total: number }>;
          getTable(params?: { partial?: number[]; first?: number; last?: number }): Promise<{ pages: Array<{ num: number; tables: string[][][] }>; mergedTables: string[][][]; total: number }>;
          destroy(): Promise<void>;
        };
        try {
          const mod = await import("pdf-parse");
          PDFParse = mod.PDFParse;
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: "PDF parsing is not available. Install pdf-parse: npm install pdf-parse",
              },
            ],
          };
        }

        const data = new Uint8Array(buffer);
        const parser = new PDFParse({ data });

        try {
          // Build parse params for page selection
          const parseParams = buildParseParams(pages, 0);

          // Get text content
          const textResult = await parser.getText({
            ...parseParams,
            pageJoiner: "",
          });

          const records: Record<string, unknown>[] = [];
          const warnings: string[] = [];

          // Get tables if requested
          let tablePages: Map<number, string[][][]> | undefined;
          if (extractTables) {
            try {
              const tableResult = await parser.getTable(parseParams);
              tablePages = new Map();
              for (const page of tableResult.pages) {
                if (page.tables.length > 0) {
                  tablePages.set(page.num, page.tables);
                }
              }
            } catch (e) {
              warnings.push("Table extraction failed, returning text only.");
            }
          }

          for (const page of textResult.pages) {
            const text = page.text.trim();
            const record: Record<string, unknown> = {
              pageNumber: page.num,
              text: text.substring(0, 10000),
            };

            if (text.length > 10000) {
              warnings.push(
                `Page ${page.num} text truncated to 10,000 characters.`
              );
            }

            // Attach tables for this page if available
            if (tablePages?.has(page.num)) {
              const pageTables = tablePages.get(page.num)!;
              record.tables = pageTables.map((table) => {
                if (table.length === 0) return { headers: [], rows: [] };
                return {
                  headers: table[0],
                  rows: table.slice(1),
                };
              });
            }

            records.push(record);
          }

          const result: ExtractionResult = {
            metadata: {
              source: "pdf",
              extractedAt: new Date().toISOString(),
              outputFormat: "json",
              recordCount: records.length,
              warnings: warnings.length > 0 ? warnings : undefined,
            },
            records,
            fieldHints: {
              pageNumber: "PDF page number",
              text: "Extracted text content",
              tables: "Detected tabular data (if extractTables was true)",
            },
          };

          const formatted = OutputFormatter.format(result, outputFormat, targetTool);
          return { content: [{ type: "text" as const, text: formatted }] };
        } finally {
          await parser.destroy();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        logger.error(`extract_pdf failed: ${message}`);

        if (message.includes("ENOENT")) {
          return {
            content: [
              {
                type: "text" as const,
                text: `File not found: ${filePath}`,
              },
            ],
          };
        }

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

function buildParseParams(
  pages: string | undefined,
  _totalPages: number
): { partial?: number[]; first?: number; last?: number } {
  if (!pages || pages.toLowerCase() === "all") {
    return {};
  }

  // Parse page range into partial array (1-indexed page numbers)
  const pageNumbers: number[] = [];
  const parts = pages.split(",").map((p) => p.trim());

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = Math.max(1, parseInt(startStr, 10));
      const end = parseInt(endStr, 10);
      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page > 0) {
        pageNumbers.push(page);
      }
    }
  }

  if (pageNumbers.length > 0) {
    return { partial: [...new Set(pageNumbers)].sort((a, b) => a - b) };
  }

  return {};
}
