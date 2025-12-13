#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AllianceClient } from "./client.js";
import { ENTITY_TYPES, EntityType, SPECIES } from "./types.js";

const client = new AllianceClient();

const server = new McpServer({
  name: "agr-genomics",
  version: "4.0.0",
});

// Tool: Search genes
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
  async ({ query, species, limit }) => {
    try {
      const results = await client.search(query, "gene", species, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error searching genes: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get Gene Info
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
      if (!data) {
        return {
          content: [{ type: "text", text: `Gene not found: ${gene_id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching gene: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get Gene Diseases
server.tool(
  "get_gene_diseases",
  "Get disease associations for a gene, including human disease models and annotations.",
  {
    gene_id: z.string().describe("Gene identifier"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ gene_id, limit }) => {
    try {
      const data = await client.getGeneDiseases(gene_id, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching diseases: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Search Diseases
server.tool(
  "search_diseases",
  "Search for diseases in the Alliance database.",
  {
    query: z
      .string()
      .describe("Disease name or keyword (e.g., 'breast cancer', 'diabetes')"),
    limit: z.number().optional().default(20).describe("Maximum results"),
  },
  async ({ query, limit }) => {
    try {
      const results = await client.searchDiseases(query, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error searching diseases: ${error}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get Gene Expression
server.tool(
  "get_gene_expression",
  "Get expression data for a gene including tissue/cell type expression and developmental stages.",
  {
    gene_id: z.string().describe("Gene identifier"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ gene_id, limit }) => {
    try {
      const data = await client.getGeneExpression(gene_id, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error fetching expression: ${error}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Find Orthologs
server.tool(
  "find_orthologs",
  "Find orthologous genes across species. Returns homologs from all Alliance model organisms.",
  {
    gene_id: z.string().describe("Gene identifier"),
  },
  async ({ gene_id }) => {
    try {
      const data = await client.getOrthologs(gene_id);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error fetching orthologs: ${error}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get Gene Phenotypes
server.tool(
  "get_gene_phenotypes",
  "Get phenotype annotations for a gene.",
  {
    gene_id: z.string().describe("Gene identifier"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ gene_id, limit }) => {
    try {
      const data = await client.getGenePhenotypes(gene_id, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error fetching phenotypes: ${error}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get Gene Interactions
server.tool(
  "get_gene_interactions",
  "Get molecular and genetic interactions for a gene.",
  {
    gene_id: z.string().describe("Gene identifier"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ gene_id, limit }) => {
    try {
      const data = await client.getGeneInteractions(gene_id, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error fetching interactions: ${error}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get Gene Alleles
server.tool(
  "get_gene_alleles",
  "Get alleles/variants associated with a gene.",
  {
    gene_id: z.string().describe("Gene identifier"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ gene_id, limit }) => {
    try {
      const data = await client.getGeneAlleles(gene_id, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching alleles: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Search Alleles
server.tool(
  "search_alleles",
  "Search for alleles/variants in the Alliance database.",
  {
    query: z.string().describe("Allele name or keyword"),
    limit: z.number().optional().default(20).describe("Maximum results"),
  },
  async ({ query, limit }) => {
    try {
      const results = await client.searchAlleles(query, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error searching alleles: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get Species List
server.tool(
  "get_species_list",
  "Get list of model organisms supported by Alliance of Genome Resources.",
  {},
  async () => {
    try {
      const data = await client.getSpeciesList();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error fetching species list: ${error}` },
        ],
        isError: true,
      };
    }
  }
);

// Resource: Entity types
server.resource("entity-types", "agr://entity-types", async () => ({
  contents: [
    {
      uri: "agr://entity-types",
      mimeType: "application/json",
      text: JSON.stringify(
        {
          description: "Entity types available in Alliance of Genome Resources",
          types: ENTITY_TYPES.map((t) => ({
            name: t,
            description: getEntityDescription(t),
          })),
        },
        null,
        2
      ),
    },
  ],
}));

// Resource: Species
server.resource("species", "agr://species", async () => {
  const data = await client.getSpeciesList();
  return {
    contents: [
      {
        uri: "agr://species",
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
});

function getEntityDescription(type: EntityType): string {
  const descriptions: Record<EntityType, string> = {
    gene: "Genes across all model organisms",
    allele: "Genetic variants and alleles",
    disease: "Human diseases and disease models",
    phenotype: "Observable characteristics and traits",
    expression: "Gene expression data",
    orthology: "Cross-species ortholog relationships",
    interaction: "Molecular and genetic interactions",
    variant: "Sequence variants",
    transgenic_allele: "Transgenic constructs",
    construct: "Molecular constructs",
    affected_genomic_model: "Animal models with genetic modifications",
    go_term: "Gene Ontology terms",
    do_term: "Disease Ontology terms",
    publication: "Scientific publications",
  };
  return descriptions[type] || `${type} entities`;
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AGR Genomics MCP server running on stdio");
}

main().catch(console.error);
