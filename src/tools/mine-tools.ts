import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AllianceClient } from "../client.js";
import { QueryBuilder } from "../types.js";
import {
  errorResult,
  jsonResult,
  nullableJsonResult,
  safeHandler,
} from "../helpers.js";
import { buildMineQuerySchema } from "./mine-schema.js";

export function registerMineTools(
  server: McpServer,
  client: AllianceClient
): void {
  server.tool(
    "mine_search",
    "Search AllianceMine for genes, proteins, diseases, and other biological entities using keyword search.",
    {
      query: z
        .string()
        .describe("Search query - keyword, gene symbol, protein name, etc."),
      type: z
        .string()
        .optional()
        .describe("Filter by type: Gene, Protein, Disease, Pathway, etc."),
      limit: z.number().optional().default(20).describe("Maximum results"),
    },
    ({ query, type, limit }) =>
      safeHandler("Error searching AllianceMine", () =>
        client.searchMine(query, type, limit)
      )
  );

  server.tool(
    "mine_query",
    "Run a raw PathQuery XML query against AllianceMine. For power users who know InterMine PathQuery syntax.",
    {
      xml: z.string().describe("PathQuery XML string"),
    },
    ({ xml }) => safeHandler("PathQuery error", () => client.runPathQuery(xml))
  );

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
      from: z
        .string()
        .describe("Root class: Gene, Protein, Disease, Pathway, Phenotype, etc."),
      select: z
        .array(z.string())
        .describe("Fields to return, e.g., ['symbol', 'organism.name']"),
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
      joins: z
        .array(z.string())
        .optional()
        .describe("OUTER JOIN paths for optional relationships"),
      sort: z
        .object({
          field: z.string(),
          direction: z.enum(["ASC", "DESC"]),
        })
        .optional()
        .describe("Sort order"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ from, select, where, joins, sort, limit }) =>
      safeHandler("Query error", () =>
        client.buildAndRunQuery({
          from,
          select,
          where: where as QueryBuilder["where"],
          joins,
          sort,
          limit,
        })
      )
  );

  server.tool(
    "mine_natural_query",
    `Process a natural language query and return schema information to construct a structured AllianceMine query.

This tool returns the AllianceMine schema so you can convert the user's natural language into a mine_query_builder call.`,
    {
      query: z
        .string()
        .describe("Natural language query describing what to find"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    async ({ query, limit }) => jsonResult(buildMineQuerySchema(query, limit))
  );

  server.tool(
    "mine_list_templates",
    "List available query templates in AllianceMine. Templates are pre-built queries for common use cases.",
    {},
    () => safeHandler("Error listing templates", () => client.listTemplates())
  );

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
        .describe(
          "Template parameters with numeric keys, e.g., {'1': {'path': 'Gene', 'op': 'LOOKUP', 'value': 'HGNC:1100'}}"
        ),
      limit: z.number().optional().default(100).describe("Maximum results"),
    },
    ({ name, params, limit }) =>
      safeHandler("Template error", () =>
        client.runTemplate(name, params, limit)
      )
  );

  server.tool(
    "mine_get_lists",
    "Get all available gene/protein lists in AllianceMine.",
    {
      type: z
        .string()
        .optional()
        .describe("Filter by type: Gene, Protein, etc."),
    },
    ({ type }) =>
      safeHandler("Error fetching lists", () => client.getLists(type))
  );

  server.tool(
    "mine_get_list",
    "Get the contents of a specific list.",
    {
      name: z.string().describe("List name"),
    },
    async ({ name }) => {
      try {
        const data = await client.getList(name);
        return nullableJsonResult(data, `List not found: ${name}`);
      } catch (error) {
        return errorResult(`Error fetching list: ${error}`);
      }
    }
  );

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
    ({ name, type, identifiers, description }) =>
      safeHandler("Error creating list", () =>
        client.createList(name, type, identifiers, description)
      )
  );

  server.tool(
    "mine_add_to_list",
    "Add items to an existing list. Requires ALLIANCEMINE_TOKEN environment variable.",
    {
      name: z.string().describe("List name"),
      identifiers: z.array(z.string()).describe("Identifiers to add"),
    },
    ({ name, identifiers }) =>
      safeHandler("Error adding to list", () =>
        client.addToList(name, identifiers)
      )
  );

  server.tool(
    "mine_delete_list",
    "Delete a list from AllianceMine. Requires ALLIANCEMINE_TOKEN environment variable.",
    {
      name: z.string().describe("List name to delete"),
    },
    ({ name }) =>
      safeHandler("Error deleting list", () => client.deleteList(name))
  );
}
