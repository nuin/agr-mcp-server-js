// Alliance of Genome Resources entity types
export const ENTITY_TYPES = [
  "gene",
  "allele",
  "disease",
  "phenotype",
  "expression",
  "orthology",
  "interaction",
  "variant",
  "transgenic_allele",
  "construct",
  "affected_genomic_model",
  "go_term",
  "do_term",
  "publication",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

// Supported model organisms in AGR
export const SPECIES = [
  "Homo sapiens",
  "Mus musculus",
  "Rattus norvegicus",
  "Danio rerio",
  "Drosophila melanogaster",
  "Caenorhabditis elegans",
  "Saccharomyces cerevisiae",
  "Xenopus laevis",
  "Xenopus tropicalis",
] as const;

export type Species = (typeof SPECIES)[number];

// Species short names for search filters
export const SPECIES_MAP: Record<string, Species> = {
  human: "Homo sapiens",
  mouse: "Mus musculus",
  rat: "Rattus norvegicus",
  zebrafish: "Danio rerio",
  fly: "Drosophila melanogaster",
  worm: "Caenorhabditis elegans",
  yeast: "Saccharomyces cerevisiae",
  frog: "Xenopus laevis",
  xenopus: "Xenopus tropicalis",
};

// Gene ID prefixes by data source
export const GENE_ID_PREFIXES = [
  "HGNC",      // Human
  "MGI",       // Mouse
  "RGD",       // Rat
  "ZFIN",      // Zebrafish
  "FB",        // FlyBase (Drosophila)
  "WB",        // WormBase (C. elegans)
  "SGD",       // Yeast
  "Xenbase",   // Xenopus
] as const;

// Search result types
export interface SearchResult {
  id: string;
  symbol?: string;
  name: string;
  species?: string;
  category: string;
  description?: string;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  aggregations?: Record<string, unknown>;
}

// Gene types
export interface GeneBasicInfo {
  id: string;
  symbol: string;
  name: string;
  species: {
    name: string;
    commonNames?: string;
    taxonId: string;
  };
  soTermName?: string;
  geneSynopsis?: string;
  geneSynopsisUrl?: string;
  automatedGeneSynopsis?: string;
}

export interface GeneLocation {
  chromosome: string;
  start: number;
  end: number;
  strand?: string;
  assembly?: string;
}

export interface CrossReference {
  id: string;
  displayName?: string;
  globalCrossRefId?: string;
  pages?: string[];
  url?: string;
}

export interface GeneData extends GeneBasicInfo {
  genomeLocations?: GeneLocation[];
  crossReferences?: CrossReference[];
  synonyms?: string[];
}

// Disease types
export interface DiseaseAnnotation {
  id: string;
  name: string;
  doId?: string;
  associationType?: string;
  evidence?: string[];
  publications?: PublicationRef[];
}

export interface DiseaseResponse {
  results: DiseaseAnnotation[];
  total: number;
}

// Expression types
export interface ExpressionAnnotation {
  id: string;
  assay?: string;
  anatomicalStructure?: {
    id: string;
    name: string;
  };
  stage?: {
    id: string;
    name: string;
  };
  publications?: PublicationRef[];
}

export interface ExpressionResponse {
  results: ExpressionAnnotation[];
  total: number;
}

// Ortholog types
export interface Ortholog {
  gene: {
    id: string;
    symbol: string;
    species: {
      name: string;
    };
  };
  homologyType?: string;
  methodCount?: number;
  best?: boolean;
  bestReverse?: boolean;
}

export interface OrthologyResponse {
  results: Ortholog[];
  total: number;
}

// Phenotype types
export interface PhenotypeAnnotation {
  id: string;
  phenotype: string;
  phenotypeStatement?: string;
  primaryAnnotatedEntities?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  publications?: PublicationRef[];
}

export interface PhenotypeResponse {
  results: PhenotypeAnnotation[];
  total: number;
}

// Interaction types
export interface Interaction {
  interactorAGeneId: string;
  interactorASymbol: string;
  interactorBGeneId: string;
  interactorBSymbol: string;
  interactionType?: string;
  detectionMethod?: string;
  publications?: PublicationRef[];
}

export interface InteractionResponse {
  results: Interaction[];
  total: number;
}

// Allele/Variant types
export interface Allele {
  id: string;
  symbol: string;
  name?: string;
  synonyms?: string[];
  alleleType?: string;
  gene?: {
    id: string;
    symbol: string;
  };
  species?: {
    name: string;
  };
}

export interface AlleleResponse {
  results: Allele[];
  total: number;
}

// Publication types
export interface PublicationRef {
  id: string;
  pubMedId?: string;
  citation?: string;
}

// AllianceMine query types
export interface AllianceMineResult {
  type: string;
  id: number;
  relevance: number;
  fields: Record<string, unknown>;
}

export interface AllianceMineResponse {
  results: AllianceMineResult[];
  totalHits: number;
  facets?: Record<string, unknown>;
}

// API Error type
export interface APIError {
  status: number;
  message: string;
  details?: string;
}
