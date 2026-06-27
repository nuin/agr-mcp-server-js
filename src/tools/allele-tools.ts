import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AllianceClient } from "../client.js";
import { errorResult, nullableJsonResult, safeHandler } from "../helpers.js";

export function registerAlleleTools(
  server: McpServer,
  client: AllianceClient
): void {
  server.tool(
    "get_allele_info",
    "Get detailed information about a specific allele/variant by its identifier.",
    {
      allele_id: z
        .string()
        .describe("Allele identifier - e.g., 'ZFIN:ZDB-ALT-980203-1091'"),
    },
    async ({ allele_id }) => {
      try {
        const data = await client.getAllele(allele_id);
        return nullableJsonResult(data, `Allele not found: ${allele_id}`);
      } catch (error) {
        return errorResult(`Error fetching allele: ${error}`);
      }
    }
  );

  // The allele relationship tools share an identical shape: an allele_id +
  // limit that fans out to one client method. Register them from a table.
  const subResources: Array<{
    name: string;
    description: string;
    errorPrefix: string;
    fetch: (id: string, limit: number) => Promise<unknown>;
  }> = [
    {
      name: "get_allele_diseases",
      description: "Get disease associations for a specific allele.",
      errorPrefix: "Error fetching allele diseases",
      fetch: (id, limit) => client.getAlleleDiseases(id, limit),
    },
    {
      name: "get_allele_phenotypes",
      description: "Get phenotype annotations for a specific allele.",
      errorPrefix: "Error fetching allele phenotypes",
      fetch: (id, limit) => client.getAllelePhenotypes(id, limit),
    },
    {
      name: "get_allele_variants",
      description: "Get sequence variants associated with a specific allele.",
      errorPrefix: "Error fetching allele variants",
      fetch: (id, limit) => client.getAlleleVariants(id, limit),
    },
  ];

  for (const { name, description, errorPrefix, fetch } of subResources) {
    server.tool(
      name,
      description,
      {
        allele_id: z
          .string()
          .describe("Allele identifier - e.g., 'ZFIN:ZDB-ALT-980203-1091'"),
        limit: z.number().optional().default(100).describe("Maximum results"),
      },
      ({ allele_id, limit }) =>
        safeHandler(errorPrefix, () => fetch(allele_id, limit))
    );
  }
}
