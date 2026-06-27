import { loadConfig } from "./config.js";
import { AgrClient } from "./clients/agr-client.js";
import { MineClient } from "./clients/mine-client.js";
import {
  EntityType,
  SearchResponse,
  PhenotypeResponse,
  AlleleResponse,
  Species,
  QueryBuilder,
  PathQueryResult,
  MineTemplate,
  MineList,
  ListContents,
} from "./types.js";

export class AllianceClient {
  private agr: AgrClient;
  private mine: MineClient;

  constructor(agrApiUrl?: string, allianceMineUrl?: string) {
    const config = loadConfig({ agrApiUrl, allianceMineUrl });
    this.agr = new AgrClient(config.agrApiUrl);
    this.mine = new MineClient(config.allianceMineUrl);
  }

  search(
    query: string,
    category?: EntityType,
    species?: string,
    limit?: number
  ): Promise<SearchResponse> {
    return this.agr.search(query, category, species, limit);
  }

  getGene(geneId: string): Promise<unknown | null> {
    return this.agr.getGene(geneId);
  }

  getGeneDiseases(geneId: string, limit?: number): Promise<unknown> {
    return this.agr.getGeneDiseases(geneId, limit);
  }

  searchDiseases(query: string, limit?: number): Promise<SearchResponse> {
    return this.agr.searchDiseases(query, limit);
  }

  getGeneExpression(geneId: string, limit?: number): Promise<unknown> {
    return this.agr.getGeneExpression(geneId, limit);
  }

  getOrthologs(geneId: string): Promise<unknown> {
    return this.agr.getOrthologs(geneId);
  }

  getGenePhenotypes(
    geneId: string,
    limit?: number
  ): Promise<PhenotypeResponse> {
    return this.agr.getGenePhenotypes(geneId, limit);
  }

  getGeneInteractions(geneId: string, limit?: number): Promise<unknown> {
    return this.agr.getGeneInteractions(geneId, limit);
  }

  getGeneAlleles(geneId: string, limit?: number): Promise<AlleleResponse> {
    return this.agr.getGeneAlleles(geneId, limit);
  }

  searchAlleles(query: string, limit?: number): Promise<SearchResponse> {
    return this.agr.searchAlleles(query, limit);
  }

  getSpeciesList(): Promise<unknown> {
    return this.agr.getSpeciesList();
  }

  resolveSpecies(input: string): Species | null {
    return this.agr.resolveSpecies(input);
  }

  searchMine(
    query: string,
    type?: string,
    limit?: number
  ): Promise<SearchResponse> {
    return this.mine.search(query, type, limit);
  }

  runPathQuery(xml: string): Promise<PathQueryResult> {
    return this.mine.runPathQuery(xml);
  }

  buildPathQueryXml(query: QueryBuilder): string {
    return this.mine.buildPathQueryXml(query);
  }

  buildAndRunQuery(query: QueryBuilder): Promise<PathQueryResult> {
    return this.mine.buildAndRunQuery(query);
  }

  listTemplates(): Promise<MineTemplate[]> {
    return this.mine.listTemplates();
  }

  runTemplate(
    name: string,
    params: Record<
      string,
      string | { path?: string; op?: string; value: string }
    >,
    limit?: number
  ): Promise<PathQueryResult> {
    return this.mine.runTemplate(name, params, limit);
  }

  getLists(type?: string): Promise<MineList[]> {
    return this.mine.getLists(type);
  }

  getList(name: string): Promise<ListContents | null> {
    return this.mine.getList(name);
  }

  createList(
    name: string,
    type: string,
    identifiers: string[],
    description?: string
  ): Promise<MineList> {
    return this.mine.createList(name, type, identifiers, description);
  }

  addToList(name: string, identifiers: string[]): Promise<MineList> {
    return this.mine.addToList(name, identifiers);
  }

  deleteList(name: string): Promise<{ success: boolean }> {
    return this.mine.deleteList(name);
  }
}
