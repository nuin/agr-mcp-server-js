const CLASSES = {
  Gene: {
    description: "Genes from all model organisms",
    common_fields: [
      "primaryIdentifier",
      "symbol",
      "name",
      "description",
      "secondaryIdentifier",
    ],
    relationships: {
      organism: "Organism (use organism.shortName or organism.name)",
      chromosome: "Chromosome (use chromosome.primaryIdentifier)",
      diseases: "Disease associations",
      phenotypes: "Phenotype annotations",
      pathways: "Pathway memberships",
      alleles: "Gene alleles/variants",
      goAnnotation: "GO term annotations",
      homologues: "Ortholog/paralog relationships",
      proteins: "Encoded proteins",
      publications: "Related publications",
    },
  },
  Protein: {
    description: "Protein records",
    common_fields: ["primaryIdentifier", "primaryAccession", "name", "length"],
    relationships: {
      genes: "Encoding genes",
      organism: "Source organism",
      proteinDomains: "Protein domains",
    },
  },
  Disease: {
    description: "Disease ontology terms (DO)",
    common_fields: ["primaryIdentifier", "name", "description"],
    relationships: {
      genes: "Associated genes",
      alleles: "Associated alleles",
      parents: "Parent terms",
      children: "Child terms",
    },
  },
  Pathway: {
    description: "Biological pathways",
    common_fields: ["primaryIdentifier", "name", "description"],
    relationships: {
      genes: "Genes in pathway",
      dataSets: "Data sources",
    },
  },
  Phenotype: {
    description: "Phenotype annotations",
    common_fields: ["primaryIdentifier", "description"],
    relationships: {
      genes: "Associated genes",
      alleles: "Associated alleles",
    },
  },
  Allele: {
    description: "Gene alleles and variants",
    common_fields: [
      "primaryIdentifier",
      "symbol",
      "name",
      "alleleClass",
      "description",
    ],
    relationships: {
      gene: "Parent gene",
      organism: "Source organism",
      phenotypes: "Associated phenotypes",
    },
  },
  GOTerm: {
    description: "Gene Ontology terms",
    common_fields: ["primaryIdentifier", "name", "description", "namespace"],
    relationships: {
      genes: "Annotated genes",
      parents: "Parent terms",
      children: "Child terms",
    },
  },
  Publication: {
    description: "Scientific publications",
    common_fields: [
      "primaryIdentifier",
      "pubMedId",
      "title",
      "firstAuthor",
      "year",
      "journal",
    ],
    relationships: {
      genes: "Mentioned genes",
      authors: "Author list",
    },
  },
  Organism: {
    description: "Species/organisms",
    common_fields: ["shortName", "name", "taxonId"],
    short_names: {
      "H. sapiens": "Human",
      "M. musculus": "Mouse",
      "R. norvegicus": "Rat",
      "D. rerio": "Zebrafish",
      "D. melanogaster": "Fly",
      "C. elegans": "Worm",
      "S. cerevisiae": "Yeast",
      "X. laevis": "Frog (Xenopus laevis)",
      "X. tropicalis": "Frog (Xenopus tropicalis)",
    },
  },
} as const;

const OPERATORS = {
  "=": "Exact match",
  "!=": "Not equal",
  CONTAINS: "Contains substring (case-insensitive)",
  LIKE: "Pattern match with wildcards (*)",
  "<": "Less than",
  ">": "Greater than",
  "<=": "Less than or equal",
  ">=": "Greater than or equal",
  "ONE OF": "Match any in list (value should be array)",
  "NONE OF": "Match none in list (value should be array)",
  "IS NULL": "Field is empty",
  "IS NOT NULL": "Field has value",
} as const;

const QUERY_BUILDER_FORMAT = {
  from: "Root class name (e.g., 'Gene')",
  select: "Array of fields to return (e.g., ['primaryIdentifier', 'symbol', 'name'])",
  where: "Object with field constraints (e.g., { 'symbol': { op: 'CONTAINS', value: 'BRCA' } })",
  joins: "Optional: array of paths to OUTER JOIN (for optional relationships)",
  sort: "Optional: { field: 'symbol', direction: 'ASC' }",
  limit: "Optional: max results (default 100)",
} as const;

const EXAMPLES = [
  {
    natural: "human genes related to cancer",
    structured: {
      from: "Gene",
      select: ["primaryIdentifier", "symbol", "name", "organism.shortName"],
      where: {
        "organism.shortName": "H. sapiens",
        name: { op: "CONTAINS", value: "cancer" },
      },
      limit: 100,
    },
  },
  {
    natural: "mouse genes on chromosome 11",
    structured: {
      from: "Gene",
      select: [
        "primaryIdentifier",
        "symbol",
        "name",
        "chromosome.primaryIdentifier",
      ],
      where: {
        "organism.shortName": "M. musculus",
        "chromosome.primaryIdentifier": "11",
      },
    },
  },
  {
    natural: "diseases associated with BRCA1",
    structured: {
      from: "Disease",
      select: ["primaryIdentifier", "name", "genes.symbol"],
      where: { "genes.symbol": "BRCA1" },
    },
  },
  {
    natural: "all yeast genes with kinase activity",
    structured: {
      from: "Gene",
      select: [
        "primaryIdentifier",
        "symbol",
        "name",
        "goAnnotation.ontologyTerm.name",
      ],
      where: {
        "organism.shortName": "S. cerevisiae",
        "goAnnotation.ontologyTerm.name": {
          op: "CONTAINS",
          value: "kinase",
        },
      },
    },
  },
] as const;

const INSTRUCTION =
  "Use mine_query_builder to execute this query. Analyze the user's natural language and construct the appropriate structured query using the schema below.";

export function buildMineQuerySchema(query: string, limit: number) {
  return {
    user_query: query,
    requested_limit: limit,
    instruction: INSTRUCTION,
    classes: CLASSES,
    operators: OPERATORS,
    query_builder_format: QUERY_BUILDER_FORMAT,
    examples: EXAMPLES,
  };
}
