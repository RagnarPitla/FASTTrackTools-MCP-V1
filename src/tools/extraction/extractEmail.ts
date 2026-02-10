import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { authProvider } from "../../utils/authProvider.js";
import { OutputFormatter } from "../../utils/outputFormatter.js";
import { htmlToText } from "../../utils/htmlToText.js";
import type { ExtractionResult } from "../../types/index.js";

interface GraphMessage {
  id: string;
  subject: string;
  from?: {
    emailAddress: { name: string; address: string };
  };
  receivedDateTime: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  hasAttachments: boolean;
  importance: string;
  toRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
}

interface GraphResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

export function registerExtractEmail(server: McpServer): void {
  server.tool(
    "extract_email",
    "Extract email data from Microsoft 365 via Graph API. Retrieves emails by folder, sender, date range, or search query and formats them for downstream tool consumption.",
    {
      mailbox: z
        .string()
        .optional()
        .describe(
          "Email address of the mailbox to read. Defaults to the authenticated app's mailbox (use 'me' for delegated auth)."
        ),
      folder: z
        .string()
        .optional()
        .describe(
          "Mail folder name (e.g. Inbox, SentItems, Archive). Default: Inbox"
        ),
      query: z
        .string()
        .optional()
        .describe(
          "OData $search query (e.g. 'from:john@contoso.com' or 'subject:go-live')"
        ),
      fromDate: z
        .string()
        .optional()
        .describe("Only emails after this date (YYYY-MM-DD)"),
      toDate: z
        .string()
        .optional()
        .describe("Only emails before this date (YYYY-MM-DD)"),
      maxResults: z
        .number()
        .optional()
        .describe(
          "Maximum number of emails to return (default: 10, max: 50)"
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
          "Pre-acquired Microsoft Graph OAuth access token. Bypasses env-var auth if provided."
        ),
    },
    async ({
      mailbox,
      folder,
      query,
      fromDate,
      toDate,
      maxResults,
      outputFormat,
      targetTool,
      accessToken,
    }) => {
      try {
        // Resolve auth
        const token = accessToken || (await authProvider.getGraphToken());

        // Build Graph API URL
        const top = Math.min(maxResults || 10, 50);
        const folderName = folder || "Inbox";
        const userPath = mailbox ? `users/${mailbox}` : "me";
        const baseUrl = `https://graph.microsoft.com/v1.0/${userPath}/mailFolders/${folderName}/messages`;

        const params = new URLSearchParams();
        params.set("$top", String(top));
        params.set(
          "$select",
          "id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,importance,toRecipients"
        );
        params.set("$orderby", "receivedDateTime desc");

        // Build filter conditions
        const filters: string[] = [];
        if (fromDate) {
          filters.push(`receivedDateTime ge ${fromDate}T00:00:00Z`);
        }
        if (toDate) {
          filters.push(`receivedDateTime le ${toDate}T23:59:59Z`);
        }
        if (filters.length > 0) {
          params.set("$filter", filters.join(" and "));
        }

        // Use $search for free-text queries
        if (query) {
          params.set("$search", `"${query}"`);
        }

        const url = `${baseUrl}?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ConsistencyLevel: "eventual", // Required for $search
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(
            `Graph API error: ${response.status} ${errorText.substring(0, 200)}`
          );

          if (response.status === 401) {
            // Clear cached token and provide helpful error
            authProvider.clearCache();
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Authentication failed (401). Token may be expired or invalid. Please check your Graph API credentials.",
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: `Graph API error (${response.status}): ${errorText.substring(0, 300)}`,
              },
            ],
          };
        }

        const data = (await response.json()) as GraphResponse;
        const messages = data.value || [];

        const records: Record<string, unknown>[] = messages.map((msg) => {
          // Convert HTML body to plain text
          let bodyText = msg.bodyPreview || "";
          if (msg.body?.content) {
            bodyText =
              msg.body.contentType === "html"
                ? htmlToText(msg.body.content)
                : msg.body.content;
          }

          return {
            id: msg.id,
            subject: msg.subject,
            fromName: msg.from?.emailAddress?.name || "",
            fromEmail: msg.from?.emailAddress?.address || "",
            receivedDateTime: msg.receivedDateTime,
            body: bodyText.substring(0, 5000),
            hasAttachments: msg.hasAttachments,
            importance: msg.importance,
            toRecipients: msg.toRecipients
              ?.map((r) => r.emailAddress.address)
              .join(", "),
          };
        });

        const warnings: string[] = [];
        if (data["@odata.nextLink"]) {
          warnings.push(
            `More emails available. Showing first ${records.length} results.`
          );
        }

        const result: ExtractionResult = {
          metadata: {
            source: "email",
            extractedAt: new Date().toISOString(),
            outputFormat: "json",
            recordCount: records.length,
            warnings: warnings.length > 0 ? warnings : undefined,
          },
          records,
          fieldHints: {
            id: "Graph message ID",
            subject: "Email subject line",
            fromName: "Sender display name",
            fromEmail: "Sender email address",
            receivedDateTime: "When the email was received (ISO 8601)",
            body: "Email body as plain text",
            hasAttachments: "Whether the email has attachments",
            importance: "Email importance level",
            toRecipients: "Comma-separated recipient addresses",
          },
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
        logger.error(`extract_email failed: ${message}`);
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
