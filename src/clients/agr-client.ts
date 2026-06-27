import {
  EntityType,
  SearchResponse,
  PhenotypeResponse,
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

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// The AGR search API categorizes hits with a `_search_result` suffix
// (e.g. "gene_search_result"). Map our entity types onto those keys.
const SEARCH_CATEGORY_MAP: Partial<Record<EntityType, string>> = {
  gene: "gene_search_result",
  allele: "allele_search_result",
  disease: "disease_search_result",
  go_term: "go_search_result",
  variant: "variant_search_result",
};

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
      params.set("category", SEARCH_CATEGORY_MAP[category] ?? category);
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

  async getGene(geneId: string): Promise<unknown | null> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}`;
    try {
      return await fetchJson<unknown>(url);
    } catch {
      return null;
    }
  }

  async getGeneDiseases(
    geneId: string,
    limit: number = 100
  ): Promise<unknown> {
    // The per-gene GET /diseases route was removed; disease annotations are
    // now served by POST /api/disease with a JSON array of gene IDs.
    const url = `${this.baseUrl}/disease?limit=${limit}`;
    try {
      return await postJson<unknown>(url, [geneId]);
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

  async getDisease(doId: string): Promise<unknown | null> {
    const url = `${this.baseUrl}/disease/${encodeURIComponent(doId)}`;
    try {
      return await fetchJson<unknown>(url);
    } catch {
      return null;
    }
  }

  async getDiseaseGenes(doId: string, limit: number = 100): Promise<unknown> {
    const url = `${this.baseUrl}/disease/${encodeURIComponent(doId)}/genes?limit=${limit}`;
    try {
      return await fetchJson<unknown>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getDiseaseModels(doId: string, limit: number = 100): Promise<unknown> {
    const url = `${this.baseUrl}/disease/${encodeURIComponent(doId)}/models?limit=${limit}`;
    try {
      return await fetchJson<unknown>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getDiseaseAlleles(doId: string, limit: number = 100): Promise<unknown> {
    const url = `${this.baseUrl}/disease/${encodeURIComponent(doId)}/alleles?limit=${limit}`;
    try {
      return await fetchJson<unknown>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getGeneExpression(
    geneId: string,
    limit: number = 100
  ): Promise<unknown> {
    // The per-gene GET /expression route was removed; expression annotations
    // are now served by POST /api/expression with a JSON array of gene IDs.
    const url = `${this.baseUrl}/expression?limit=${limit}`;
    try {
      return await postJson<unknown>(url, [geneId]);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getOrthologs(geneId: string): Promise<unknown> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/orthologs`;
    try {
      return await fetchJson<unknown>(url);
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getParalogs(geneId: string): Promise<unknown> {
    const url = `${this.baseUrl}/gene/${encodeURIComponent(geneId)}/paralogs`;
    try {
      return await fetchJson<unknown>(url);
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
  ): Promise<unknown> {
    // The combined GET /interactions route was split into separate molecular
    // and genetic endpoints. Fetch both and merge, tagging each row.
    const enc = encodeURIComponent(geneId);
    const fetchKind = (kind: "molecular" | "genetic") =>
      fetchJson<{ results?: unknown[]; total?: number }>(
        `${this.baseUrl}/gene/${enc}/${kind}-interactions?limit=${limit}`
      )
        .then((r) => ({
          results: (r.results ?? []).map((row) =>
            row && typeof row === "object"
              ? { ...(row as Record<string, unknown>), interactionCategory: kind }
              : row
          ),
          total: r.total ?? 0,
        }))
        .catch(() => ({ results: [] as unknown[], total: 0 }));

    const [molecular, genetic] = await Promise.all([
      fetchKind("molecular"),
      fetchKind("genetic"),
    ]);

    return {
      results: [...molecular.results, ...genetic.results],
      total: molecular.total + genetic.total,
      molecularTotal: molecular.total,
      geneticTotal: genetic.total,
    };
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
