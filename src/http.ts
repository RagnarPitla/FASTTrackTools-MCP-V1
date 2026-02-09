#!/usr/bin/env node

/**
 * FastTrack MCP Server — Streamable HTTP Transport
 *
 * This entry point runs the MCP server over HTTP, which is required
 * for Microsoft Copilot Studio integration.
 *
 * Usage:
 *   npm run start:http                  # defaults to port 3000
 *   PORT=8080 npm run start:http        # custom port
 *
 * Endpoints:
 *   POST   /mcp   — JSON-RPC messages (initialize, tool calls, etc.)
 *   GET    /mcp   — SSE stream for server-initiated messages
 *   DELETE /mcp   — Session termination
 *   GET    /health — Health check
 */

import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

const app = express();
app.use(express.json());

// ── Session Storage ──
// Maps session ID → transport instance
const sessions: Record<string, StreamableHTTPServerTransport> = {};

// ── POST /mcp — Handle all JSON-RPC messages ──
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    // Existing session — reuse transport
    if (sessionId && sessions[sessionId]) {
      await sessions[sessionId].handleRequest(req, res, req.body);
      return;
    }

    // New initialization request — create transport + server
    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          logger.info(`Session initialized: ${sid}`);
          sessions[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions[sid]) {
          logger.info(`Session closed: ${sid}`);
          delete sessions[sid];
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Invalid request — no session and not an initialize
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session. Send an initialize request first.",
      },
      id: null,
    });
  } catch (error) {
    logger.error("Error handling POST /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// ── GET /mcp — SSE stream for server-initiated messages ──
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid or missing session ID" },
      id: null,
    });
    return;
  }

  await sessions[sessionId].handleRequest(req, res);
});

// ── DELETE /mcp — Session termination ──
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid or missing session ID" },
      id: null,
    });
    return;
  }

  logger.info(`Terminating session: ${sessionId}`);
  await sessions[sessionId].handleRequest(req, res);
});

// ── GET /health — Health check for Azure / load balancers ──
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    server: "fasttrack-d365-mcp",
    version: "1.1.0",
    transport: "streamable-http",
    activeSessions: Object.keys(sessions).length,
  });
});

// ── Start Server ──
const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  logger.info(`FastTrack MCP Server (Streamable HTTP) listening on http://localhost:${PORT}/mcp`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

// ── Graceful Shutdown ──
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  for (const sid of Object.keys(sessions)) {
    try {
      await sessions[sid].close();
      delete sessions[sid];
    } catch (err) {
      logger.error(`Error closing session ${sid}:`, err);
    }
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  for (const sid of Object.keys(sessions)) {
    try {
      await sessions[sid].close();
      delete sessions[sid];
    } catch (err) {
      logger.error(`Error closing session ${sid}:`, err);
    }
  }
  process.exit(0);
});
