#!/usr/bin/env node

/**
 * Simple AGR MCP Server - Minimal Implementation
 * 
 * A streamlined MCP server for Alliance of Genome Resources with basic functionality
 */

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

  async searchGenes(query, limit = 20) {
    return this.request('/search', {
      q: query,
      category: 'gene',
      limit: Math.min(limit, 100)
    });
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
  console.log('Starting Simple AGR MCP Server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('Simple AGR MCP Server started');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}