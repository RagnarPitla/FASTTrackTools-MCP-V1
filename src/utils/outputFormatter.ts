import type {
  ExtractionResult,
  ExtractionOutputFormat,
} from "../types/index.js";

/** Maps target tool names to their preferred input format */
const TARGET_TOOL_FORMAT_MAP: Record<string, ExtractionOutputFormat> = {
  add_customer: "json",
  update_customer_status: "json",
  add_environment: "json",
  add_checklist_item: "json",
  update_checklist_item: "json",
  search_best_practices: "markdown",
  get_implementation_checklist: "markdown",
  get_customer: "key-value",
  list_customers: "csv",
  get_environments: "csv",
  validate_environment_readiness: "summary",
};

/** Fields expected by write-target tools (for field mapping) */
const TARGET_TOOL_FIELDS: Record<string, string[]> = {
  add_customer: [
    "name",
    "industry",
    "region",
    "engagementType",
    "d365Modules",
    "goLiveDate",
    "assignedArchitect",
  ],
  add_environment: [
    "customerId",
    "name",
    "type",
    "region",
    "version",
    "lcsProjectId",
    "url",
  ],
  add_checklist_item: [
    "customerId",
    "phase",
    "category",
    "title",
    "description",
    "owner",
    "dueDate",
  ],
  update_customer_status: ["customerId", "status", "notes"],
  update_checklist_item: ["customerId", "itemId", "status", "notes"],
};

export class OutputFormatter {
  /**
   * Main entry point. Determines output format and renders the result.
   */
  static format(
    result: ExtractionResult,
    explicitFormat?: ExtractionOutputFormat,
    targetTool?: string
  ): string {
    const format = OutputFormatter.resolveFormat(
      result,
      explicitFormat,
      targetTool
    );
    result.metadata.outputFormat = format;
    if (targetTool) result.metadata.targetTool = targetTool;

    const mappedFields = targetTool
      ? OutputFormatter.mapFieldsToTarget(result.records, targetTool)
      : null;

    switch (format) {
      case "json":
        return OutputFormatter.renderJson(result, mappedFields);
      case "markdown":
        return OutputFormatter.renderMarkdown(result);
      case "summary":
        return OutputFormatter.renderSummary(result);
      case "key-value":
        return OutputFormatter.renderKeyValue(result);
      case "csv":
        return OutputFormatter.renderCsv(result);
      default:
        return OutputFormatter.renderJson(result, mappedFields);
    }
  }

  static resolveFormat(
    result: ExtractionResult,
    explicitFormat?: ExtractionOutputFormat,
    targetTool?: string
  ): ExtractionOutputFormat {
    // Priority 1: explicit override
    if (explicitFormat) return explicitFormat;

    // Priority 2: target tool hint
    if (targetTool && TARGET_TOOL_FORMAT_MAP[targetTool]) {
      return TARGET_TOOL_FORMAT_MAP[targetTool];
    }

    // Priority 3: data shape heuristics
    return OutputFormatter.detectFormatFromData(result.records);
  }

  static mapFieldsToTarget(
    records: Record<string, unknown>[],
    targetTool: string
  ): Record<string, unknown> | null {
    const expectedFields = TARGET_TOOL_FIELDS[targetTool];
    if (!expectedFields || records.length === 0) return null;

    const sourceRecord = records[0];
    const mapped: Record<string, unknown> = {};

    for (const expected of expectedFields) {
      // Exact match (case-insensitive)
      const exactKey = Object.keys(sourceRecord).find(
        (k) => k.toLowerCase() === expected.toLowerCase()
      );
      if (exactKey) {
        mapped[expected] = sourceRecord[exactKey];
        continue;
      }

      // Contains match
      const containsKey = Object.keys(sourceRecord).find(
        (k) =>
          k.toLowerCase().includes(expected.toLowerCase()) ||
          expected.toLowerCase().includes(k.toLowerCase())
      );
      if (containsKey) {
        mapped[expected] = sourceRecord[containsKey];
        continue;
      }

      mapped[expected] = undefined;
    }

    return mapped;
  }

  private static detectFormatFromData(
    records: Record<string, unknown>[]
  ): ExtractionOutputFormat {
    if (records.length === 0) return "json";

    // Single record with nested objects -> key-value or json
    if (records.length === 1) {
      const depth = OutputFormatter.getMaxDepth(records[0]);
      if (depth > 2) return "json";
      return "key-value";
    }

    // Multiple flat records -> csv
    const allFlat = records.every((r) =>
      Object.values(r).every(
        (v) => typeof v !== "object" || v === null || Array.isArray(v)
      )
    );
    if (allFlat && records.length > 3) return "csv";

    // Records with long text fields -> markdown
    const hasLongText = records.some((r) =>
      Object.values(r).some(
        (v) => typeof v === "string" && v.length > 200
      )
    );
    if (hasLongText) return "markdown";

    return "json";
  }

  private static getMaxDepth(obj: unknown, depth = 0): number {
    if (
      obj === null ||
      typeof obj !== "object" ||
      Array.isArray(obj)
    ) {
      return depth;
    }
    let max = depth;
    for (const value of Object.values(obj as Record<string, unknown>)) {
      max = Math.max(max, OutputFormatter.getMaxDepth(value, depth + 1));
    }
    return max;
  }

  private static renderJson(
    result: ExtractionResult,
    mappedFields?: Record<string, unknown> | null
  ): string {
    const output: Record<string, unknown> = {
      metadata: result.metadata,
      records: result.records,
    };
    if (mappedFields) {
      output.mappedFields = mappedFields;
    }
    return JSON.stringify(output, null, 2);
  }

  private static renderMarkdown(result: ExtractionResult): string {
    const { metadata, records } = result;
    const lines: string[] = [];

    lines.push(
      `---\nsource: ${metadata.source} | extractedAt: ${metadata.extractedAt} | records: ${metadata.recordCount}\n---\n`
    );

    for (let i = 0; i < records.length; i++) {
      lines.push(`## Record ${i + 1}`);
      for (const [key, value] of Object.entries(records[i])) {
        const display =
          typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value ?? "");
        lines.push(`- **${key}**: ${display}`);
      }
      lines.push("");
    }

    if (metadata.warnings?.length) {
      lines.push("## Warnings");
      for (const w of metadata.warnings) {
        lines.push(`- ${w}`);
      }
    }

    return lines.join("\n");
  }

  private static renderSummary(result: ExtractionResult): string {
    const { metadata, records } = result;
    const lines: string[] = [];

    lines.push(
      `Extracted ${metadata.recordCount} ${metadata.source} record(s) at ${metadata.extractedAt}.`
    );

    if (records.length === 0) {
      lines.push("No records found.");
      return lines.join("\n");
    }

    // Summarize field distributions
    const allKeys = new Set<string>();
    for (const r of records) {
      for (const k of Object.keys(r)) allKeys.add(k);
    }

    for (const key of allKeys) {
      const values = records
        .map((r) => r[key])
        .filter((v) => v !== undefined && v !== null);
      const unique = new Set(values.map((v) => String(v)));

      if (unique.size <= 5 && values.length > 1) {
        const counts: Record<string, number> = {};
        for (const v of values) {
          const s = String(v);
          counts[s] = (counts[s] || 0) + 1;
        }
        const dist = Object.entries(counts)
          .map(([k, c]) => `${k} (${c})`)
          .join(", ");
        lines.push(`${key}: ${dist}`);
      } else if (unique.size > 5) {
        lines.push(`${key}: ${unique.size} unique values`);
      } else if (values.length === 1) {
        lines.push(
          `${key}: ${String(values[0]).substring(0, 100)}`
        );
      }
    }

    if (metadata.warnings?.length) {
      lines.push(`\nWarnings: ${metadata.warnings.join("; ")}`);
    }

    return lines.join("\n");
  }

  private static renderKeyValue(result: ExtractionResult): string {
    const { metadata, records } = result;
    const lines: string[] = [];

    for (let i = 0; i < records.length; i++) {
      if (records.length > 1) {
        lines.push(`=== Record ${i + 1} ===`);
      }
      for (const [key, value] of Object.entries(records[i])) {
        const display =
          typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value ?? "");
        lines.push(`${key}: ${display}`);
      }
      if (i < records.length - 1) lines.push("");
    }

    if (metadata.warnings?.length) {
      lines.push(`\nWarnings: ${metadata.warnings.join("; ")}`);
    }

    return lines.join("\n");
  }

  private static renderCsv(result: ExtractionResult): string {
    const { metadata, records } = result;

    if (records.length === 0) {
      return `# source: ${metadata.source} | records: 0\n(no data)`;
    }

    // Collect all keys across all records
    const allKeys = new Set<string>();
    for (const r of records) {
      for (const k of Object.keys(r)) allKeys.add(k);
    }
    const headers = Array.from(allKeys);

    const lines: string[] = [];
    lines.push(
      `# source: ${metadata.source} | extractedAt: ${metadata.extractedAt} | records: ${metadata.recordCount}`
    );
    lines.push(headers.join(","));

    for (const record of records) {
      const row = headers.map((h) => {
        const val = record[h];
        if (val === undefined || val === null) return "";
        const str =
          typeof val === "object" ? JSON.stringify(val) : String(val);
        // Escape CSV: quote if contains comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(row.join(","));
    }

    return lines.join("\n");
  }
}
