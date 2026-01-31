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
  QueryBuilder,
  QueryConstraint,
  PathQueryResult,
  MineTemplate,
  MineList,
  ListContents,
} from "./types.js";

const AGR_API_URL = "https://www.alliancegenome.org/api";
const ALLIANCEMINE_URL = "https://alliancemine.alliancegenome.org/alliancemine/service";

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
   * Search using AllianceMine for more advanced queries.
   * Falls back to PathQuery-based search if keyword search fails.
   */
  async searchMine(
    query: string,
    type?: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    // Try keyword search first
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
        wasSuccessful?: boolean;
        error?: string;
      }>(url);

      // Check if search service returned an error
      if (response.wasSuccessful === false || response.error) {
        throw new Error(response.error || "Search service unavailable");
      }

      return {
        query,
        results: this.parseMineResults(response.results, limit),
        total: response.totalHits,
      };
    } catch {
      // Fallback to PathQuery-based search
      return this.searchMineViaPathQuery(query, type, limit);
    }
  }

  /**
   * Fallback search using PathQuery when keyword search is unavailable
   */
  private async searchMineViaPathQuery(
    query: string,
    type?: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    const searchType = type || "Gene";
    const xml = `<query model="genomic" view="${searchType}.primaryIdentifier ${searchType}.symbol ${searchType}.name ${searchType}.organism.shortName">
      <constraint path="${searchType}.symbol" op="CONTAINS" value="${this.escapeXml(query)}"/>
    </query>`;

    const params = new URLSearchParams({
      query: xml,
      format: "json",
      size: String(limit),
    });

    const url = `${this.allianceMineUrl}/query/results?${params.toString()}`;

    try {
      const response = await this.fetch<{
        results: unknown[][];
        columnHeaders?: string[];
      }>(url);

      const results: SearchResult[] = response.results.map((row) => ({
        id: String(row[0] || ""),
        symbol: String(row[1] || ""),
        name: String(row[2] || row[1] || ""),
        species: String(row[3] || ""),
        category: searchType.toLowerCase(),
      }));

      return {
        query,
        results,
        total: results.length,
      };
    } catch {
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
    const url = `${this.agrApiUrl}/species`;
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

  // ============================================
  // AllianceMine API Methods
  // ============================================

  private getAuthToken(): string | null {
    return process.env.ALLIANCEMINE_TOKEN || null;
  }

  private async fetchWithAuth<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error(
        "Authentication required. Set ALLIANCEMINE_TOKEN environment variable."
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    };

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Run a raw PathQuery XML query against AllianceMine
   */
  async runPathQuery(xml: string): Promise<PathQueryResult> {
    const params = new URLSearchParams({
      query: xml,
      format: "json",
    });

    const url = `${this.allianceMineUrl}/query/results?${params.toString()}`;

    try {
      const response = await this.fetch<{
        results: unknown[][];
        columnHeaders?: string[];
        rootClass?: string;
      }>(url);

      // Convert array results to objects using column headers
      const headers = response.columnHeaders || [];
      const results = response.results.map((row) => {
        const obj: Record<string, unknown> = {};
        row.forEach((val, idx) => {
          const key = headers[idx] || `col${idx}`;
          obj[key] = val;
        });
        return obj;
      });

      return {
        results,
        columnHeaders: headers,
        rootClass: response.rootClass,
      };
    } catch (error) {
      throw new Error(`PathQuery failed: ${error}`);
    }
  }

  /**
   * Build PathQuery XML from QueryBuilder definition
   */
  buildPathQueryXml(query: QueryBuilder): string {
    const { from, select, where, joins, sort } = query;

    // Prefix select fields with root class if not already prefixed
    const viewFields = select.map((field) =>
      field.startsWith(`${from}.`) ? field : `${from}.${field}`
    );

    let xml = `<query model="genomic" view="${viewFields.join(" ")}"`;
    if (sort) {
      xml += ` sortOrder="${sort.field} ${sort.direction}"`;
    }
    xml += ">";

    // Add outer joins
    if (joins && joins.length > 0) {
      for (const join of joins) {
        xml += `<join path="${from}.${join}" style="OUTER"/>`;
      }
    }

    // Add constraints
    if (where) {
      let code = "A";
      for (const [field, constraint] of Object.entries(where)) {
        const path = field.includes(".") ? `${from}.${field}` : `${from}.${field}`;

        if (typeof constraint === "string") {
          xml += `<constraint path="${path}" op="=" value="${this.escapeXml(constraint)}" code="${code}"/>`;
        } else {
          const c = constraint as QueryConstraint;
          if (Array.isArray(c.value)) {
            xml += `<constraint path="${path}" op="${c.op}" code="${code}">${c.value.map((v) => `<value>${this.escapeXml(v)}</value>`).join("")}</constraint>`;
          } else if (c.op === "IS NULL" || c.op === "IS NOT NULL") {
            xml += `<constraint path="${path}" op="${c.op}" code="${code}"/>`;
          } else {
            xml += `<constraint path="${path}" op="${c.op}" value="${this.escapeXml(String(c.value))}" code="${code}"/>`;
          }
        }
        code = String.fromCharCode(code.charCodeAt(0) + 1);
      }
    }

    xml += "</query>";
    return xml;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Build and run a query using the QueryBuilder DSL
   */
  async buildAndRunQuery(
    query: QueryBuilder
  ): Promise<PathQueryResult> {
    const xml = this.buildPathQueryXml(query);

    // Add limit via size parameter
    const params = new URLSearchParams({
      query: xml,
      format: "json",
      size: String(query.limit || 100),
    });

    const url = `${this.allianceMineUrl}/query/results?${params.toString()}`;

    try {
      const response = await this.fetch<{
        results: unknown[][];
        columnHeaders?: string[];
        rootClass?: string;
      }>(url);

      const headers = response.columnHeaders || [];
      const results = response.results.map((row) => {
        const obj: Record<string, unknown> = {};
        row.forEach((val, idx) => {
          const key = headers[idx] || `col${idx}`;
          obj[key] = val;
        });
        return obj;
      });

      return {
        results,
        columnHeaders: headers,
        rootClass: response.rootClass,
      };
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  /**
   * List available query templates
   */
  async listTemplates(): Promise<MineTemplate[]> {
    const url = `${this.allianceMineUrl}/templates?format=json`;

    try {
      const response = await this.fetch<{
        templates: Record<string, MineTemplate>;
      }>(url);

      return Object.entries(response.templates).map(([name, template]) => ({
        ...template,
        name,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Run a template query with parameters.
   * Parameters should be provided as { "1": { path: "Gene", op: "LOOKUP", value: "BRCA1" } }
   * or simplified as { "1": "BRCA1" } for LOOKUP constraints (path and op inferred from template).
   */
  async runTemplate(
    name: string,
    params: Record<string, string | { path?: string; op?: string; value: string }>,
    limit: number = 100
  ): Promise<PathQueryResult> {
    const queryParams = new URLSearchParams({
      name,
      format: "json",
      size: String(limit),
    });

    // Add template parameters
    for (const [key, param] of Object.entries(params)) {
      if (typeof param === "string") {
        // Simple format: just the value, assume LOOKUP
        queryParams.set(`value${key}`, param);
      } else {
        // Full format with path, op, value
        if (param.path) queryParams.set(`constraint${key}`, param.path);
        if (param.op) queryParams.set(`op${key}`, param.op);
        queryParams.set(`value${key}`, param.value);
      }
    }

    const url = `${this.allianceMineUrl}/template/results?${queryParams.toString()}`;

    try {
      const response = await this.fetch<{
        results: unknown[][];
        columnHeaders?: string[];
      }>(url);

      const headers = response.columnHeaders || [];
      const results = response.results.map((row) => {
        const obj: Record<string, unknown> = {};
        row.forEach((val, idx) => {
          const key = headers[idx] || `col${idx}`;
          obj[key] = val;
        });
        return obj;
      });

      return {
        results,
        columnHeaders: headers,
      };
    } catch (error) {
      throw new Error(`Template query failed: ${error}`);
    }
  }

  /**
   * Get all available lists
   */
  async getLists(type?: string): Promise<MineList[]> {
    const params = new URLSearchParams();
    if (type) {
      params.set("type", type);
    }

    const url = `${this.allianceMineUrl}/lists?${params.toString()}`;

    try {
      const response = await this.fetch<{
        lists: MineList[];
      }>(url);

      return response.lists || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get contents of a specific list
   */
  async getList(name: string): Promise<ListContents | null> {
    const url = `${this.allianceMineUrl}/list/results/${encodeURIComponent(name)}?format=json`;

    try {
      const response = await this.fetch<{
        results: unknown[][];
        columnHeaders?: string[];
        listInfo?: { name: string; type: string; size: number };
      }>(url);

      const headers = response.columnHeaders || [];
      const results = response.results.map((row) => {
        const obj: Record<string, unknown> = {};
        row.forEach((val, idx) => {
          const key = headers[idx] || `col${idx}`;
          obj[key] = val;
        });
        return obj;
      });

      return {
        name: response.listInfo?.name || name,
        type: response.listInfo?.type || "unknown",
        size: response.listInfo?.size || results.length,
        results,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a new list (requires authentication)
   */
  async createList(
    name: string,
    type: string,
    identifiers: string[],
    description?: string
  ): Promise<MineList> {
    const params = new URLSearchParams({
      name,
      type,
    });
    if (description) {
      params.set("description", description);
    }

    const url = `${this.allianceMineUrl}/lists?${params.toString()}`;

    const response = await this.fetchWithAuth<MineList>(url, {
      method: "POST",
      body: identifiers.join("\n"),
      headers: {
        "Content-Type": "text/plain",
      },
    });

    return response;
  }

  /**
   * Add items to an existing list (requires authentication)
   */
  async addToList(name: string, identifiers: string[]): Promise<MineList> {
    const url = `${this.allianceMineUrl}/lists/append/${encodeURIComponent(name)}`;

    const response = await this.fetchWithAuth<MineList>(url, {
      method: "POST",
      body: identifiers.join("\n"),
      headers: {
        "Content-Type": "text/plain",
      },
    });

    return response;
  }

  /**
   * Delete a list (requires authentication)
   */
  async deleteList(name: string): Promise<{ success: boolean }> {
    const url = `${this.allianceMineUrl}/lists/${encodeURIComponent(name)}`;

    await this.fetchWithAuth<unknown>(url, {
      method: "DELETE",
    });

    return { success: true };
  }
}
