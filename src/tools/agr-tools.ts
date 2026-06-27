import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AllianceClient } from "../client.js";
import { errorResult, nullableJsonResult, safeHandler } from "../helpers.js";

export function registerAgrTools(
  server: McpServer,
  client: AllianceClient
): void {
  server.tool(
    "search_genes",
    "Search for genes across all Alliance of Genome Resources model organisms. Supports species filtering.",
    {
      query: z
        .string()
        .describe(
          "Search query - gene symbol (e.g., 'BRCA1', 'daf-2'), name, or keyword"
        ),
      species: z
        .string()
        .optional()
        .describe(
          "Filter by species: human, mouse, rat, zebrafish, fly, worm, yeast, frog, or full name like 'Homo sapiens'"
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of results to return"),
    },
    ({ query, species, limit }) =>
      safeHandler("Error searching genes", () =>
        client.search(query, "gene", species, limit)
      )
  );

  server.tool(
    "get_gene_info",
    "Get detailed information about a specific gene including symbol, name, location, species, and cross-references.",
    {
      gene_id: z
        .string()
        .describe(
          "Gene identifier - e.g., 'HGNC:1100' (human BRCA1), 'MGI:95892' (mouse), 'ZFIN:ZDB-GENE-990415-72'"
        ),
    },
    async ({ gene_id }) => {
      try {
        const data = await client.getGene(gene_id);
        return nullableJsonResult(data, `Gene not found: ${gene_id}`);
      } catch (error) {
        return errorResult(`Error fetching gene: ${error}`);
      }
    }
  );

  server.tool(
    "get_gene_diseases",
    "Get disease associations for a gene, including human disease models and annotations.",
    {
      gene_id: z.string().describe("Gene identifier"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ gene_id, limit }) =>
      safeHandler("Error fetching diseases", () =>
        client.getGeneDiseases(gene_id, limit)
      )
  );

  server.tool(
    "search_diseases",
    "Search for diseases in the Alliance database.",
    {
      query: z
        .string()
        .describe("Disease name or keyword (e.g., 'breast cancer', 'diabetes')"),
      limit: z.number().optional().default(20).describe("Maximum results"),
    },
    ({ query, limit }) =>
      safeHandler("Error searching diseases", () =>
        client.searchDiseases(query, limit)
      )
  );

  server.tool(
    "get_gene_expression",
    "Get expression data for a gene including tissue/cell type expression and developmental stages.",
    {
      gene_id: z.string().describe("Gene identifier"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ gene_id, limit }) =>
      safeHandler("Error fetching expression", () =>
        client.getGeneExpression(gene_id, limit)
      )
  );

  server.tool(
    "find_orthologs",
    "Find orthologous genes across species. Returns homologs from all Alliance model organisms.",
    {
      gene_id: z.string().describe("Gene identifier"),
    },
    ({ gene_id }) =>
      safeHandler("Error fetching orthologs", () =>
        client.getOrthologs(gene_id)
      )
  );

  server.tool(
    "find_paralogs",
    "Find paralogous genes within the same species (genes related by duplication). Complements find_orthologs.",
    {
      gene_id: z.string().describe("Gene identifier"),
    },
    ({ gene_id }) =>
      safeHandler("Error fetching paralogs", () => client.getParalogs(gene_id))
  );

  server.tool(
    "get_gene_phenotypes",
    "Get phenotype annotations for a gene.",
    {
      gene_id: z.string().describe("Gene identifier"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ gene_id, limit }) =>
      safeHandler("Error fetching phenotypes", () =>
        client.getGenePhenotypes(gene_id, limit)
      )
  );

  server.tool(
    "get_gene_interactions",
    "Get molecular and genetic interactions for a gene.",
    {
      gene_id: z.string().describe("Gene identifier"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ gene_id, limit }) =>
      safeHandler("Error fetching interactions", () =>
        client.getGeneInteractions(gene_id, limit)
      )
  );

  server.tool(
    "get_gene_alleles",
    "Get alleles/variants associated with a gene.",
    {
      gene_id: z.string().describe("Gene identifier"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ gene_id, limit }) =>
      safeHandler("Error fetching alleles", () =>
        client.getGeneAlleles(gene_id, limit)
      )
  );

  server.tool(
    "get_gene_models",
    "Get affected genomic models (e.g., disease models) associated with a gene.",
    {
      gene_id: z.string().describe("Gene identifier"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ gene_id, limit }) =>
      safeHandler("Error fetching gene models", () =>
        client.getGeneModels(gene_id, limit)
      )
  );

  server.tool(
    "search_alleles",
    "Search for alleles/variants in the Alliance database.",
    {
      query: z.string().describe("Allele name or keyword"),
      limit: z.number().optional().default(20).describe("Maximum results"),
    },
    ({ query, limit }) =>
      safeHandler("Error searching alleles", () =>
        client.searchAlleles(query, limit)
      )
  );

  server.tool(
    "get_species_list",
    "Get list of model organisms supported by Alliance of Genome Resources.",
    {},
    () =>
      safeHandler("Error fetching species list", () => client.getSpeciesList())
  );

}
