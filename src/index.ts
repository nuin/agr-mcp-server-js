#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AllianceClient } from "./client.js";
import { ENTITY_TYPES, EntityType, SPECIES, QueryBuilder } from "./types.js";

const client = new AllianceClient();

const server = new McpServer({
  name: "agr-genomics",
  version: "5.0.1",
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

// ============================================
// AllianceMine Tools
// ============================================

// Tool: Mine Search
server.tool(
  "mine_search",
  "Search AllianceMine for genes, proteins, diseases, and other biological entities using keyword search.",
  {
    query: z.string().describe("Search query - keyword, gene symbol, protein name, etc."),
    type: z
      .string()
      .optional()
      .describe("Filter by type: Gene, Protein, Disease, Pathway, etc."),
    limit: z.number().optional().default(20).describe("Maximum results"),
  },
  async ({ query, type, limit }) => {
    try {
      const results = await client.searchMine(query, type, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error searching AllianceMine: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Mine Query (raw PathQuery XML)
server.tool(
  "mine_query",
  "Run a raw PathQuery XML query against AllianceMine. For power users who know InterMine PathQuery syntax.",
  {
    xml: z.string().describe("PathQuery XML string"),
  },
  async ({ xml }) => {
    try {
      const results = await client.runPathQuery(xml);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `PathQuery error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Mine Query Builder
server.tool(
  "mine_query_builder",
  `Build and run structured queries against AllianceMine using a JSON DSL.

Example query - find human genes in DNA repair pathway:
{
  "from": "Gene",
  "select": ["symbol", "name", "organism.name", "pathways.name"],
  "where": {
    "organism.name": "Homo sapiens",
    "pathways.name": { "op": "CONTAINS", "value": "DNA repair" }
  },
  "limit": 50
}

Supported operators: =, !=, CONTAINS, LIKE, <, >, <=, >=, ONE OF, NONE OF, IS NULL, IS NOT NULL`,
  {
    from: z.string().describe("Root class: Gene, Protein, Disease, Pathway, Phenotype, etc."),
    select: z.array(z.string()).describe("Fields to return, e.g., ['symbol', 'organism.name']"),
    where: z
      .record(
        z.union([
          z.string(),
          z.object({
            op: z.string(),
            value: z.union([z.string(), z.array(z.string())]),
          }),
        ])
      )
      .optional()
      .describe("Constraints as field: value or field: {op, value}"),
    joins: z.array(z.string()).optional().describe("OUTER JOIN paths for optional relationships"),
    sort: z
      .object({
        field: z.string(),
        direction: z.enum(["ASC", "DESC"]),
      })
      .optional()
      .describe("Sort order"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ from, select, where, joins, sort, limit }) => {
    try {
      const results = await client.buildAndRunQuery({
        from,
        select,
        where: where as QueryBuilder["where"],
        joins,
        sort,
        limit,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Query error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Mine Natural Query
server.tool(
  "mine_natural_query",
  `Query AllianceMine using natural language. The query will be converted to a structured PathQuery.

Examples:
- "human genes in DNA repair pathway" → Gene where organism.name = Homo sapiens, pathways.name CONTAINS DNA repair
- "proteins with kinase domains" → Protein where proteinDomains.name CONTAINS kinase
- "diseases associated with BRCA1" → Disease where genes.symbol = BRCA1
- "mouse genes on chromosome 1" → Gene where organism.name = Mus musculus, chromosome.primaryIdentifier = 1
- "all pathways containing TP53" → Pathway where genes.symbol = TP53

Available classes: Gene, Protein, Disease, Pathway, Phenotype, Allele, GOTerm, Publication, Organism`,
  {
    query: z.string().describe("Natural language query describing what to find"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ query, limit }) => {
    // The LLM calling this tool should convert NL to structured query
    // This is a pass-through that documents the conversion expectations
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message:
                "Convert this natural language query to a mine_query_builder call",
              query,
              limit,
              hint: "Parse the query to extract: from (class), select (fields), where (constraints)",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool: List Templates
server.tool(
  "mine_list_templates",
  "List available query templates in AllianceMine. Templates are pre-built queries for common use cases.",
  {},
  async () => {
    try {
      const templates = await client.listTemplates();
      return {
        content: [{ type: "text", text: JSON.stringify(templates, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error listing templates: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Run Template
server.tool(
  "mine_run_template",
  `Run a pre-built query template with parameters.

Parameter format: Use numeric keys ("1", "2", etc.) matching constraint positions.
- Simple: {"1": "BRCA1"} - just the value
- Full: {"1": {"path": "Gene", "op": "LOOKUP", "value": "BRCA1"}}

Common templates:
- Gene_Orthologs: Find orthologs (params: {"1": {"path": "Gene", "op": "LOOKUP", "value": "HGNC:1100"}})
- Gene_GOTerms: GO annotations for a gene
- Gene_DOTerm: Disease annotations for a gene
- GOTerm_Genes: Find genes by GO term

Use mine_list_templates to discover all available templates and their constraints.`,
  {
    name: z.string().describe("Template name (e.g., 'Gene_Orthologs')"),
    params: z
      .record(
        z.union([
          z.string(),
          z.object({
            path: z.string().optional(),
            op: z.string().optional(),
            value: z.string(),
          }),
        ])
      )
      .describe("Template parameters with numeric keys, e.g., {'1': {'path': 'Gene', 'op': 'LOOKUP', 'value': 'HGNC:1100'}}"),
    limit: z.number().optional().default(100).describe("Maximum results"),
  },
  async ({ name, params, limit }) => {
    try {
      const results = await client.runTemplate(name, params, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Template error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get Lists
server.tool(
  "mine_get_lists",
  "Get all available gene/protein lists in AllianceMine.",
  {
    type: z
      .string()
      .optional()
      .describe("Filter by type: Gene, Protein, etc."),
  },
  async ({ type }) => {
    try {
      const lists = await client.getLists(type);
      return {
        content: [{ type: "text", text: JSON.stringify(lists, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching lists: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get List Contents
server.tool(
  "mine_get_list",
  "Get the contents of a specific list.",
  {
    name: z.string().describe("List name"),
  },
  async ({ name }) => {
    try {
      const data = await client.getList(name);
      if (!data) {
        return {
          content: [{ type: "text", text: `List not found: ${name}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching list: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Create List (requires auth)
server.tool(
  "mine_create_list",
  "Create a new list in AllianceMine. Requires ALLIANCEMINE_TOKEN environment variable.",
  {
    name: z.string().describe("List name"),
    type: z.string().describe("List type: Gene, Protein, etc."),
    identifiers: z
      .array(z.string())
      .describe("Array of identifiers to add to the list"),
    description: z.string().optional().describe("List description"),
  },
  async ({ name, type, identifiers, description }) => {
    try {
      const result = await client.createList(name, type, identifiers, description);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error creating list: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Add to List (requires auth)
server.tool(
  "mine_add_to_list",
  "Add items to an existing list. Requires ALLIANCEMINE_TOKEN environment variable.",
  {
    name: z.string().describe("List name"),
    identifiers: z.array(z.string()).describe("Identifiers to add"),
  },
  async ({ name, identifiers }) => {
    try {
      const result = await client.addToList(name, identifiers);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error adding to list: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Delete List (requires auth)
server.tool(
  "mine_delete_list",
  "Delete a list from AllianceMine. Requires ALLIANCEMINE_TOKEN environment variable.",
  {
    name: z.string().describe("List name to delete"),
  },
  async ({ name }) => {
    try {
      const result = await client.deleteList(name);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error deleting list: ${error}` }],
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
