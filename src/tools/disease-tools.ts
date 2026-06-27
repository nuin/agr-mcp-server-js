import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AllianceClient } from "../client.js";
import { errorResult, nullableJsonResult, safeHandler } from "../helpers.js";

export function registerDiseaseTools(
  server: McpServer,
  client: AllianceClient
): void {
  server.tool(
    "get_disease_info",
    "Get detailed information about a disease by its Disease Ontology ID (DOID).",
    {
      disease_id: z
        .string()
        .describe("Disease Ontology identifier - e.g., 'DOID:1612' (breast cancer)"),
    },
    async ({ disease_id }) => {
      try {
        const data = await client.getDisease(disease_id);
        return nullableJsonResult(data, `Disease not found: ${disease_id}`);
      } catch (error) {
        return errorResult(`Error fetching disease: ${error}`);
      }
    }
  );

  // The disease sub-resource tools share an identical shape: a disease_id +
  // limit that fans out to one client method. Register them from a table.
  const subResources: Array<{
    name: string;
    description: string;
    errorPrefix: string;
    fetch: (id: string, limit: number) => Promise<unknown>;
  }> = [
    {
      name: "get_disease_genes",
      description:
        "Get genes associated with a disease across all model organisms. The reverse of get_gene_diseases.",
      errorPrefix: "Error fetching disease genes",
      fetch: (id, limit) => client.getDiseaseGenes(id, limit),
    },
    {
      name: "get_disease_models",
      description: "Get animal/model organism models associated with a disease.",
      errorPrefix: "Error fetching disease models",
      fetch: (id, limit) => client.getDiseaseModels(id, limit),
    },
    {
      name: "get_disease_alleles",
      description: "Get alleles/variants associated with a disease.",
      errorPrefix: "Error fetching disease alleles",
      fetch: (id, limit) => client.getDiseaseAlleles(id, limit),
    },
  ];

  for (const { name, description, errorPrefix, fetch } of subResources) {
    server.tool(
      name,
      description,
      {
        disease_id: z
          .string()
          .describe("Disease Ontology identifier - e.g., 'DOID:1612'"),
        limit: z.number().optional().default(100).describe("Maximum results"),
      },
      ({ disease_id, limit }) =>
        safeHandler(errorPrefix, () => fetch(disease_id, limit))
    );
  }
}
