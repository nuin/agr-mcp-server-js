#!/usr/bin/env node

/**
 * Enhanced Alliance of Genome Resources (AGR) MCP Server - JavaScript Implementation
 * 
 * A high-performance, modern JavaScript implementation of the AGR MCP server
 * with enhanced features, better error handling, caching, and TypeScript-style documentation.
 * 
 * Improvements over Python version:
 * - Modern async/await with better error handling
 * - Intelligent caching system for API responses
 * - Rate limiting and connection pooling
 * - Enhanced logging with structured output
 * - Flexible configuration system
 * - Better input validation
 * - Performance optimizations
 * - TypeScript-style JSDoc documentation
 * 
 * @author Genomics Team
 * @version 3.0.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import NodeCache from 'node-cache';
import pino from 'pino';

// Enhanced configuration
const CONFIG = {
  // API endpoints
  endpoints: {
    base: 'https://www.alliancegenome.org/api',
    blast: 'https://blast.alliancegenome.org',
    fms: 'https://fms.alliancegenome.org/api',
    jbrowse: 'https://jbrowse.alliancegenome.org',
    textpresso: 'https://textpresso.alliancegenome.org',
    alliancemine: 'https://www.alliancegenome.org/alliancemine'
  },
  
  // Performance settings
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  
  // Caching configuration
  cache: {
    ttl: 300, // 5 minutes default TTL
    checkperiod: 60, // Check for expired keys every minute
    maxKeys: 1000,
    useClones: false // Better performance for read-heavy operations
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard'
      }
    }
  }
};

// Initialize logger
const logger = pino(CONFIG.logging);

// Initialize cache
const cache = new NodeCache(CONFIG.cache);

// Rate limiting map
const rateLimitMap = new Map();

/**
 * Enhanced AGR Client with caching, rate limiting, and robust error handling
 */
class EnhancedAGRClient {
  constructor() {
    // Create axios instance with optimized settings
    this.client = axios.create({
      timeout: CONFIG.timeout,
      headers: {
        'User-Agent': 'AGR-MCP-Server-JS/3.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Connection pooling
      maxRedirects: 3,
      validateStatus: (status) => status < 500 // Only retry on 5xx errors
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({ url: config.url, method: config.method }, 'Making API request');
        return config;
      },
      (error) => {
        logger.error({ error: error.message }, 'Request interceptor error');
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug({ 
          url: response.config.url, 
          status: response.status, 
          size: JSON.stringify(response.data).length 
        }, 'API response received');
        return response;
      },
      (error) => {
        logger.error({ 
          url: error.config?.url,
          status: error.response?.status,
          message: error.message 
        }, 'API request failed');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check rate limit for API calls
   * @param {string} endpoint - The endpoint being called
   * @returns {boolean} - Whether the request is within rate limits
   */
  checkRateLimit(endpoint) {
    const now = Date.now();
    const windowStart = now - CONFIG.rateLimit.windowMs;
    
    if (!rateLimitMap.has(endpoint)) {
      rateLimitMap.set(endpoint, []);
    }
    
    const requests = rateLimitMap.get(endpoint);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= CONFIG.rateLimit.maxRequests) {
      logger.warn({ endpoint }, 'Rate limit exceeded');
      return false;
    }
    
    validRequests.push(now);
    rateLimitMap.set(endpoint, validRequests);
    return true;
  }

  /**
   * Make HTTP request with caching, retry logic, and rate limiting
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - API response data
   */
  async makeRequest(endpoint, options = {}) {
    const {
      params = {},
      baseURL = CONFIG.endpoints.base,
      method = 'GET',
      cacheKey = null,
      cacheTTL = CONFIG.cache.ttl
    } = options;

    // Generate cache key if not provided
    const finalCacheKey = cacheKey || `${method}:${baseURL}${endpoint}:${JSON.stringify(params)}`;
    
    // Check cache first
    if (method === 'GET') {
      const cachedResult = cache.get(finalCacheKey);
      if (cachedResult) {
        logger.debug({ cacheKey: finalCacheKey }, 'Cache hit');
        return cachedResult;
      }
    }

    // Check rate limit
    if (!this.checkRateLimit(endpoint)) {
      throw new Error(`Rate limit exceeded for endpoint: ${endpoint}`);
    }

    const url = `${baseURL}/${endpoint.replace(/^\//, '')}`;
    
    let lastError;
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        const response = await this.client({
          method,
          url,
          params: method === 'GET' ? params : undefined,
          data: method !== 'GET' ? params : undefined
        });

        const data = response.data;
        
        // Cache successful GET requests
        if (method === 'GET' && data) {
          cache.set(finalCacheKey, data, cacheTTL);
          logger.debug({ cacheKey: finalCacheKey, ttl: cacheTTL }, 'Cached response');
        }

        return data;
      } catch (error) {
        lastError = error;
        
        if (attempt < CONFIG.maxRetries && error.response?.status >= 500) {
          const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          logger.warn({ 
            attempt, 
            delay, 
            error: error.message 
          }, `Retrying request in ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        break;
      }
    }

    // Handle different types of errors
    if (lastError.response) {
      const { status, statusText, data } = lastError.response;
      throw new Error(`API Error ${status} (${statusText}): ${data?.message || 'Unknown error'}`);
    } else if (lastError.code === 'ECONNABORTED') {
      throw new Error(`Request timeout after ${CONFIG.timeout}ms`);
    } else {
      throw new Error(`Network error: ${lastError.message}`);
    }
  }

  /**
   * Validate gene identifier format
   * @param {string} geneId - Gene identifier to validate
   * @returns {boolean} - Whether the identifier is valid
   */
  validateGeneId(geneId) {
    if (!geneId || typeof geneId !== 'string') return false;
    
    // Common gene ID patterns
    const patterns = [
      /^HGNC:\d+$/, // Human
      /^MGI:\d+$/, // Mouse
      /^RGD:\d+$/, // Rat
      /^ZFIN:ZDB-GENE-\d+-\d+$/, // Zebrafish
      /^FB\w+$/, // FlyBase
      /^WB\w+$/, // WormBase
      /^SGD:S\d+$/ // Yeast
    ];
    
    return patterns.some(pattern => pattern.test(geneId));
  }

  /**
   * Validate and sanitize search query
   * @param {string} query - Search query
   * @returns {string} - Sanitized query
   */
  sanitizeQuery(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }
    
    // Remove potentially harmful characters but keep scientific notation
    return query
      .trim()
      .replace(/[<>]/g, '') // Remove HTML-like brackets
      .substring(0, 500); // Limit length
  }

  // =================== CORE GENE FUNCTIONS ===================
  
  /**
   * Search for genes with enhanced filtering and validation
   * @param {string} query - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   */
  async searchGenes(query, options = {}) {
    const sanitizedQuery = this.sanitizeQuery(query);
    const {
      category = 'gene',
      limit = 20,
      offset = 0,
      species = null
    } = options;

    const params = {
      q: sanitizedQuery,
      category,
      limit: Math.min(limit, 100), // Cap at 100
      offset: Math.max(offset, 0) // Ensure non-negative
    };

    if (species) {
      params.species = species;
    }

    return this.makeRequest('/search', { params });
  }

  /**
   * Get comprehensive gene information
   * @param {string} geneId - Gene identifier
   * @returns {Promise<Object>} - Gene information
   */
  async getGeneInfo(geneId) {
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID format: ${geneId}`);
    }
    
    return this.makeRequest(`/gene/${encodeURIComponent(geneId)}`);
  }

  /**
   * Get gene summary with enhanced caching
   * @param {string} geneId - Gene identifier
   * @returns {Promise<Object>} - Gene summary
   */
  async getGeneSummary(geneId) {
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID format: ${geneId}`);
    }
    
    return this.makeRequest(`/gene/${encodeURIComponent(geneId)}/summary`, {
      cacheTTL: 600 // Cache summaries longer (10 minutes)
    });
  }

  // =================== DISEASE FUNCTIONS ===================
  
  /**
   * Get disease associations for a gene
   * @param {string} geneId - Gene identifier
   * @returns {Promise<Object>} - Disease associations
   */
  async getGeneDiseases(geneId) {
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID format: ${geneId}`);
    }
    
    return this.makeRequest(`/gene/${encodeURIComponent(geneId)}/diseases`);
  }

  /**
   * Search diseases with enhanced filtering
   * @param {string} query - Disease search term
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Disease search results
   */
  async searchDiseases(query, options = {}) {
    const sanitizedQuery = this.sanitizeQuery(query);
    const { limit = 20 } = options;

    const params = {
      q: sanitizedQuery,
      category: 'disease',
      limit: Math.min(limit, 100)
    };

    return this.makeRequest('/search', { params });
  }

  // =================== EXPRESSION FUNCTIONS ===================
  
  /**
   * Get gene expression data
   * @param {string} geneId - Gene identifier
   * @returns {Promise<Object>} - Expression data
   */
  async getGeneExpression(geneId) {
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID format: ${geneId}`);
    }
    
    return this.makeRequest(`/gene/${encodeURIComponent(geneId)}/expression`);
  }

  /**
   * Get expression ribbon summary for visualization
   * @param {string} geneId - Gene identifier
   * @returns {Promise<Object>} - Expression ribbon data
   */
  async getExpressionRibbonSummary(geneId) {
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID format: ${geneId}`);
    }
    
    return this.makeRequest(`/gene/${encodeURIComponent(geneId)}/expression-ribbon-summary`);
  }

  // =================== ORTHOLOGY FUNCTIONS ===================
  
  /**
   * Find orthologous genes across species
   * @param {string} geneId - Gene identifier
   * @returns {Promise<Object>} - Ortholog data
   */
  async findOrthologs(geneId) {
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID format: ${geneId}`);
    }
    
    return this.makeRequest(`/gene/${encodeURIComponent(geneId)}/orthologs`);
  }

  /**
   * Get homologs for a specific species
   * @param {string} geneId - Gene identifier
   * @param {string} species - Target species
   * @returns {Promise<Object>} - Species-specific homologs
   */
  async getHomologsBySpecies(geneId, species) {
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID format: ${geneId}`);
    }
    
    if (!species || typeof species !== 'string') {
      throw new Error('Species must be specified');
    }

    const params = { species: species.trim() };
    return this.makeRequest(`/gene/${encodeURIComponent(geneId)}/orthologs`, { params });
  }

  // =================== SEQUENCE FUNCTIONS ===================
  
  /**
   * Perform BLAST sequence search with validation
   * @param {string} sequence - DNA/RNA/Protein sequence
   * @param {Object} options - BLAST options
   * @returns {Promise<Object>} - BLAST results
   */
  async blastSequence(sequence, options = {}) {
    if (!sequence || typeof sequence !== 'string') {
      throw new Error('Sequence is required');
    }

    // Basic sequence validation
    const cleanSequence = sequence.replace(/\s/g, '').toUpperCase();
    if (cleanSequence.length < 10) {
      throw new Error('Sequence must be at least 10 nucleotides/amino acids');
    }

    // Validate sequence characters
    const dnaPattern = /^[ATCGN]+$/;
    const proteinPattern = /^[ACDEFGHIKLMNPQRSTVWY]+$/;
    
    if (!dnaPattern.test(cleanSequence) && !proteinPattern.test(cleanSequence)) {
      throw new Error('Sequence contains invalid characters');
    }

    const {
      database = 'all',
      program = dnaPattern.test(cleanSequence) ? 'blastn' : 'blastp',
      maxTargetSeqs = 50
    } = options;

    const params = {
      sequence: cleanSequence,
      database,
      program,
      max_target_seqs: Math.min(maxTargetSeqs, 100)
    };

    return this.makeRequest('/blast', {
      params,
      baseURL: CONFIG.endpoints.blast,
      cacheTTL: 900 // Cache BLAST results for 15 minutes
    });
  }

  // =================== UTILITY FUNCTIONS ===================
  
  /**
   * Get list of supported species
   * @returns {Promise<Object>} - Species list
   */
  async getSpeciesList() {
    return this.makeRequest('/species', {
      cacheTTL: 3600 // Cache species list for 1 hour
    });
  }

  /**
   * Clear cache (useful for development/testing)
   * @param {string} pattern - Optional pattern to match keys
   */
  clearCache(pattern = null) {
    if (pattern) {
      const keys = cache.keys().filter(key => key.includes(pattern));
      cache.del(keys);
      logger.info({ pattern, keysCleared: keys.length }, 'Partial cache cleared');
    } else {
      cache.flushAll();
      logger.info('Cache cleared completely');
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getCacheStats() {
    return {
      keys: cache.keys().length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses,
      ksize: cache.getStats().ksize,
      vsize: cache.getStats().vsize
    };
  }
}

// Initialize the enhanced AGR client
const agrClient = new EnhancedAGRClient();

// Create the MCP server
const server = new Server(
  {
    name: 'agr-genomics-enhanced-js',
    version: '3.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define enhanced tools with better validation and documentation
const TOOLS = [
  {
    name: 'search_genes',
    description: 'Search for genes by symbol, name, or identifier across model organisms with enhanced filtering',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gene symbol, name, or identifier (max 500 chars)'
        },
        limit: {
          type: 'integer',
          description: 'Maximum results (1-100, default: 20)',
          minimum: 1,
          maximum: 100,
          default: 20
        },
        offset: {
          type: 'integer',
          description: 'Results to skip (default: 0)',
          minimum: 0,
          default: 0
        },
        species: {
          type: 'string',
          description: 'Optional species filter'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_gene_info',
    description: 'Retrieve comprehensive gene information with validation',
    inputSchema: {
      type: 'object',
      properties: {
        gene_id: {
          type: 'string',
          description: 'Valid gene identifier (e.g., HGNC:5, MGI:95892)'
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
    name: 'search_diseases',
    description: 'Search for diseases and conditions',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Disease name or term'
        },
        limit: {
          type: 'integer',
          description: 'Maximum results (1-100, default: 20)',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_gene_expression',
    description: 'Get comprehensive gene expression data',
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
    description: 'Find orthologous genes across all species',
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
    name: 'blast_sequence',
    description: 'Perform BLAST sequence search with validation',
    inputSchema: {
      type: 'object',
      properties: {
        sequence: {
          type: 'string',
          description: 'DNA, RNA, or protein sequence (min 10 chars)'
        },
        database: {
          type: 'string',
          description: 'Target database (default: all)',
          default: 'all'
        },
        program: {
          type: 'string',
          description: 'BLAST program (auto-detected if not specified)'
        },
        max_target_seqs: {
          type: 'integer',
          description: 'Maximum targets (1-100, default: 50)',
          minimum: 1,
          maximum: 100,
          default: 50
        }
      },
      required: ['sequence']
    }
  },
  {
    name: 'get_species_list',
    description: 'Get list of all supported model organisms',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_cache_stats',
    description: 'Get performance statistics and cache information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'clear_cache',
    description: 'Clear cache (development/testing tool)',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Optional pattern to match specific cache keys'
        }
      },
      required: []
    }
  }
];

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Enhanced tool call handler with better error handling
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    logger.info({ tool: name, args }, 'Executing tool');
    const startTime = Date.now();
    
    let result;
    
    switch (name) {
      case 'search_genes':
        result = await agrClient.searchGenes(args.query, {
          limit: args.limit,
          offset: args.offset,
          species: args.species
        });
        break;
        
      case 'get_gene_info':
        result = await agrClient.getGeneInfo(args.gene_id);
        break;
        
      case 'get_gene_diseases':
        result = await agrClient.getGeneDiseases(args.gene_id);
        break;
        
      case 'search_diseases':
        result = await agrClient.searchDiseases(args.query, {
          limit: args.limit
        });
        break;
        
      case 'get_gene_expression':
        result = await agrClient.getGeneExpression(args.gene_id);
        break;
        
      case 'find_orthologs':
        result = await agrClient.findOrthologs(args.gene_id);
        break;
        
      case 'blast_sequence':
        result = await agrClient.blastSequence(args.sequence, {
          database: args.database,
          program: args.program,
          maxTargetSeqs: args.max_target_seqs
        });
        break;
        
      case 'get_species_list':
        result = await agrClient.getSpeciesList();
        break;
        
      case 'get_cache_stats':
        result = {
          cache: agrClient.getCacheStats(),
          rateLimits: Object.fromEntries(rateLimitMap),
          uptime: process.uptime()
        };
        break;
        
      case 'clear_cache':
        agrClient.clearCache(args.pattern);
        result = { message: 'Cache cleared successfully' };
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    const duration = Date.now() - startTime;
    logger.info({ tool: name, duration }, 'Tool execution completed');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
    
  } catch (error) {
    logger.error({ tool: name, error: error.message }, 'Tool execution failed');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ]
    };
  }
});

// Enhanced server startup
async function main() {
  logger.info({
    version: '3.0.0',
    nodeVersion: process.version,
    platform: process.platform
  }, 'Starting Enhanced AGR MCP Server (JavaScript)');

  // Initialize cache cleanup
  setInterval(() => {
    const stats = agrClient.getCacheStats();
    logger.debug(stats, 'Cache statistics');
  }, 60000); // Log stats every minute

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info('Enhanced AGR MCP Server started successfully');
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  cache.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  cache.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  });
}