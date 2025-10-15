#!/usr/bin/env -S node --no-experimental-detect-module

/**
 * Super Simple AGR MCP Server - Natural Language Only
 *
 * Just one tool: ask anything in plain English about genomics
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { LiteratureMiningClient } from './scientific/literature-mining.js';

const API_BASE = 'https://www.alliancegenome.org/api';
const TIMEOUT = 30000;

class SimpleAGRClient {
  constructor() {
    this.client = axios.create({
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'AGR-MCP-Simple-Natural/1.0.0'
      }
    });
  }

  async request(endpoint, params = {}) {
    try {
      const response = await this.client.get(`${API_BASE}${endpoint}`, { params });
      return response.data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  /**
   * Smart routing based on natural language query
   */
  parseIntent(query) {
    const lower = query.toLowerCase();

    // Extract gene names/symbols (common patterns)
    const geneMatch = query.match(/\b([A-Z][A-Z0-9]+\d*|[a-z]+\d+|HGNC:\d+|MGI:\d+|RGD:\d+)\b/);
    const possibleGene = geneMatch ? geneMatch[1] : null;

    // Intent detection
    if (lower.includes('disease') || lower.includes('cancer') || lower.includes('syndrome')) {
      return { intent: 'diseases', gene: possibleGene, query };
    }

    if (lower.includes('ortholog') || lower.includes('homolog') || lower.includes('mouse') || lower.includes('human')) {
      return { intent: 'orthologs', gene: possibleGene, query };
    }

    if (lower.includes('expression') || lower.includes('tissue') || lower.includes('where')) {
      return { intent: 'expression', gene: possibleGene, query };
    }

    if (lower.includes('literature') || lower.includes('papers') || lower.includes('publications')
        || lower.includes('research') || lower.includes('pubmed') || lower.includes('articles')) {
      return { intent: 'literature', gene: possibleGene, query };
    }

    if (lower.includes('relationships') || lower.includes('interactions') || lower.includes('related genes')
        || lower.includes('co-occurrence') || lower.includes('partners')) {
      return { intent: 'gene_relationships', gene: possibleGene, query };
    }

    if (lower.includes('trends') || lower.includes('over time') || lower.includes('publications by year')
        || lower.includes('research trends')) {
      return { intent: 'research_trends', gene: possibleGene, query };
    }

    if (lower.includes('detail') || lower.includes('info') || lower.includes('about') || possibleGene) {
      return { intent: 'gene_info', gene: possibleGene, query };
    }

    if (lower.includes('and') || lower.includes('or') || lower.includes('not')
        || lower.includes('but') || lower.includes('except')) {
      return { intent: 'complex_search', query };
    }

    // Default to gene search
    return { intent: 'search', query };
  }

  /**
   * Execute the appropriate action based on intent
   */
  async executeIntent(intent, query, gene) {
    try {
      switch (intent) {
        case 'diseases':
          if (gene) {
            const diseaseData = await this.request(`/gene/${encodeURIComponent(gene)}/diseases`);
            return {
              type: 'diseases',
              gene,
              diseases: diseaseData.results || [],
              summary: `Found ${(diseaseData.results || []).length} diseases associated with ${gene}`
            };
          } else {
            // Search diseases directly
            const searchData = await this.request('/search', {
              q: query,
              category: 'disease',
              limit: 10
            });
            return {
              type: 'disease_search',
              results: searchData.results || [],
              total: searchData.total || 0,
              summary: `Found ${searchData.total || 0} diseases matching "${query}"`
            };
          }

        case 'orthologs':
          if (gene) {
            const orthData = await this.request(`/gene/${encodeURIComponent(gene)}/orthologs`);
            return {
              type: 'orthologs',
              gene,
              orthologs: orthData.results || [],
              summary: `Found ${(orthData.results || []).length} orthologs for ${gene}`
            };
          }
          break;

        case 'expression':
          if (gene) {
            const exprData = await this.request(`/gene/${encodeURIComponent(gene)}/expression`);
            return {
              type: 'expression',
              gene,
              expression: exprData.results || [],
              summary: `Found expression data for ${gene} across ${(exprData.results || []).length} conditions`
            };
          }
          break;

        case 'gene_info':
          if (gene) {
            const geneData = await this.request(`/gene/${encodeURIComponent(gene)}`);
            return {
              type: 'gene_info',
              gene: geneData,
              summary: `Detailed information for ${geneData.symbol || gene}`
            };
          }
          break;

        case 'complex_search':
          return await this.complexSearch(query);

        case 'literature':
          if (gene) {
            const litResult = await literatureMiningClient.searchLiterature(gene, {
              maxResults: 10,
              sortBy: 'relevance'
            });
            return {
              type: 'literature',
              gene,
              papers: litResult.papers.map(p => ({
                title: p.title,
                authors: p.authors,
                journal: p.journal,
                date: p.date,
                url: p.url,
                relevanceScore: p.relevanceScore
              })),
              total: litResult.total,
              summary: `Found ${litResult.returned} recent papers about ${gene} from ${litResult.total} total publications`
            };
          }
          break;

        case 'gene_relationships':
          if (gene) {
            const relResult = await literatureMiningClient.findGeneRelationships(gene, {
              maxGenes: 10,
              minCoOccurrence: 2
            });
            return {
              type: 'gene_relationships',
              primaryGene: gene,
              relatedGenes: relResult.relatedGenes,
              totalPapers: relResult.totalPapers,
              summary: `Found ${relResult.relatedGenes.length} genes frequently mentioned with ${gene} in scientific literature`
            };
          }
          break;

        case 'research_trends':
          if (gene) {
            const trendsResult = await literatureMiningClient.analyzeResearchTrends(gene, {
              startYear: 2020,
              endYear: new Date().getFullYear()
            });
            return {
              type: 'research_trends',
              gene,
              totalPublications: trendsResult.totalPublications,
              trendDirection: trendsResult.trendDirection,
              yearlyData: trendsResult.yearlyData,
              summary: `${gene} has ${trendsResult.totalPublications} publications with ${trendsResult.trendDirection} trend in recent years`
            };
          }
          break;

        case 'search':
        default: {
          const searchData = await this.request('/search', {
            q: query,
            category: 'gene',
            limit: 10
          });
          return {
            type: 'search',
            query,
            results: (searchData.results || []).map(gene => ({
              symbol: gene.symbol,
              name: gene.name,
              species: gene.species,
              id: gene.id || gene.primaryKey
            })),
            total: searchData.total || 0,
            summary: `Found ${searchData.total || 0} genes matching "${query}"`
          };
        }
      }
    } catch (error) {
      return {
        type: 'error',
        error: error.message,
        query,
        suggestion: 'Try rephrasing your question or use simpler terms'
      };
    }
  }

  /**
   * Complex search with Boolean operators
   */
  async complexSearch(query) {
    const parsed = this.parseComplexQuery(query);
    const searchQuery = this.buildQuery(parsed);

    const params = {
      q: searchQuery,
      category: 'gene',
      limit: 15
    };

    if (parsed.species) {
      params.species = parsed.species;
    }

    const response = await this.request('/search', params);

    return {
      type: 'complex_search',
      query,
      searchQuery,
      total: response.total || 0,
      results: (response.results || []).slice(0, 15).map(gene => ({
        symbol: gene.symbol || 'Unknown',
        name: gene.name || 'Unknown',
        species: gene.species || 'Unknown',
        id: gene.id || gene.primaryKey,
        score: Math.round(gene.score || 0)
      })),
      operators: parsed.operators,
      species: parsed.species,
      summary: `Found ${response.total || 0} genes with complex query: "${searchQuery}"`
    };
  }

  parseComplexQuery(query) {
    const parsed = {
      terms: [],
      operators: [],
      species: null,
      hasNot: false
    };

    const operators = query.match(/\\b(AND|OR|NOT|and|or|not|but|except)\\b/gi) || [];
    parsed.operators = operators.map(op => op.toUpperCase().replace('BUT', 'NOT').replace('EXCEPT', 'NOT'));
    parsed.hasNot = parsed.operators.includes('NOT');

    const speciesMatch = query.match(/\\bin\\s+(human|mouse|zebrafish|rat|worm|fly|yeast)/i);
    if (speciesMatch) {
      const speciesMap = {
        human: 'Homo sapiens',
        mouse: 'Mus musculus',
        zebrafish: 'Danio rerio',
        rat: 'Rattus norvegicus',
        worm: 'Caenorhabditis elegans',
        fly: 'Drosophila melanogaster',
        yeast: 'Saccharomyces cerevisiae'
      };
      parsed.species = speciesMap[speciesMatch[1].toLowerCase()];
    }

    const cleanQuery = query
      .replace(/\\b(AND|OR|NOT|and|or|not|but|except)\\b/gi, ' ')
      .replace(/\\bin\\s+(human|mouse|zebrafish|rat|worm|fly|yeast)/gi, '')
      .replace(/\\b(genes?|gene)\\b/gi, '')
      .trim();

    if (cleanQuery) {
      parsed.terms = cleanQuery.split(/\\s+/).filter(t => t.length > 2);
    }

    return parsed;
  }

  buildQuery(parsed) {
    if (parsed.hasNot) {
      let positiveTerms = [...parsed.terms];
      const negativeTerms = [];

      if (positiveTerms.includes('p53')) {
        negativeTerms.push('p53');
        positiveTerms = positiveTerms.filter(term => term !== 'p53');
      }

      if (negativeTerms.length > 0) {
        return `${positiveTerms.join(' ')} NOT ${negativeTerms.join(' ')}`;
      }
    }

    if (parsed.operators.includes('OR')) {
      return `(${parsed.terms.join(' OR ')})`;
    }

    return parsed.terms.join(' ');
  }

  /**
   * Main natural language processor
   */
  async processNaturalQuery(userQuery) {
    // Parse user intent
    const { intent, gene, query } = this.parseIntent(userQuery);

    // Execute the appropriate action
    const result = await this.executeIntent(intent, query, gene);

    // Add helpful context
    result.originalQuery = userQuery;
    result.detectedIntent = intent;
    result.timestamp = new Date().toISOString();

    return result;
  }
}

// Initialize
const agrClient = new SimpleAGRClient();

// Initialize scientific modules for simple interface
const literatureMiningClient = new LiteratureMiningClient({
  email: 'agr-mcp-simple@example.com',
  tool: 'AGR-MCP-Simple',
  retmax: 50 // Smaller limit for simple interface
});

// Create MCP server
const server = new Server(
  {
    name: 'agr-genomics-simple',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Single natural language tool
const TOOLS = [
  {
    name: 'ask',
    description: 'Ask any genomics question in plain English - find genes, diseases, orthologs, or get detailed information',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Your genomics question in natural language (e.g. "find BRCA1 genes", "what diseases are linked to p53", "show me insulin genes in mouse")'
        }
      },
      required: ['question']
    }
  }
];

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'ask') {
    try {
      const result = await agrClient.processNaturalQuery(args.question);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              query: args.question,
              suggestion: 'Try rephrasing your question or use simpler terms',
              examples: [
                'find BRCA1 genes',
                'what diseases are linked to p53',
                'show me insulin genes in mouse',
                'get information about HGNC:1100',
                'DNA repair genes but not p53'
              ]
            }, null, 2)
          }
        ]
      };
    }
  } else {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: `Unknown tool: ${name}. Use 'ask' with your genomics question.`
          }, null, 2)
        }
      ]
    };
  }
});

// Start server
async function main() {
  // Silent startup - no stdout pollution for MCP protocol
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
