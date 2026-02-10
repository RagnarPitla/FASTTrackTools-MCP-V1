import { logger } from "./logger.js";
import type {
  GraphAuthConfig,
  DataverseAuthConfig,
  CachedToken,
} from "../types/index.js";

class AuthProvider {
  private tokenCache: Map<string, CachedToken> = new Map();

  getGraphConfig(): GraphAuthConfig | null {
    const tenantId = process.env.GRAPH_TENANT_ID;
    const clientId = process.env.GRAPH_CLIENT_ID;
    const clientSecret = process.env.GRAPH_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return null;
    return {
      tenantId,
      clientId,
      clientSecret,
      scopes: ["https://graph.microsoft.com/.default"],
    };
  }

  getDataverseConfig(): DataverseAuthConfig | null {
    const tenantId =
      process.env.DATAVERSE_TENANT_ID || process.env.GRAPH_TENANT_ID;
    const clientId = process.env.DATAVERSE_CLIENT_ID;
    const clientSecret = process.env.DATAVERSE_CLIENT_SECRET;
    const environmentUrl = process.env.DATAVERSE_ENVIRONMENT_URL;
    if (!tenantId || !clientId || !clientSecret || !environmentUrl) return null;
    return { tenantId, clientId, clientSecret, environmentUrl };
  }

  async getToken(
    cacheKey: string,
    tenantId: string,
    clientId: string,
    clientSecret: string,
    scope: string
  ): Promise<string> {
    const cached = this.tokenCache.get(cacheKey);
    const now = Date.now();

    // Return cached token if valid (with 5-minute buffer)
    if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
      return cached.accessToken;
    }

    logger.info(`Acquiring new token for ${cacheKey}`);
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `Token acquisition failed for ${cacheKey}: ${response.status}`
      );
      throw new Error(
        `Authentication failed (${response.status}): Unable to acquire token for ${cacheKey}. Check your credentials.`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    const token: CachedToken = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    this.tokenCache.set(cacheKey, token);
    return token.accessToken;
  }

  async getGraphToken(): Promise<string> {
    const config = this.getGraphConfig();
    if (!config) {
      throw new Error(
        "Graph API not configured. Set environment variables: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET"
      );
    }
    return this.getToken(
      "graph",
      config.tenantId,
      config.clientId,
      config.clientSecret,
      "https://graph.microsoft.com/.default"
    );
  }

  async getDataverseToken(): Promise<string> {
    const config = this.getDataverseConfig();
    if (!config) {
      throw new Error(
        "Dataverse not configured. Set environment variables: DATAVERSE_TENANT_ID, DATAVERSE_CLIENT_ID, DATAVERSE_CLIENT_SECRET, DATAVERSE_ENVIRONMENT_URL"
      );
    }
    return this.getToken(
      "dataverse",
      config.tenantId,
      config.clientId,
      config.clientSecret,
      `${config.environmentUrl}/.default`
    );
  }

  clearCache(): void {
    this.tokenCache.clear();
  }
}

export const authProvider = new AuthProvider();
