#!/usr/bin/env node

/**
 * Simple AGR MCP Server - Minimal Implementation
 *
 * A streamlined MCP server for Alliance of Genome Resources with basic functionality
 */

// CRITICAL: Disable Node v23's experimental-detect-module before any imports
// This must run before any ESM imports or stdin will be treated as code to evaluate
if (parseInt(process.versions.node.split('.')[0]) >= 23) {
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --no-experimental-detect-module';

  // If we haven't set the flag yet, re-exec with the flag
  if (!process.execArgv.includes('--no-experimental-detect-module')) {
    const { spawn } = await import('child_process');
    const child = spawn(process.execPath, ['--no-experimental-detect-module', ...process.execArgv, process.argv[1], ...process.argv.slice(2)], {
      stdio: 'inherit'
    });
    child.on('exit', (code) => process.exit(code || 0));
    // Don't continue - let the re-exec handle it
    await new Promise(() => {});
  }
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Simple configuration
const API_BASE = 'https://www.alliancegenome.org/api';
const TIMEOUT = 30000;

/**
 * Simple AGR Client
 */
class SimpleAGRClient {
  constructor() {
    this.client = axios.create({
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'AGR-MCP-Server-Simple/1.0.0'
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
   * Parse complex query with Boolean operators
   */
  parseComplexQuery(query) {
    const parsed = {
      terms: [],
      operators: [],
      species: null,
      hasNot: false
    };

    // Extract operators
    const operators = query.match(/\b(AND|OR|NOT)\b/gi) || [];
    parsed.operators = operators.map(op => op.toUpperCase());
    parsed.hasNot = parsed.operators.includes('NOT');

    // Extract species
    const speciesMatch = query.match(/\bin\s+(human|mouse|zebrafish)/i);
    if (speciesMatch) {
      const speciesMap = {
        human: 'Homo sapiens',
        mouse: 'Mus musculus',
        zebrafish: 'Danio rerio'
      };
      parsed.species = speciesMap[speciesMatch[1].toLowerCase()];
    }

    // Clean and extract terms
    const cleanQuery = query
      .replace(/\b(AND|OR|NOT)\b/gi, ' ')
      .replace(/\bin\s+(human|mouse|zebrafish)/gi, '')
      .replace(/\b(genes?|gene)\b/gi, '')
      .trim();

    if (cleanQuery) {
      parsed.terms = cleanQuery.split(/\s+/).filter(t => t.length > 2);
    }

    return parsed;
  }

  /**
   * Build query string from parsed components
   */
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
   * Complex search with safe MCP handling
   */
  async complexSearch(query, limit = 10) {
    try {
      const parsed = this.parseComplexQuery(query);
      const searchQuery = this.buildQuery(parsed);

      const params = {
        q: searchQuery,
        category: 'gene',
        limit: Math.min(limit, 20) // Keep results small for MCP
      };

      if (parsed.species) {
        params.species = parsed.species;
      }

      const response = await this.request('/search', params);

      // Return MCP-safe simplified structure
      return {
        query,
        searchQuery,
        total: response.total || 0,
        results: (response.results || []).slice(0, limit).map(gene => ({
          symbol: gene.symbol || 'Unknown',
          name: gene.name || 'Unknown',
          species: gene.species || 'Unknown',
          id: gene.id || gene.primaryKey,
          score: Math.round(gene.score || 0)
        })),
        operators: parsed.operators,
        species: parsed.species
      };
    } catch (error) {
      return {
        error: error.message,
        query
      };
    }
  }

  async searchGenes(query, limit = 20) {
    const response = await this.request('/search', {
      q: query,
      category: 'gene',
      limit: Math.min(limit, 100)
    });

    return {
      total: response.total || 0,
      results: (response.results || []).slice(0, limit).map(gene => ({
        symbol: gene.symbol,
        name: gene.name,
        species: gene.species,
        id: gene.id || gene.primaryKey
      }))
    };
  }

  async getGeneInfo(geneId) {
    return this.request(`/gene/${encodeURIComponent(geneId)}`);
  }

  async getGeneDiseases(geneId) {
    return this.request(`/gene/${encodeURIComponent(geneId)}/diseases`);
  }

  async getGeneExpression(geneId) {
    return this.request(`/gene/${encodeURIComponent(geneId)}/expression`);
  }

  async findOrthologs(geneId) {
    return this.request(`/gene/${encodeURIComponent(geneId)}/orthologs`);
  }

  async getSpeciesList() {
    return this.request('/species');
  }
}

// Initialize client
const agrClient = new SimpleAGRClient();

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

// Define tools
const TOOLS = [
  {
    name: 'search_genes',
    description: 'Search for genes by symbol or name',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gene symbol or name to search for'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results (default: 20)',
          default: 20
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_gene_info',
    description: 'Get detailed information about a gene',
    inputSchema: {
      type: 'object',
      properties: {
        gene_id: {
          type: 'string',
          description: 'Gene identifier (e.g., HGNC:1100)'
        }
      },
      required: ['gene_id']
    }
  },
  {
    name: 'get_gene_diseases',
    description: 'Get disease associations for a gene',
    inputSchema: {
      type: 'object',
      properties: {
        gene_id: {
          type: 'string',
          description: 'Gene identifier'
        }
      },
      required: ['gene_id']
    }
  },
  {
    name: 'get_gene_expression',
    description: 'Get gene expression data',
    inputSchema: {
      type: 'object',
      properties: {
        gene_id: {
          type: 'string',
          description: 'Gene identifier'
        }
      },
      required: ['gene_id']
    }
  },
  {
    name: 'find_orthologs',
    description: 'Find orthologous genes across species',
    inputSchema: {
      type: 'object',
      properties: {
        gene_id: {
          type: 'string',
          description: 'Gene identifier'
        }
      },
      required: ['gene_id']
    }
  },
  {
    name: 'complex_search',
    description: 'Execute complex queries with Boolean operators (AND, OR, NOT)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Complex query like "breast cancer AND DNA repair NOT p53"'
        },
        limit: {
          type: 'integer',
          default: 10,
          description: 'Maximum results'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_species_list',
    description: 'Get list of supported species',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'search_genes':
        result = await agrClient.searchGenes(args.query, args.limit);
        break;

      case 'complex_search':
        result = await agrClient.complexSearch(args.query, args.limit);
        break;

      case 'get_gene_info':
        result = await agrClient.getGeneInfo(args.gene_id);
        break;

      case 'get_gene_diseases':
        result = await agrClient.getGeneDiseases(args.gene_id);
        break;

      case 'get_gene_expression':
        result = await agrClient.getGeneExpression(args.gene_id);
        break;

      case 'find_orthologs':
        result = await agrClient.findOrthologs(args.gene_id);
        break;

      case 'get_species_list':
        result = await agrClient.getSpeciesList();
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

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
            tool: name
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
