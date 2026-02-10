import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { extname } from "path";
import { logger } from "../../utils/logger.js";
import { OutputFormatter } from "../../utils/outputFormatter.js";
import type { ExtractionResult } from "../../types/index.js";

type ExtractionMode = "full" | "structure" | "imports" | "exports" | "comments";

interface CodeRecord {
  type: string;
  name: string;
  line: number;
  signature: string;
  body?: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".cs": "csharp",
  ".xpp": "xpp",
  ".xml": "xml",
  ".json": "json",
  ".py": "python",
  ".java": "java",
  ".sql": "sql",
};

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || "unknown";
}

function extractStructure(content: string, language: string): CodeRecord[] {
  const lines = content.split("\n");
  const records: CodeRecord[] = [];

  const patterns: Record<string, RegExp[]> = {
    typescript: [
      /^(export\s+)?(interface|type|enum|class|abstract\s+class)\s+(\w+)/,
      /^(export\s+)?(async\s+)?function\s+(\w+)/,
      /^\s*(public|private|protected|static|async)\s+(\w+)\s*\(/,
    ],
    javascript: [
      /^(export\s+)?(class)\s+(\w+)/,
      /^(export\s+)?(async\s+)?function\s+(\w+)/,
      /^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/,
    ],
    csharp: [
      /^\s*(public|private|protected|internal)?\s*(static\s+)?(partial\s+)?(class|interface|struct|enum|record)\s+(\w+)/,
      /^\s*(public|private|protected|internal)?\s*(static\s+)?(async\s+)?(virtual\s+)?(override\s+)?\w[\w<>\[\],\s]*\s+(\w+)\s*\(/,
    ],
    xpp: [
      /^\s*(public|private|protected)?\s*(static\s+)?(class|interface|table)\s+(\w+)/,
      /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+(\w+)\s*\(/,
    ],
    python: [
      /^class\s+(\w+)/,
      /^(async\s+)?def\s+(\w+)/,
    ],
    java: [
      /^\s*(public|private|protected)?\s*(static\s+)?(abstract\s+)?(class|interface|enum)\s+(\w+)/,
      /^\s*(public|private|protected)?\s*(static\s+)?(abstract\s+)?\w[\w<>\[\],\s]*\s+(\w+)\s*\(/,
    ],
  };

  const langPatterns = patterns[language] || patterns.typescript;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of langPatterns) {
      const match = line.match(pattern);
      if (match) {
        const signature = line.trim();
        // Extract a meaningful name from the match groups
        const nonEmpty = match.filter((g) => g && !g.match(/^\s*$/));
        const name = nonEmpty[nonEmpty.length - 1] || signature.substring(0, 50);
        const type = inferType(signature, language);

        records.push({
          type,
          name: name.replace(/\s*\($/, ""),
          line: i + 1,
          signature: signature.substring(0, 200),
        });
        break;
      }
    }
  }

  return records;
}

function inferType(signature: string, language: string): string {
  const s = signature.toLowerCase();
  if (s.includes("class")) return "class";
  if (s.includes("interface")) return "interface";
  if (s.includes("enum")) return "enum";
  if (s.includes("struct")) return "struct";
  if (s.includes("type ") && language === "typescript") return "type";
  if (s.includes("function") || s.includes("def ")) return "function";
  if (s.includes("table") && language === "xpp") return "table";
  return "method";
}

function extractImports(content: string, language: string): CodeRecord[] {
  const lines = content.split("\n");
  const records: CodeRecord[] = [];

  const importPatterns: Record<string, RegExp> = {
    typescript: /^import\s+.*/,
    javascript: /^(import|require)\s*\(?.*/,
    csharp: /^using\s+.*/,
    xpp: /^using\s+.*/,
    python: /^(import|from)\s+.*/,
    java: /^import\s+.*/,
  };

  const pattern = importPatterns[language] || importPatterns.typescript;

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i].trim())) {
      records.push({
        type: "import",
        name: lines[i].trim(),
        line: i + 1,
        signature: lines[i].trim(),
      });
    }
  }
  return records;
}

function extractExports(content: string, language: string): CodeRecord[] {
  const lines = content.split("\n");
  const records: CodeRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      (language === "typescript" || language === "javascript") &&
      line.startsWith("export ")
    ) {
      records.push({
        type: "export",
        name: line.substring(0, 80),
        line: i + 1,
        signature: line.substring(0, 200),
      });
    } else if (
      (language === "csharp" || language === "java" || language === "xpp") &&
      line.match(/^public\s+/)
    ) {
      records.push({
        type: "export",
        name: line.substring(0, 80),
        line: i + 1,
        signature: line.substring(0, 200),
      });
    }
  }
  return records;
}

function extractComments(content: string): CodeRecord[] {
  const records: CodeRecord[] = [];
  const lines = content.split("\n");

  let inBlock = false;
  let blockStart = 0;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // JSDoc / C# XML doc comments: /** ... */
    if (line.startsWith("/**") && !inBlock) {
      inBlock = true;
      blockStart = i + 1;
      blockLines = [line];
    } else if (inBlock) {
      blockLines.push(line);
      if (line.includes("*/")) {
        inBlock = false;
        records.push({
          type: "doc-comment",
          name: `Comment at line ${blockStart}`,
          line: blockStart,
          signature: blockLines.join("\n").substring(0, 500),
        });
        blockLines = [];
      }
    }

    // C# XML doc comments: ///
    if (line.startsWith("///")) {
      records.push({
        type: "xml-doc-comment",
        name: `Comment at line ${i + 1}`,
        line: i + 1,
        signature: line.substring(0, 200),
      });
    }
  }

  return records;
}

export function registerExtractCode(server: McpServer): void {
  server.tool(
    "extract_code",
    "Extract structured data from code files. Parses source files to extract classes, functions, interfaces, imports, and exports. Supports TypeScript, JavaScript, C#, X++, Python, Java, JSON, and XML.",
    {
      filePath: z.string().describe("Absolute path to the code file"),
      extractionMode: z
        .enum(["full", "structure", "imports", "exports", "comments"])
        .optional()
        .describe(
          "What to extract: 'full' returns all content, 'structure' returns class/function signatures, 'imports' returns import statements, 'exports' returns exported symbols, 'comments' returns doc comments. Default: 'structure'"
        ),
      language: z
        .string()
        .optional()
        .describe(
          "Language hint (e.g. 'typescript', 'csharp', 'xpp'). Auto-detected from extension if omitted."
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
    async ({ filePath, extractionMode, language, outputFormat, targetTool }) => {
      try {
        const content = await readFile(filePath, "utf-8");
        const lang = language || detectLanguage(filePath);
        const mode: ExtractionMode = extractionMode || "structure";

        let codeRecords: CodeRecord[];

        switch (mode) {
          case "full":
            codeRecords = content.split("\n").map((line, i) => ({
              type: "line",
              name: `${i + 1}`,
              line: i + 1,
              signature: line,
            }));
            // Cap at 500 lines for full mode
            if (codeRecords.length > 500) {
              codeRecords = codeRecords.slice(0, 500);
            }
            break;
          case "structure":
            codeRecords = extractStructure(content, lang);
            break;
          case "imports":
            codeRecords = extractImports(content, lang);
            break;
          case "exports":
            codeRecords = extractExports(content, lang);
            break;
          case "comments":
            codeRecords = extractComments(content);
            break;
          default:
            codeRecords = extractStructure(content, lang);
        }

        const records = codeRecords.map((r) => r as unknown as Record<string, unknown>);

        const result: ExtractionResult = {
          metadata: {
            source: "code",
            extractedAt: new Date().toISOString(),
            outputFormat: "json",
            recordCount: records.length,
          },
          records,
          fieldHints: {
            type: "Kind of code element (class, function, import, etc.)",
            name: "Element name or identifier",
            line: "Line number in the source file",
            signature: "Full signature or line content",
          },
        };

        const formatted = OutputFormatter.format(result, outputFormat, targetTool);
        return { content: [{ type: "text" as const, text: formatted }] };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        logger.error(`extract_code failed: ${message}`);
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
