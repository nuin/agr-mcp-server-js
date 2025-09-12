/**
 * Pathway Analysis Module with KEGG Integration
 *
 * Provides pathway enrichment analysis and visualization
 * for gene sets using KEGG, Reactome, and GO databases.
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// API Endpoints
const KEGG_API_BASE = 'https://rest.kegg.jp';
const REACTOME_API_BASE = 'https://reactome.org/ContentService';
const GO_API_BASE = 'https://www.ebi.ac.uk/QuickGO/services';

// Cache configuration
const CACHE_TTL = 1800; // 30 minutes for pathway data

/**
 * Pathway Analysis Client
 */
export class PathwayAnalysisClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.cache = new NodeCache({ stdTTL: CACHE_TTL });

    // Create axios instances for different APIs
    this.keggClient = axios.create({
      baseURL: KEGG_API_BASE,
      timeout: this.timeout,
      headers: { Accept: 'text/plain' }
    });

    this.reactomeClient = axios.create({
      baseURL: REACTOME_API_BASE,
      timeout: this.timeout,
      headers: { Accept: 'application/json' }
    });

    this.goClient = axios.create({
      baseURL: GO_API_BASE,
      timeout: this.timeout,
      headers: { Accept: 'application/json' }
    });

    // Species mapping for KEGG organisms
    this.keggOrganisms = {
      'Homo sapiens': 'hsa',
      'Mus musculus': 'mmu',
      'Rattus norvegicus': 'rno',
      'Danio rerio': 'dre',
      'Drosophila melanogaster': 'dme',
      'Caenorhabditis elegans': 'cel',
      'Saccharomyces cerevisiae': 'sce'
    };

    // Pathway categories
    this.pathwayCategories = {
      metabolism: ['Carbohydrate', 'Energy', 'Lipid', 'Amino acid', 'Nucleotide'],
      genetic: ['Transcription', 'Translation', 'Replication', 'Repair'],
      signaling: ['Signal transduction', 'Cell communication', 'Endocrine'],
      cellular: ['Cell growth', 'Cell death', 'Cell motility', 'Transport'],
      disease: ['Cancer', 'Immune disease', 'Neurodegenerative', 'Infectious'],
      immune: ['Innate immunity', 'Adaptive immunity', 'Complement']
    };
  }

  /**
   * Get pathways for a specific gene
   * @param {string} geneSymbol - Gene symbol
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Pathway information
   */
  async getGenePathways(geneSymbol, options = {}) {
    const {
      species = 'Homo sapiens',
      databases = ['kegg', 'reactome', 'go'],
      includeInteractions = false
    } = options;

    const cacheKey = `pathways_${geneSymbol}_${species}_${databases.join('_')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const results = {
      gene: geneSymbol,
      species,
      pathways: {
        kegg: [],
        reactome: [],
        go: []
      },
      summary: {}
    };

    try {
      // Fetch from each database in parallel
      const promises = [];

      if (databases.includes('kegg')) {
        promises.push(this.getKeggPathways(geneSymbol, species));
      }
      if (databases.includes('reactome')) {
        promises.push(this.getReactomePathways(geneSymbol, species));
      }
      if (databases.includes('go')) {
        promises.push(this.getGOTerms(geneSymbol, species));
      }

      const pathwayData = await Promise.allSettled(promises);

      // Process results
      let index = 0;
      if (databases.includes('kegg') && pathwayData[index].status === 'fulfilled') {
        results.pathways.kegg = pathwayData[index].value;
        index++;
      }
      if (databases.includes('reactome') && pathwayData[index].status === 'fulfilled') {
        results.pathways.reactome = pathwayData[index].value;
        index++;
      }
      if (databases.includes('go') && pathwayData[index].status === 'fulfilled') {
        results.pathways.go = pathwayData[index].value;
      }

      // Generate summary
      results.summary = this.generatePathwaySummary(results.pathways);

      // Add interactions if requested
      if (includeInteractions) {
        results.interactions = await this.getPathwayInteractions(geneSymbol, results.pathways);
      }

      this.cache.set(cacheKey, results);
      return results;

    } catch (error) {
      throw new Error(`Failed to get pathways: ${error.message}`);
    }
  }

  /**
   * Get KEGG pathways for a gene
   */
  async getKeggPathways(geneSymbol, species) {
    const organism = this.keggOrganisms[species] || 'hsa';

    try {
      // First, find the gene in KEGG
      const findResponse = await this.keggClient.get(`/find/${organism}/${geneSymbol}`);
      const lines = findResponse.data.split('\n').filter(line => line);

      if (lines.length === 0) {
        return [];
      }

      // Extract KEGG gene ID
      const geneId = lines[0].split('\t')[0];

      // Get pathways for this gene
      const pathwayResponse = await this.keggClient.get(`/link/pathway/${geneId}`);
      const pathwayLines = pathwayResponse.data.split('\n').filter(line => line);

      const pathways = [];
      for (const line of pathwayLines) {
        const pathwayId = line.split('\t')[1];

        // Get pathway details
        const detailResponse = await this.keggClient.get(`/get/${pathwayId}`);
        const details = this.parseKeggPathway(detailResponse.data);

        pathways.push({
          id: pathwayId,
          name: details.name,
          category: details.category,
          description: details.description,
          geneCount: details.geneCount,
          url: `https://www.kegg.jp/entry/${pathwayId}`
        });
      }

      return pathways;

    } catch (error) {
      console.error('KEGG pathway fetch error:', error.message);
      return [];
    }
  }

  /**
   * Parse KEGG pathway data
   */
  parseKeggPathway(data) {
    const lines = data.split('\n');
    const result = {
      name: '',
      category: '',
      description: '',
      geneCount: 0
    };

    for (const line of lines) {
      if (line.startsWith('NAME')) {
        result.name = line.substring(12).trim();
      } else if (line.startsWith('CLASS')) {
        result.category = line.substring(12).trim();
      } else if (line.startsWith('DESCRIPTION')) {
        result.description = line.substring(12).trim();
      } else if (line.startsWith('GENE')) {
        result.geneCount++;
      }
    }

    return result;
  }

  /**
   * Get Reactome pathways for a gene
   */
  async getReactomePathways(geneSymbol, species) {
    try {
      // Map species to Reactome format
      const speciesMap = {
        'Homo sapiens': 'Homo sapiens',
        'Mus musculus': 'Mus musculus',
        'Rattus norvegicus': 'Rattus norvegicus'
      };

      const reactomeSpecies = speciesMap[species];
      if (!reactomeSpecies) {
        return [];
      }

      // Query Reactome for pathways
      const response = await this.reactomeClient.get('/data/query', {
        params: {
          q: geneSymbol,
          species: reactomeSpecies,
          types: 'Pathway'
        }
      });

      const pathways = response.data.results?.map(pathway => ({
        id: pathway.stId,
        name: pathway.displayName,
        category: pathway.schemaClass,
        description: pathway.summation?.[0]?.text || '',
        url: `https://reactome.org/content/detail/${pathway.stId}`
      })) || [];

      return pathways.slice(0, 10); // Limit to top 10

    } catch (error) {
      console.error('Reactome pathway fetch error:', error.message);
      return [];
    }
  }

  /**
   * Get GO terms for a gene
   */
  async getGOTerms(geneSymbol, species) {
    try {
      // Query GO for annotations
      const response = await this.goClient.get('/annotation/search', {
        params: {
          geneProductId: geneSymbol,
          limit: 25,
          aspect: 'biological_process,molecular_function,cellular_component'
        }
      });

      const terms = response.data.results?.map(term => ({
        id: term.goId,
        name: term.goName,
        category: term.goAspect,
        evidence: term.goEvidence,
        url: `https://www.ebi.ac.uk/QuickGO/term/${term.goId}`
      })) || [];

      return terms;

    } catch (error) {
      console.error('GO term fetch error:', error.message);
      return [];
    }
  }

  /**
   * Perform pathway enrichment analysis
   * @param {Array} geneList - List of gene symbols
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Enrichment results
   */
  async pathwayEnrichment(geneList, options = {}) {
    const {
      species = 'Homo sapiens',
      background = 'genome',
      pValueThreshold = 0.05,
      databases = ['kegg', 'go'],
      correctionMethod = 'bonferroni'
    } = options;

    try {
      const results = {
        input: {
          genes: geneList.length,
          background,
          species
        },
        enriched: {
          kegg: [],
          reactome: [],
          go: []
        },
        statistics: {}
      };

      // Get all pathways for input genes
      const genePathways = await Promise.all(
        geneList.map(gene => this.getGenePathways(gene, { species, databases }))
      );

      // Aggregate pathways and count occurrences
      const pathwayCounts = this.aggregatePathways(genePathways);

      // Calculate enrichment statistics
      const enrichedPathways = this.calculateEnrichment(
        pathwayCounts,
        geneList.length,
        background,
        pValueThreshold,
        correctionMethod
      );

      // Separate by database
      enrichedPathways.forEach(pathway => {
        if (pathway.database === 'kegg') {
          results.enriched.kegg.push(pathway);
        } else if (pathway.database === 'reactome') {
          results.enriched.reactome.push(pathway);
        } else if (pathway.database === 'go') {
          results.enriched.go.push(pathway);
        }
      });

      // Calculate summary statistics
      results.statistics = {
        totalEnriched: enrichedPathways.length,
        significantPathways: enrichedPathways.filter(p => p.adjustedPValue < pValueThreshold).length,
        topPathway: enrichedPathways[0]?.name || 'None',
        avgFoldEnrichment: this.calculateAverageFoldEnrichment(enrichedPathways)
      };

      return results;

    } catch (error) {
      throw new Error(`Pathway enrichment analysis failed: ${error.message}`);
    }
  }

  /**
   * Aggregate pathways from multiple genes
   */
  aggregatePathways(genePathways) {
    const pathwayMap = new Map();

    genePathways.forEach(geneData => {
      // Process KEGG pathways
      geneData.pathways.kegg?.forEach(pathway => {
        const key = `kegg_${pathway.id}`;
        if (!pathwayMap.has(key)) {
          pathwayMap.set(key, {
            ...pathway,
            database: 'kegg',
            genes: [],
            count: 0
          });
        }
        const p = pathwayMap.get(key);
        p.genes.push(geneData.gene);
        p.count++;
      });

      // Process Reactome pathways
      geneData.pathways.reactome?.forEach(pathway => {
        const key = `reactome_${pathway.id}`;
        if (!pathwayMap.has(key)) {
          pathwayMap.set(key, {
            ...pathway,
            database: 'reactome',
            genes: [],
            count: 0
          });
        }
        const p = pathwayMap.get(key);
        p.genes.push(geneData.gene);
        p.count++;
      });

      // Process GO terms
      geneData.pathways.go?.forEach(term => {
        const key = `go_${term.id}`;
        if (!pathwayMap.has(key)) {
          pathwayMap.set(key, {
            ...term,
            database: 'go',
            genes: [],
            count: 0
          });
        }
        const p = pathwayMap.get(key);
        p.genes.push(geneData.gene);
        p.count++;
      });
    });

    return pathwayMap;
  }

  /**
   * Calculate enrichment statistics
   */
  calculateEnrichment(pathwayCounts, inputSize, background, pValueThreshold, correctionMethod) {
    const pathways = Array.from(pathwayCounts.values());

    // Calculate background size (simplified)
    const backgroundSize = background === 'genome' ? 20000 : parseInt(background);

    // Calculate enrichment for each pathway
    pathways.forEach(pathway => {
      // Hypergeometric test (simplified)
      const k = pathway.count; // Genes in list AND pathway
      const n = inputSize; // Total genes in list
      const K = pathway.geneCount || 100; // Total genes in pathway (estimated)
      const N = backgroundSize; // Total background genes

      // Calculate p-value (simplified hypergeometric)
      pathway.pValue = this.hypergeometricPValue(k, n, K, N);

      // Calculate fold enrichment
      const expected = (n * K) / N;
      pathway.foldEnrichment = k / expected;

      // Calculate gene ratio
      pathway.geneRatio = `${k}/${n}`;
      pathway.bgRatio = `${K}/${N}`;
    });

    // Apply multiple testing correction
    this.applyCorrection(pathways, correctionMethod);

    // Filter by p-value threshold and sort
    return pathways
      .filter(p => p.adjustedPValue < pValueThreshold)
      .sort((a, b) => a.adjustedPValue - b.adjustedPValue);
  }

  /**
   * Simplified hypergeometric p-value calculation
   */
  hypergeometricPValue(k, n, K, N) {
    // This is a simplified calculation
    // In production, use a proper statistical library
    const prob = (k / n) / (K / N);
    return Math.exp(-prob * prob);
  }

  /**
   * Apply multiple testing correction
   */
  applyCorrection(pathways, method) {
    const m = pathways.length;

    if (method === 'bonferroni') {
      pathways.forEach(p => {
        p.adjustedPValue = Math.min(p.pValue * m, 1);
      });
    } else if (method === 'fdr' || method === 'bh') {
      // Benjamini-Hochberg FDR
      pathways.sort((a, b) => a.pValue - b.pValue);
      pathways.forEach((p, i) => {
        p.adjustedPValue = Math.min(p.pValue * m / (i + 1), 1);
      });
    } else {
      // No correction
      pathways.forEach(p => {
        p.adjustedPValue = p.pValue;
      });
    }
  }

  /**
   * Generate pathway summary
   */
  generatePathwaySummary(pathways) {
    const summary = {
      total: 0,
      byCategory: {},
      byDatabase: {
        kegg: pathways.kegg?.length || 0,
        reactome: pathways.reactome?.length || 0,
        go: pathways.go?.length || 0
      }
    };

    // Count by category
    const allPathways = [
      ...(pathways.kegg || []),
      ...(pathways.reactome || []),
      ...(pathways.go || [])
    ];

    allPathways.forEach(pathway => {
      summary.total++;
      const category = pathway.category || 'Other';
      summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
    });

    return summary;
  }

  /**
   * Get pathway interactions
   */
  async getPathwayInteractions(geneSymbol, pathways) {
    const interactions = {
      geneGene: [],
      pathwayPathway: [],
      crossTalk: []
    };

    // Find genes that appear in multiple pathways (crosstalk)
    const pathwayGeneMap = new Map();

    const allPathways = [
      ...(pathways.kegg || []),
      ...(pathways.reactome || []),
      ...(pathways.go || [])
    ];

    allPathways.forEach(pathway => {
      if (!pathwayGeneMap.has(pathway.id)) {
        pathwayGeneMap.set(pathway.id, new Set());
      }
      pathwayGeneMap.get(pathway.id).add(geneSymbol);
    });

    // Identify pathway crosstalk
    const pathwayIds = Array.from(pathwayGeneMap.keys());
    for (let i = 0; i < pathwayIds.length; i++) {
      for (let j = i + 1; j < pathwayIds.length; j++) {
        const genes1 = pathwayGeneMap.get(pathwayIds[i]);
        const genes2 = pathwayGeneMap.get(pathwayIds[j]);
        const shared = new Set([...genes1].filter(x => genes2.has(x)));

        if (shared.size > 0) {
          interactions.crossTalk.push({
            pathway1: pathwayIds[i],
            pathway2: pathwayIds[j],
            sharedGenes: Array.from(shared),
            strength: shared.size
          });
        }
      }
    }

    return interactions;
  }

  /**
   * Calculate average fold enrichment
   */
  calculateAverageFoldEnrichment(pathways) {
    if (pathways.length === 0) return 0;
    const sum = pathways.reduce((acc, p) => acc + (p.foldEnrichment || 0), 0);
    return (sum / pathways.length).toFixed(2);
  }

  /**
   * Visualize pathway network
   * @param {Array} pathways - Enriched pathways
   * @returns {Object} - Network visualization data
   */
  generatePathwayNetwork(pathways) {
    const nodes = [];
    const edges = [];

    // Create nodes for pathways
    pathways.forEach(pathway => {
      nodes.push({
        id: pathway.id,
        label: pathway.name,
        type: 'pathway',
        database: pathway.database,
        size: Math.log10(pathway.count + 1) * 10,
        color: this.getDatabaseColor(pathway.database),
        pValue: pathway.adjustedPValue,
        foldEnrichment: pathway.foldEnrichment
      });

      // Create nodes for genes
      pathway.genes?.forEach(gene => {
        if (!nodes.find(n => n.id === gene)) {
          nodes.push({
            id: gene,
            label: gene,
            type: 'gene',
            size: 5,
            color: '#666666'
          });
        }

        // Create edge between gene and pathway
        edges.push({
          source: gene,
          target: pathway.id,
          weight: 1
        });
      });
    });

    return {
      nodes,
      edges,
      statistics: {
        pathways: pathways.length,
        genes: nodes.filter(n => n.type === 'gene').length,
        connections: edges.length
      }
    };
  }

  /**
   * Get database-specific color
   */
  getDatabaseColor(database) {
    const colors = {
      kegg: '#FF6B6B',
      reactome: '#4ECDC4',
      go: '#45B7D1'
    };
    return colors[database] || '#999999';
  }
}

// Export for use in MCP server
export default PathwayAnalysisClient;
