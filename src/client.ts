import {
  EntityType,
  SearchResponse,
  SearchResult,
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
} from "./types.js";

const AGR_API_URL = "https://www.alliancegenome.org/api";
const ALLIANCEMINE_URL = "https://www.alliancegenome.org/alliancemine/service";

export class AllianceClient {
  private agrApiUrl: string;
  private allianceMineUrl: string;

  constructor(agrApiUrl?: string, allianceMineUrl?: string) {
    this.agrApiUrl = agrApiUrl || AGR_API_URL;
    this.allianceMineUrl = allianceMineUrl || ALLIANCEMINE_URL;
  }

  private async fetch<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search AGR using the main search API
   */
  async search(
    query: string,
    category?: EntityType,
    species?: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });

    if (category) {
      params.set("category", category);
    }

    // Resolve species short name to full name
    if (species) {
      const speciesName = SPECIES_MAP[species.toLowerCase()] || species;
      if (SPECIES.includes(speciesName as Species)) {
        params.set("species", speciesName);
      }
    }

    const url = `${this.agrApiUrl}/search?${params.toString()}`;

    try {
      const response = await this.fetch<{
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
    } catch (error) {
      return { query, results: [], total: 0 };
    }
  }

  /**
   * Search using AllianceMine for more advanced queries
   */
  async searchMine(
    query: string,
    type?: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      size: String(limit),
    });

    if (type) {
      params.set(`facet_Category`, type);
    }

    const url = `${this.allianceMineUrl}/search?${params.toString()}`;

    try {
      const response = await this.fetch<{
        results: Array<{
          type: string;
          id: number;
          relevance: number;
          fields: Record<string, unknown>;
        }>;
        totalHits: number;
      }>(url);

      return {
        query,
        results: this.parseMineResults(response.results, limit),
        total: response.totalHits,
      };
    } catch (error) {
      return { query, results: [], total: 0 };
    }
  }

  private parseMineResults(
    results: Array<{
      type: string;
      id: number;
      fields: Record<string, unknown>;
    }>,
    limit: number
  ): SearchResult[] {
    return results.slice(0, limit).map((r) => ({
      id: String(r.fields.primaryIdentifier || r.fields.secondaryIdentifier || r.id),
      symbol: String(r.fields.symbol || ""),
      name: String(r.fields.name || r.fields.symbol || r.fields.primaryIdentifier || ""),
      species: String(r.fields["organism.name"] || ""),
      category: r.type.toLowerCase(),
      description: String(r.fields.briefDescription || r.fields.description || ""),
    }));
  }

  /**
   * Get detailed gene information
   */
  async getGene(geneId: string): Promise<GeneData | null> {
    const url = `${this.agrApiUrl}/gene/${encodeURIComponent(geneId)}`;

    try {
      const data = await this.fetch<GeneData>(url);
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get disease associations for a gene
   */
  async getGeneDiseases(
    geneId: string,
    limit: number = 100
  ): Promise<DiseaseResponse> {
    const url = `${this.agrApiUrl}/gene/${encodeURIComponent(geneId)}/diseases?limit=${limit}`;

    try {
      const data = await this.fetch<DiseaseResponse>(url);
      return data;
    } catch (error) {
      return { results: [], total: 0 };
    }
  }

  /**
   * Search diseases
   */
  async searchDiseases(
    query: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    return this.search(query, "disease", undefined, limit);
  }

  /**
   * Get expression data for a gene
   */
  async getGeneExpression(
    geneId: string,
    limit: number = 100
  ): Promise<ExpressionResponse> {
    const url = `${this.agrApiUrl}/gene/${encodeURIComponent(geneId)}/expression?limit=${limit}`;

    try {
      const data = await this.fetch<ExpressionResponse>(url);
      return data;
    } catch (error) {
      return { results: [], total: 0 };
    }
  }

  /**
   * Get orthologs for a gene
   */
  async getOrthologs(geneId: string): Promise<OrthologyResponse> {
    const url = `${this.agrApiUrl}/gene/${encodeURIComponent(geneId)}/homologs`;

    try {
      const data = await this.fetch<OrthologyResponse>(url);
      return data;
    } catch (error) {
      return { results: [], total: 0 };
    }
  }

  /**
   * Get phenotypes for a gene
   */
  async getGenePhenotypes(
    geneId: string,
    limit: number = 100
  ): Promise<PhenotypeResponse> {
    const url = `${this.agrApiUrl}/gene/${encodeURIComponent(geneId)}/phenotypes?limit=${limit}`;

    try {
      const data = await this.fetch<PhenotypeResponse>(url);
      return data;
    } catch (error) {
      return { results: [], total: 0 };
    }
  }

  /**
   * Get interactions for a gene
   */
  async getGeneInteractions(
    geneId: string,
    limit: number = 100
  ): Promise<InteractionResponse> {
    const url = `${this.agrApiUrl}/gene/${encodeURIComponent(geneId)}/interactions?limit=${limit}`;

    try {
      const data = await this.fetch<InteractionResponse>(url);
      return data;
    } catch (error) {
      return { results: [], total: 0 };
    }
  }

  /**
   * Get alleles for a gene
   */
  async getGeneAlleles(
    geneId: string,
    limit: number = 100
  ): Promise<AlleleResponse> {
    const url = `${this.agrApiUrl}/gene/${encodeURIComponent(geneId)}/alleles?limit=${limit}`;

    try {
      const data = await this.fetch<AlleleResponse>(url);
      return data;
    } catch (error) {
      return { results: [], total: 0 };
    }
  }

  /**
   * Search alleles/variants
   */
  async searchAlleles(
    query: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    return this.search(query, "allele", undefined, limit);
  }

  /**
   * Get list of supported species from API
   */
  async getSpeciesList(): Promise<unknown> {
    const url = `${this.agrApiUrl}/api/species`;
    try {
      return await this.fetch<unknown>(url);
    } catch {
      // Fallback to hardcoded list
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

  /**
   * Helper to resolve species short name
   */
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
