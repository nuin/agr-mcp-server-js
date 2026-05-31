#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AllianceClient } from "./client.js";
import { registerAgrTools } from "./tools/agr-tools.js";
import { registerMineTools } from "./tools/mine-tools.js";
import { registerResources } from "./tools/resources.js";

const client = new AllianceClient();

const server = new McpServer({
  name: "agr-genomics",
  version: "5.0.2",
});

registerAgrTools(server, client);
registerMineTools(server, client);
registerResources(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AGR Genomics MCP server running on stdio");
}

main().catch(console.error);
