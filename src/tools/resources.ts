import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AllianceClient } from "../client.js";
import { ENTITY_TYPES, EntityType } from "../types.js";

const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
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

function describeEntity(type: EntityType): string {
  return ENTITY_DESCRIPTIONS[type] || `${type} entities`;
}

export function registerResources(
  server: McpServer,
  client: AllianceClient
): void {
  server.resource("entity-types", "agr://entity-types", async () => ({
    contents: [
      {
        uri: "agr://entity-types",
        mimeType: "application/json",
        text: JSON.stringify(
          {
            description:
              "Entity types available in Alliance of Genome Resources",
            types: ENTITY_TYPES.map((t) => ({
              name: t,
              description: describeEntity(t),
            })),
          },
          null,
          2
        ),
      },
    ],
  }));

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
}
