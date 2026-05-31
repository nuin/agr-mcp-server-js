import {
  EntityType,
  SearchResponse,
  GeneData,
  DiseaseResponse,
  ExpressionResponse,
  OrthologyResponse,
  PhenotypeResponse,
  InteractionResponse,
  AlleleResponse,
  Species,
  SPECIES_MAP,
  SPECIES,
} from "../types.js";

const BROWSER_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
} as const;

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { ...BROWSER_HEADERS } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export class AgrClient {
  constructor(private readonly baseUrl: string) {}

  async search(
    query: string,
    category?: EntityType,
    species?: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });

    if (category) {
      params.set("category", category);
    }

    if (species) {
      const speciesName = SPECIES_MAP[species.toLowerCase()] || species;
      if (SPECIES.includes(speciesName as Species)) {
        params.set("species", speciesName);
      }
    }

    const url = `${this.baseUrl}/search?${params.toString()}`;

    try {
      const response = await fetchJson<{
        results: Array<{
          id: string;
          symbol?: string;
          name: string;
          name_key?: string;
          species?: string;
          category: string;
          highlights?: Record<string, string[]>;
        }>;
        total: number;
        aggregations?: Record<string, unknown>;
      }>(url);

      return {
        query,
        results: response.results.map((r) => ({
          id: r.id,
          symbol: r.symbol,
          name: r.name || r.name_key || r.id,
          species: r.species,
          category: r.category,
          highlights: r.highlights,
        })),
        total: response.total,
        aggregations: response.aggregations,
      };
    } catch {
      return { query, results: [], total: 0 };
    }
  }

  async getGene(geneId: string): Promise<GeneData | null> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}`;
    try {
      return await fetchJson<GeneData>(url);
    } catch {
      return null;
    }
  }

  async getGeneDiseases(
    geneId: string,
    limit: number = 100
  ): Promise<DiseaseResponse> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/diseases?limit=${limit}`;
    try {
      return await fetchJson<DiseaseResponse>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async searchDiseases(
    query: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    return this.search(query, "disease", undefined, limit);
  }

  async getGeneExpression(
    geneId: string,
    limit: number = 100
  ): Promise<ExpressionResponse> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/expression?limit=${limit}`;
    try {
      return await fetchJson<ExpressionResponse>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getOrthologs(geneId: string): Promise<OrthologyResponse> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/homologs`;
    try {
      return await fetchJson<OrthologyResponse>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getGenePhenotypes(
    geneId: string,
    limit: number = 100
  ): Promise<PhenotypeResponse> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/phenotypes?limit=${limit}`;
    try {
      return await fetchJson<PhenotypeResponse>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getGeneInteractions(
    geneId: string,
    limit: number = 100
  ): Promise<InteractionResponse> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/interactions?limit=${limit}`;
    try {
      return await fetchJson<InteractionResponse>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getGeneAlleles(
    geneId: string,
    limit: number = 100
  ): Promise<AlleleResponse> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/alleles?limit=${limit}`;
    try {
      return await fetchJson<AlleleResponse>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async searchAlleles(
    query: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    return this.search(query, "allele", undefined, limit);
  }

  async getSpeciesList(): Promise<unknown> {
    const url = `${this.baseUrl}/species`;
    try {
      return await fetchJson<unknown>(url);
    } catch {
      return {
        results: [
          { name: "Homo sapiens", shortName: "Hsa", commonNames: ["human"] },
          { name: "Mus musculus", shortName: "Mmu", commonNames: ["mouse"] },
          { name: "Rattus norvegicus", shortName: "Rno", commonNames: ["rat"] },
          { name: "Danio rerio", shortName: "Dre", commonNames: ["zebrafish"] },
          { name: "Drosophila melanogaster", shortName: "Dme", commonNames: ["fly"] },
          { name: "Caenorhabditis elegans", shortName: "Cel", commonNames: ["worm"] },
          { name: "Saccharomyces cerevisiae", shortName: "Sce", commonNames: ["yeast"] },
          { name: "Xenopus tropicalis", shortName: "Xtr", commonNames: ["xenopus"] },
        ],
        total: 8,
      };
    }
  }

  resolveSpecies(input: string): Species | null {
    const lower = input.toLowerCase();
    if (SPECIES_MAP[lower]) {
      return SPECIES_MAP[lower];
    }
    if (SPECIES.includes(input as Species)) {
      return input as Species;
    }
    return null;
  }
}
