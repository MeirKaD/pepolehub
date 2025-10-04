import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;

/**
 * Get or create Bright Data MCP client instance
 * Uses connection pooling to avoid creating multiple connections
 */
export async function getBrightDataClient() {
  if (mcpClient) {
    return mcpClient;
  }

  const apiToken = process.env.BRIGHTDATA_API_TOKEN;
  if (!apiToken) {
    throw new Error('BRIGHTDATA_API_TOKEN is not set in environment variables');
  }

  // Create Bright Data MCP server URL with API token
  const mcpUrl = new URL('https://mcp.brightdata.com/mcp');
  mcpUrl.searchParams.set('token', apiToken);
  mcpUrl.searchParams.set('pro', '1');

  // Initialize MCP client with StreamableHTTP transport
  const transport = new StreamableHTTPClientTransport(mcpUrl);

  mcpClient = await createMCPClient({
    transport,
  });

  return mcpClient;
}

/**
 * Get available tools from Bright Data MCP server
 */
export async function getBrightDataTools() {
  const client = await getBrightDataClient();
  return await client.tools();
}

/**
 * Close the MCP client connection
 * Call this when you're done using the client to free resources
 */
export async function closeBrightDataClient() {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
  }
}
