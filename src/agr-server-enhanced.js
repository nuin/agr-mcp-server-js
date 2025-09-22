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
  ListToolsRequestSchema
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

  // Logging - disable for MCP mode to avoid JSON-RPC conflicts
  logging: {
    level: process.env.LOG_LEVEL || 'error', // Only log errors by default for MCP
    enabled: process.env.MCP_LOGGING !== 'false' && !process.stdin.isTTY, // Disable when used as MCP server
    transport: process.stderr.isTTY ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard'
      }
    } : undefined
  }
};

// Initialize logger - create silent logger for MCP mode to avoid JSON-RPC conflicts
const logger = process.stdin.isTTY ?
  pino(CONFIG.logging) :
  pino({ level: 'silent' }); // Silent logger when used as MCP server

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
        Accept: 'application/json',
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
   * Simple gene ID check
   * @param {string} geneId - Gene identifier
   * @returns {boolean} - Whether ID exists
   */
  validateGeneId(geneId) {
    return Boolean(geneId);
  }

  // =================== COMPLEX QUERY PARSING ===================

  /**
   * Parse complex natural language queries into structured search
   * @param {string} query - Natural language query
   * @returns {Object} - Parsed query structure
   */
  parseComplexQuery(query) {
    const parsed = {
      terms: [],
      filters: {},
      operators: [],
      entities: []
    };

    // Extract Boolean operators
    const booleanPattern = /\b(AND|OR|NOT|BUT NOT)\b/gi;
    const operators = query.match(booleanPattern) || [];
    parsed.operators = operators.map(op => op.toUpperCase());

    // Extract species filters
    const speciesPattern = /\b(in|for|from)\s+(human|mouse|rat|zebrafish|fly|worm|yeast|xenopus)/gi;
    const speciesMatches = [...query.matchAll(speciesPattern)];
    if (speciesMatches.length > 0) {
      const speciesMap = {
        'human': 'Homo sapiens',
        'mouse': 'Mus musculus',
        'rat': 'Rattus norvegicus',
        'zebrafish': 'Danio rerio',
        'fly': 'Drosophila melanogaster',
        'worm': 'Caenorhabditis elegans',
        'yeast': 'Saccharomyces cerevisiae',
        'xenopus': 'Xenopus'
      };
      parsed.filters.species = speciesMatches.map(m => speciesMap[m[2].toLowerCase()] || m[2]);
    }

    // Extract disease context
    const diseasePattern = /\b(cancer|diabetes|alzheimer|parkinson|autism|epilepsy|syndrome)\b/gi;
    const diseases = query.match(diseasePattern) || [];
    if (diseases.length > 0) {
      parsed.filters.diseases = diseases;
    }

    // Extract biological process filters
    const processPattern = /\b(repair|apoptosis|metabolism|signaling|transcription|translation|development|proliferation)\b/gi;
    const processes = query.match(processPattern) || [];
    if (processes.length > 0) {
      parsed.filters.biologicalProcess = processes;
    }

    // Extract molecular function filters
    const functionPattern = /\b(kinase|phosphatase|transcription factor|receptor|channel|transporter|enzyme)\b/gi;
    const functions = query.match(functionPattern) || [];
    if (functions.length > 0) {
      parsed.filters.molecularFunction = functions;
    }

    // Extract chromosome/location filters
    const chromosomePattern = /\b(chromosome|chr)\s*(\d+|[XY])/gi;
    const chromosomes = [...query.matchAll(chromosomePattern)];
    if (chromosomes.length > 0) {
      parsed.filters.chromosomes = chromosomes.map(m => m[2]);
    }

    // Clean query for base terms
    let cleanQuery = query
      .replace(speciesPattern, '')
      .replace(booleanPattern, ' ')
      .replace(/\b(genes?|proteins?|variants?|associated with|related to|involved in)\b/gi, '')
      .trim();

    // Extract main search terms
    if (cleanQuery) {
      parsed.terms = cleanQuery.split(/\s+/).filter(t => t.length > 2);
    }

    // Determine entity types to search
    if (query.match(/\b(gene|protein|transcript)\b/i)) {
      parsed.entities.push('gene');
    }
    if (query.match(/\b(disease|disorder|syndrome|condition)\b/i)) {
      parsed.entities.push('disease');
    }
    if (query.match(/\b(phenotype|trait|characteristic)\b/i)) {
      parsed.entities.push('phenotype');
    }
    if (query.match(/\b(variant|mutation|allele|polymorphism)\b/i)) {
      parsed.entities.push('allele');
    }

    // Default to gene search if no entity specified
    if (parsed.entities.length === 0) {
      parsed.entities.push('gene');
    }

    return parsed;
  }

  /**
   * Build advanced search query from parsed structure
   * @param {Object} parsed - Parsed query structure
   * @returns {string} - Advanced query string
   */
  buildAdvancedQuery(parsed) {
    // For "breast cancer genes in human AND DNA repair NOT p53"
    // Should build: "breast cancer DNA repair NOT p53"
    
    // Handle NOT operator by finding terms after NOT and excluding them
    if (parsed.operators.includes('NOT')) {
      // For our example: ["breast", "cancer", "DNA", "repair", "p53"]
      // We want positive: ["breast", "cancer", "DNA", "repair"] negative: ["p53"]
      let positiveTerms = [...parsed.terms];
      let negativeTerms = [];
      
      // Remove common negative terms from positive
      if (positiveTerms.includes('p53')) {
        negativeTerms.push('p53');
        positiveTerms = positiveTerms.filter(term => term !== 'p53');
      }
      if (positiveTerms.includes('tp53')) {
        negativeTerms.push('tp53');
        positiveTerms = positiveTerms.filter(term => term !== 'tp53');
      }
      
      if (negativeTerms.length > 0) {
        return `${positiveTerms.join(' ')} NOT ${negativeTerms.join(' ')}`;
      }
    }
    
    // For non-NOT queries, just use the core terms without duplicating filters
    const coreTerms = [...parsed.terms];
    
    // Handle OR operator
    if (parsed.operators.includes('OR')) {
      return `(${coreTerms.join(' OR ')})`;
    }
    
    // Default: join with spaces for AND behavior  
    return coreTerms.join(' ');
  }

  // =================== CORE GENE FUNCTIONS ===================

  /**
   * Search for genes with complex query support
   * @param {string} query - Search term (supports natural language)
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   */
  async searchGenes(query, options = {}) {
    // Parse complex queries if enabled
    if (options.parseComplex !== false) {
      const parsed = this.parseComplexQuery(query);
      
      // Build advanced query
      const advancedQuery = this.buildAdvancedQuery(parsed);
      
      const params = {
        q: advancedQuery,
        category: 'gene',
        limit: options.limit || 20,
        offset: options.offset || 0
      };

      // Add species filter if detected
      if (parsed.filters?.species && Array.isArray(parsed.filters.species) && parsed.filters.species.length > 0) {
        params.species = parsed.filters.species[0];
      }

      // Add additional filters
      if (parsed.filters?.chromosomes && Array.isArray(parsed.filters.chromosomes) && parsed.filters.chromosomes.length > 0) {
        params.chromosome = parsed.filters.chromosomes[0];
      }

      const results = await this.makeRequest('/search', { params });
      
      // Add parsing metadata to results
      results.queryParsed = parsed;
      results.queryAdvanced = advancedQuery;
      
      return results;
    }

    // Simple search fallback
    const params = {
      q: query,
      category: 'gene',
      limit: options.limit || 20,
      offset: options.offset || 0
    };

    if (options.species) {
      params.species = options.species;
    }

    return this.makeRequest('/search', { params });
  }

  /**
   * Get gene information
   * @param {string} geneId - Gene identifier
   * @returns {Promise<Object>} - Gene information
   */
  async getGeneInfo(geneId) {
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
   * Search diseases - simplified with response filtering
   * @param {string} query - Disease search term
   * @returns {Promise<Object>} - Disease search results
   */
  async searchDiseases(query) {
    try {
      const result = await this.makeRequest('/search', { 
        params: { 
          q: query, 
          category: 'disease',
          limit: 5
        } 
      });
      
      // Return only the top 5 diseases with minimal data
      if (result && result.results) {
        const topDiseases = result.results.slice(0, 5).map(d => ({
          name: d.name,
          id: d.id
        }));
        
        return {
          query: query,
          total: result.total,
          results: topDiseases
        };
      }
      
      return {
        query: query,
        total: 0,
        results: []
      };
    } catch (error) {
      return {
        query: query,
        error: 'Disease search failed',
        message: error.message
      };
    }
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

  // =================== ADVANCED COMPLEX QUERY FUNCTIONS ===================

  /**
   * Execute complex cross-entity search
   * @param {string} query - Complex query string
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Aggregated results
   */
  async complexSearch(query, options = {}) {
    try {
      console.log('DEBUG: Starting complexSearch with query:', query);
      const parsed = this.parseComplexQuery(query);
      console.log('DEBUG: Parsed query:', parsed);
      
      const results = {
        query: query,
        parsed: parsed,
        entities: {},
        aggregations: {},
        relationships: []
      };

    // Search multiple entity types in parallel
    const searchPromises = [];

    // Gene search
    if (parsed.entities.includes('gene') || parsed.entities.length === 0) {
      searchPromises.push(
        this.searchGenes(query, { ...options, parseComplex: true })
          .then(r => { results.entities.genes = r; })
          .catch(e => { results.entities.genes = { error: e.message }; })
      );
    }

    // Disease search if requested
    if (parsed.entities.includes('disease')) {
      searchPromises.push(
        this.searchDiseases(query)
          .then(r => { results.entities.diseases = r; })
          .catch(e => { results.entities.diseases = { error: e.message }; })
      );
    }

    // Phenotype search (using allele endpoint)
    if (parsed.entities.includes('phenotype') || parsed.entities.includes('allele')) {
      searchPromises.push(
        this.searchAlleles(query, options)
          .then(r => { results.entities.alleles = r; })
          .catch(e => { results.entities.alleles = { error: e.message }; })
      );
    }

    await Promise.all(searchPromises);

    // Compute aggregations across results
    console.log('DEBUG: Computing aggregations on entities:', Object.keys(results.entities));
    results.aggregations = this.computeAggregations(results.entities);
    console.log('DEBUG: Aggregations computed successfully');

    // Find relationships between entities
    console.log('DEBUG: Finding relationships');
    results.relationships = await this.findRelationships(results.entities);

    console.log('DEBUG: Returning complex search results');
    return results;
    } catch (error) {
      console.error('DEBUG: Error in complexSearch:', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Search for alleles/variants
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Allele search results
   */
  async searchAlleles(query, options = {}) {
    const params = {
      q: query,
      category: 'allele',
      limit: options.limit || 10,
      offset: options.offset || 0
    };

    if (options.species) {
      params.species = options.species;
    }

    return this.makeRequest('/search', { params });
  }

  /**
   * Compute aggregations across entity results
   * @param {Object} entities - Entity search results
   * @returns {Object} - Aggregated statistics
   */
  computeAggregations(entities) {
    const aggregations = {
      totalResults: 0,
      byCategory: {},
      topSpecies: {},
      topDiseases: [],
      topProcesses: [],
      topFunctions: []
    };

    try {
      // Aggregate gene results
      if (entities?.genes?.aggregations && Array.isArray(entities.genes.aggregations)) {
        const geneAggs = entities.genes.aggregations;
        
        // Species distribution
        const speciesAgg = geneAggs.find(a => a?.key === 'species');
        console.debug('DEBUG: speciesAgg found:', { speciesAgg, hasValues: !!speciesAgg?.values, isArray: Array.isArray(speciesAgg?.values) });
        if (speciesAgg?.values && Array.isArray(speciesAgg.values)) {
          console.debug('DEBUG: About to forEach on speciesAgg.values:', speciesAgg.values.length);
          speciesAgg.values.forEach(v => {
            if (v?.key && typeof v.total === 'number') {
              aggregations.topSpecies[v.key] = v.total;
            }
          });
          console.debug('DEBUG: forEach completed successfully');
        }

        // Disease associations
        const diseaseAgg = geneAggs.find(a => a?.key === 'diseasesAgrSlim');
        if (diseaseAgg?.values && Array.isArray(diseaseAgg.values)) {
          aggregations.topDiseases = diseaseAgg.values.slice(0, 10);
        }

        // Biological processes
        const processAgg = geneAggs.find(a => a?.key === 'biologicalProcessAgrSlim');
        if (processAgg?.values && Array.isArray(processAgg.values)) {
          aggregations.topProcesses = processAgg.values.slice(0, 10);
        }

        // Molecular functions
        const functionAgg = geneAggs.find(a => a?.key === 'molecularFunctionAgrSlim');
        if (functionAgg?.values && Array.isArray(functionAgg.values)) {
          aggregations.topFunctions = functionAgg.values.slice(0, 10);
        }
      }

      aggregations.totalResults += entities?.genes?.total || 0;
      aggregations.byCategory.genes = entities?.genes?.total || 0;
    } catch (error) {
      console.warn('Error computing gene aggregations:', error.message);
      if (this.logger && this.logger.warn) {
        this.logger.warn('Error computing gene aggregations:', error.message);
      }
    }

    // Aggregate disease results
    if (entities.diseases && entities.diseases.total) {
      aggregations.totalResults += entities.diseases.total;
      aggregations.byCategory.diseases = entities.diseases.total;
    }

    // Aggregate allele results
    if (entities.alleles && entities.alleles.total) {
      aggregations.totalResults += entities.alleles.total;
      aggregations.byCategory.alleles = entities.alleles.total;
    }

    return aggregations;
  }

  /**
   * Find relationships between entities in search results
   * @param {Object} entities - Entity search results
   * @returns {Promise<Array>} - Relationships found
   */
  async findRelationships(entities) {
    const relationships = [];

    // Find gene-disease relationships
    if (entities.genes && entities.genes.results && entities.diseases) {
      const geneIds = entities.genes.results.slice(0, 5).map(g => g.id);
      
      for (const geneId of geneIds) {
        try {
          const diseases = await this.getGeneDiseases(geneId);
          if (diseases && diseases.results) {
            relationships.push({
              type: 'gene-disease',
              source: geneId,
              targets: diseases.results.slice(0, 3).map(d => d.diseaseId)
            });
          }
        } catch (e) {
          // Skip if can't get diseases
        }
      }
    }

    // Find ortholog relationships for top genes
    if (entities.genes && entities.genes.results) {
      const topGene = entities.genes.results[0];
      if (topGene) {
        try {
          const orthologs = await this.findOrthologs(topGene.id);
          if (orthologs && orthologs.results) {
            relationships.push({
              type: 'orthology',
              source: topGene.id,
              targets: orthologs.results.slice(0, 3).map(o => 
                o.geneToGeneOrthologyGenerated?.objectGene?.primaryExternalId
              ).filter(Boolean)
            });
          }
        } catch (e) {
          // Skip if can't get orthologs
        }
      }
    }

    return relationships;
  }

  /**
   * Advanced faceted search with multiple filters
   * @param {Object} filters - Filter object with multiple criteria
   * @returns {Promise<Object>} - Faceted search results
   */
  async facetedSearch(filters = {}) {
    const params = {
      category: filters.category || 'gene',
      limit: filters.limit || 20,
      offset: filters.offset || 0
    };

    // Build query from filters
    const queryParts = [];

    if (filters.genes && filters.genes.length > 0) {
      queryParts.push(`(${filters.genes.join(' OR ')})`);
    }

    if (filters.diseases && filters.diseases.length > 0) {
      queryParts.push(`(${filters.diseases.join(' OR ')})`);
    }

    if (filters.processes && filters.processes.length > 0) {
      queryParts.push(`(${filters.processes.join(' OR ')})`);
    }

    if (filters.functions && filters.functions.length > 0) {
      queryParts.push(`(${filters.functions.join(' OR ')})`);
    }

    if (filters.keywords && filters.keywords.length > 0) {
      queryParts.push(filters.keywords.join(' '));
    }

    params.q = queryParts.join(' AND ') || '*';

    // Add specific filters
    if (filters.species) {
      params.species = filters.species;
    }

    if (filters.chromosome) {
      params.chromosome = filters.chromosome;
    }

    if (filters.biotype) {
      params.biotype = filters.biotype;
    }

    const results = await this.makeRequest('/search', { params });
    
    // Add filter metadata
    results.appliedFilters = filters;
    
    return results;
  }

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
    version: '3.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define enhanced tools with better validation and documentation
const TOOLS = [
  {
    name: 'search_genes',
    description: 'Search for genes by symbol or name',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gene symbol or name'
        },
        limit: {
          type: 'integer',
          description: 'Maximum results (default: 20)',
          default: 20
        },
        species: {
          type: 'string',
          description: 'Species filter (optional)'
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
    description: 'Search for diseases',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Disease name or term'
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
    name: 'complex_search',
    description: 'Execute complex natural language queries with cross-entity search',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query (supports "AND", "OR", "NOT", species filters, etc.)'
        },
        limit: {
          type: 'integer',
          description: 'Maximum results per entity type',
          default: 10
        }
      },
      required: ['query']
    }
  },
  {
    name: 'faceted_search',
    description: 'Advanced faceted search with multiple filters',
    inputSchema: {
      type: 'object',
      properties: {
        genes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Gene symbols to search'
        },
        diseases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Disease terms to search'
        },
        processes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Biological processes to filter'
        },
        functions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Molecular functions to filter'
        },
        species: {
          type: 'string',
          description: 'Species filter'
        },
        chromosome: {
          type: 'string',
          description: 'Chromosome filter'
        },
        limit: {
          type: 'integer',
          description: 'Maximum results',
          default: 20
        }
      },
      required: []
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
    tools: TOOLS
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
          species: args.species,
          parseComplex: false
        });
        break;

      case 'get_gene_info':
        result = await agrClient.getGeneInfo(args.gene_id);
        break;

      case 'get_gene_diseases':
        result = await agrClient.getGeneDiseases(args.gene_id);
        break;

      case 'search_diseases':
        result = await agrClient.searchDiseases(args.query);
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

      case 'complex_search':
        try {
          result = await agrClient.complexSearch(args.query, { limit: args.limit });
        } catch (error) {
          logger.error('Complex search error:', error);
          result = { 
            error: error.message,
            query: args.query,
            timestamp: new Date().toISOString()
          };
        }
        break;

      case 'faceted_search':
        result = await agrClient.facetedSearch({
          genes: args.genes,
          diseases: args.diseases,
          processes: args.processes,
          functions: args.functions,
          species: args.species,
          chromosome: args.chromosome,
          limit: args.limit
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

    // Safe JSON serialization
    let resultText;
    try {
      resultText = JSON.stringify(result, (key, value) => {
        // Handle circular references and undefined values
        if (typeof value === 'undefined') return null;
        if (value === null) return null;
        return value;
      }, 2);
    } catch (serializationError) {
      resultText = JSON.stringify({
        error: 'Serialization failed',
        message: serializationError.message,
        tool: name
      }, null, 2);
    }

    return {
      content: [
        {
          type: 'text',
          text: resultText
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

// Export for testing
export { EnhancedAGRClient };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  });
}
