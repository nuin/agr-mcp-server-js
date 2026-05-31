import {
  SearchResponse,
  SearchResult,
  QueryBuilder,
  QueryConstraint,
  PathQueryResult,
  MineTemplate,
  MineList,
  ListContents,
} from "../types.js";
import { fetchJson } from "./agr-client.js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rowsToObjects(
  rows: unknown[][],
  headers: string[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    row.forEach((val, idx) => {
      const key = headers[idx] || `col${idx}`;
      obj[key] = val;
    });
    return obj;
  });
}

export class MineClient {
  constructor(private readonly baseUrl: string) {}

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

  async search(
    query: string,
    type?: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query, size: String(limit) });

    if (type) {
      params.set("facet_Category", type);
    }

    const url = `${this.baseUrl}/search?${params.toString()}`;

    try {
      const response = await fetchJson<{
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

      if (response.wasSuccessful === false || response.error) {
        throw new Error(response.error || "Search service unavailable");
      }

      return {
        query,
        results: this.parseMineResults(response.results, limit),
        total: response.totalHits,
      };
    } catch {
      return this.searchViaPathQuery(query, type, limit);
    }
  }

  private async searchViaPathQuery(
    query: string,
    type?: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    const searchType = type || "Gene";
    const xml = `<query model="genomic" view="${searchType}.primaryIdentifier ${searchType}.symbol ${searchType}.name ${searchType}.organism.shortName">
      <constraint path="${searchType}.symbol" op="CONTAINS" value="${escapeXml(query)}"/>
    </query>`;

    const params = new URLSearchParams({
      query: xml,
      format: "json",
      size: String(limit),
    });

    const url = `${this.baseUrl}/query/results?${params.toString()}`;

    try {
      const response = await fetchJson<{
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

      return { query, results, total: results.length };
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

  async runPathQuery(xml: string): Promise<PathQueryResult> {
    const params = new URLSearchParams({ query: xml, format: "json" });
    const url = `${this.baseUrl}/query/results?${params.toString()}`;

    try {
      const response = await fetchJson<{
        results: unknown[][];
        columnHeaders?: string[];
        rootClass?: string;
      }>(url);

      const headers = response.columnHeaders || [];
      return {
        results: rowsToObjects(response.results, headers),
        columnHeaders: headers,
        rootClass: response.rootClass,
      };
    } catch (error) {
      throw new Error(`PathQuery failed: ${error}`);
    }
  }

  buildPathQueryXml(query: QueryBuilder): string {
    const { from, select, where, joins, sort } = query;

    const viewFields = select.map((field) =>
      field.startsWith(`${from}.`) ? field : `${from}.${field}`
    );

    let xml = `<query model="genomic" view="${viewFields.join(" ")}"`;
    if (sort) {
      xml += ` sortOrder="${sort.field} ${sort.direction}"`;
    }
    xml += ">";

    if (joins && joins.length > 0) {
      for (const join of joins) {
        xml += `<join path="${from}.${join}" style="OUTER"/>`;
      }
    }

    if (where) {
      let code = "A";
      for (const [field, constraint] of Object.entries(where)) {
        const path = field.includes(".") ? `${from}.${field}` : `${from}.${field}`;

        if (typeof constraint === "string") {
          xml += `<constraint path="${path}" op="=" value="${escapeXml(constraint)}" code="${code}"/>`;
        } else {
          const c = constraint as QueryConstraint;
          if (Array.isArray(c.value)) {
            xml += `<constraint path="${path}" op="${c.op}" code="${code}">${c.value.map((v) => `<value>${escapeXml(v)}</value>`).join("")}</constraint>`;
          } else if (c.op === "IS NULL" || c.op === "IS NOT NULL") {
            xml += `<constraint path="${path}" op="${c.op}" code="${code}"/>`;
          } else {
            xml += `<constraint path="${path}" op="${c.op}" value="${escapeXml(String(c.value))}" code="${code}"/>`;
          }
        }
        code = String.fromCharCode(code.charCodeAt(0) + 1);
      }
    }

    xml += "</query>";
    return xml;
  }

  async buildAndRunQuery(query: QueryBuilder): Promise<PathQueryResult> {
    const xml = this.buildPathQueryXml(query);

    const params = new URLSearchParams({
      query: xml,
      format: "json",
      size: String(query.limit || 100),
    });

    const url = `${this.baseUrl}/query/results?${params.toString()}`;

    try {
      const response = await fetchJson<{
        results: unknown[][];
        columnHeaders?: string[];
        rootClass?: string;
      }>(url);

      const headers = response.columnHeaders || [];
      return {
        results: rowsToObjects(response.results, headers),
        columnHeaders: headers,
        rootClass: response.rootClass,
      };
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  async listTemplates(): Promise<MineTemplate[]> {
    const url = `${this.baseUrl}/templates?format=json`;
    try {
      const response = await fetchJson<{
        templates: Record<string, MineTemplate>;
      }>(url);

      return Object.entries(response.templates).map(([name, template]) => ({
        ...template,
        name,
      }));
    } catch {
      return [];
    }
  }

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

    for (const [key, param] of Object.entries(params)) {
      if (typeof param === "string") {
        queryParams.set(`value${key}`, param);
      } else {
        if (param.path) queryParams.set(`constraint${key}`, param.path);
        if (param.op) queryParams.set(`op${key}`, param.op);
        queryParams.set(`value${key}`, param.value);
      }
    }

    const url = `${this.baseUrl}/template/results?${queryParams.toString()}`;

    try {
      const response = await fetchJson<{
        results: unknown[][];
        columnHeaders?: string[];
      }>(url);

      const headers = response.columnHeaders || [];
      return {
        results: rowsToObjects(response.results, headers),
        columnHeaders: headers,
      };
    } catch (error) {
      throw new Error(`Template query failed: ${error}`);
    }
  }

  async getLists(type?: string): Promise<MineList[]> {
    const params = new URLSearchParams();
    if (type) {
      params.set("type", type);
    }

    const url = `${this.baseUrl}/lists?${params.toString()}`;

    try {
      const response = await fetchJson<{ lists: MineList[] }>(url);
      return response.lists || [];
    } catch {
      return [];
    }
  }

  async getList(name: string): Promise<ListContents | null> {
    const url = `${this.baseUrl}/list/results/${encodeURIComponent(name)}?format=json`;

    try {
      const response = await fetchJson<{
        results: unknown[][];
        columnHeaders?: string[];
        listInfo?: { name: string; type: string; size: number };
      }>(url);

      const headers = response.columnHeaders || [];
      const results = rowsToObjects(response.results, headers);

      return {
        name: response.listInfo?.name || name,
        type: response.listInfo?.type || "unknown",
        size: response.listInfo?.size || results.length,
        results,
      };
    } catch {
      return null;
    }
  }

  async createList(
    name: string,
    type: string,
    identifiers: string[],
    description?: string
  ): Promise<MineList> {
    const params = new URLSearchParams({ name, type });
    if (description) {
      params.set("description", description);
    }

    const url = `${this.baseUrl}/lists?${params.toString()}`;

    return this.fetchWithAuth<MineList>(url, {
      method: "POST",
      body: identifiers.join("\n"),
      headers: { "Content-Type": "text/plain" },
    });
  }

  async addToList(name: string, identifiers: string[]): Promise<MineList> {
    const url = `${this.baseUrl}/lists/append/${encodeURIComponent(name)}`;

    return this.fetchWithAuth<MineList>(url, {
      method: "POST",
      body: identifiers.join("\n"),
      headers: { "Content-Type": "text/plain" },
    });
  }

  async deleteList(name: string): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/lists/${encodeURIComponent(name)}`;

    await this.fetchWithAuth<unknown>(url, { method: "DELETE" });

    return { success: true };
  }
}
