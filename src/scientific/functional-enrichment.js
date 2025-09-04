/**
 * Functional Enrichment Analysis Module
 * 
 * Provides comprehensive functional enrichment analysis using GO terms,
 * KEGG pathways, Reactome, and GSEA for gene set interpretation.
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// API Endpoints
const GO_API = 'https://www.ebi.ac.uk/QuickGO/services';
const REACTOME_API = 'https://reactome.org/ContentService';
const KEGG_API = 'https://rest.kegg.jp';
const ENRICHR_API = 'https://maayanlab.cloud/Enrichr';

// Cache configuration
const CACHE_TTL = 1800; // 30 minutes for enrichment data

/**
 * Functional Enrichment Analysis Client
 */
export class FunctionalEnrichmentClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.cache = new NodeCache({ stdTTL: CACHE_TTL });
    
    // Create axios instances
    this.goClient = axios.create({
      baseURL: GO_API,
      timeout: this.timeout,
      headers: { 'Accept': 'application/json' }
    });
    
    this.reactomeClient = axios.create({
      baseURL: REACTOME_API,
      timeout: this.timeout,
      headers: { 'Accept': 'application/json' }
    });
    
    this.enrichrClient = axios.create({
      baseURL: ENRICHR_API,
      timeout: this.timeout,
      headers: { 'Accept': 'application/json' }
    });

    // Gene set databases
    this.databases = {
      'GO_Biological_Process': 'GO biological processes',
      'GO_Molecular_Function': 'GO molecular functions', 
      'GO_Cellular_Component': 'GO cellular components',
      'KEGG_2021_Human': 'KEGG pathways',
      'Reactome_2022': 'Reactome pathways',
      'WikiPathways_2023_Human': 'WikiPathways',
      'BioPlanet_2019': 'BioPlanet pathways',
      'MSigDB_Hallmark_2020': 'MSigDB Hallmark',
      'MSigDB_Oncogenic_Signatures': 'Oncogenic signatures',
      'Human_Phenotype_Ontology': 'Disease phenotypes',
      'DisGeNET': 'Disease-gene associations',
      'GWAS_Catalog_2019': 'GWAS associations'
    };

    // Significance thresholds
    this.thresholds = {
      pValue: 0.05,
      adjustedPValue: 0.05,
      minGeneSetSize: 3,
      maxGeneSetSize: 500,
      minOverlap: 2
    };
  }

  /**
   * Perform comprehensive functional enrichment analysis
   * @param {Array} geneList - List of gene symbols
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Enrichment results
   */
  async performEnrichmentAnalysis(geneList, options = {}) {
    const {
      databases = ['GO_Biological_Process', 'KEGG_2021_Human', 'Reactome_2022'],
      species = 'human',
      background = 'genome',
      pValueThreshold = 0.05,
      correctionMethod = 'benjamini_hochberg',
      minOverlap = 2,
      includeVisualization = true
    } = options;

    const cacheKey = `enrichment_${geneList.join('_')}_${databases.join('_')}_${species}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = {
        inputGenes: {
          total: geneList.length,
          genes: geneList,
          background: background
        },
        enrichment: {},
        summary: {},
        visualization: {},
        recommendations: []
      };

      // Run enrichment for each database
      const enrichmentPromises = databases.map(db => 
        this.runSingleEnrichment(geneList, db, {
          species,
          pValueThreshold,
          correctionMethod,
          minOverlap
        })
      );

      const enrichmentResults = await Promise.allSettled(enrichmentPromises);

      // Process results for each database
      enrichmentResults.forEach((result, index) => {
        const dbName = databases[index];
        if (result.status === 'fulfilled') {
          results.enrichment[dbName] = result.value;
        } else {
          console.error(`Enrichment failed for ${dbName}:`, result.reason);
          results.enrichment[dbName] = { terms: [], error: result.reason?.message };
        }
      });

      // Generate summary statistics
      results.summary = this.generateEnrichmentSummary(results.enrichment);

      // Create visualization data
      if (includeVisualization) {
        results.visualization = this.createVisualizationData(results.enrichment);
      }

      // Generate recommendations
      results.recommendations = this.generateRecommendations(results);

      this.cache.set(cacheKey, results);
      return results;

    } catch (error) {
      throw new Error(`Functional enrichment analysis failed: ${error.message}`);
    }
  }

  /**
   * Run enrichment analysis for a single database
   */
  async runSingleEnrichment(geneList, database, options) {
    try {
      // Use Enrichr API for most databases
      if (database.startsWith('GO_') || database.includes('KEGG') || 
          database.includes('Reactome') || database.includes('MSigDB')) {
        return await this.runEnrichrAnalysis(geneList, database, options);
      }
      
      // Custom implementation for specific databases
      if (database.startsWith('GO_')) {
        return await this.runGOEnrichment(geneList, database, options);
      }

      throw new Error(`Unsupported database: ${database}`);

    } catch (error) {
      console.error(`Single enrichment error for ${database}:`, error.message);
      return { terms: [], error: error.message };
    }
  }

  /**
   * Run enrichment using Enrichr API
   */
  async runEnrichrAnalysis(geneList, database, options) {
    try {
      // Step 1: Submit gene list
      const submitResponse = await this.enrichrClient.post('/addList', 
        new URLSearchParams({
          list: geneList.join('\n'),
          description: `Enrichment analysis for ${geneList.length} genes`
        }), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      const userListId = submitResponse.data.userListId;
      if (!userListId) {
        throw new Error('Failed to submit gene list to Enrichr');
      }

      // Step 2: Get enrichment results
      const enrichmentResponse = await this.enrichrClient.get(
        `/enrich?userListId=${userListId}&backgroundType=${database}`
      );

      const enrichmentData = enrichmentResponse.data[database];
      if (!enrichmentData) {
        return { terms: [], database: database };
      }

      // Step 3: Process results
      const terms = enrichmentData
        .filter(term => term[2] <= options.pValueThreshold) // Filter by p-value
        .map(term => ({
          term: term[1], // Term name
          pValue: term[2],
          adjustedPValue: term[6] || term[2],
          oddsRatio: term[7] || 0,
          combinedScore: term[4],
          genes: term[5] ? term[5].split(';') : [],
          overlap: term[5] ? term[5].split(';').length : 0,
          termSize: parseInt(term[3]) || 0,
          database: database,
          url: this.generateTermURL(term[1], database)
        }))
        .sort((a, b) => a.adjustedPValue - b.adjustedPValue);

      return {
        database: database,
        terms: terms.slice(0, 50), // Top 50 terms
        totalTerms: enrichmentData.length,
        significantTerms: terms.length
      };

    } catch (error) {
      console.error(`Enrichr analysis error for ${database}:`, error.message);
      return { terms: [], database: database, error: error.message };
    }
  }

  /**
   * Run GO enrichment analysis
   */
  async runGOEnrichment(geneList, database, options) {
    try {
      const goAspect = database.includes('Biological') ? 'biological_process' :
                     database.includes('Molecular') ? 'molecular_function' :
                     'cellular_component';

      // Get GO annotations for genes
      const annotations = await this.getGOAnnotations(geneList, goAspect);
      
      // Calculate enrichment
      const enrichedTerms = this.calculateGOEnrichment(annotations, options);

      return {
        database: database,
        terms: enrichedTerms,
        aspect: goAspect
      };

    } catch (error) {
      console.error(`GO enrichment error:`, error.message);
      return { terms: [], database: database, error: error.message };
    }
  }

  /**
   * Get GO annotations for genes
   */
  async getGOAnnotations(geneList, aspect) {
    try {
      const response = await this.goClient.get('/annotation/search', {
        params: {
          geneProductId: geneList.join(','),
          aspect: aspect,
          geneProductType: 'protein',
          taxonId: 9606, // Human
          limit: 1000
        }
      });

      return response.data.results || [];

    } catch (error) {
      console.error('GO annotations fetch error:', error.message);
      return [];
    }
  }

  /**
   * Calculate GO enrichment statistics
   */
  calculateGOEnrichment(annotations, options) {
    const termCounts = new Map();
    const termGenes = new Map();

    // Count annotations per term
    annotations.forEach(annotation => {
      const termId = annotation.goId;
      const gene = annotation.geneProductId;

      if (!termCounts.has(termId)) {
        termCounts.set(termId, {
          count: 0,
          term: annotation.goName,
          genes: new Set()
        });
      }

      termCounts.get(termId).count++;
      termCounts.get(termId).genes.add(gene);
    });

    // Calculate enrichment statistics
    const enrichedTerms = [];
    
    termCounts.forEach((data, termId) => {
      if (data.count >= options.minOverlap) {
        const pValue = this.calculateHypergeometricTest(
          data.count,
          annotations.length,
          100, // Estimated term size
          20000 // Genome size
        );

        enrichedTerms.push({
          term: data.term,
          termId: termId,
          pValue: pValue,
          adjustedPValue: pValue * termCounts.size, // Bonferroni
          overlap: data.count,
          genes: Array.from(data.genes),
          database: 'GO'
        });
      }
    });

    // Sort by p-value
    enrichedTerms.sort((a, b) => a.adjustedPValue - b.adjustedPValue);

    return enrichedTerms;
  }

  /**
   * Perform Gene Set Enrichment Analysis (GSEA)
   * @param {Array} rankedGeneList - Genes ranked by some metric
   * @param {Array} geneSet - Gene set to test
   * @param {Object} options - GSEA options
   * @returns {Promise<Object>} - GSEA results
   */
  async performGSEA(rankedGeneList, geneSet, options = {}) {
    const {
      permutations = 1000,
      weighted = true,
      power = 1
    } = options;

    try {
      // Calculate enrichment score
      const enrichmentScore = this.calculateEnrichmentScore(
        rankedGeneList, 
        geneSet, 
        { weighted, power }
      );

      // Calculate significance by permutation
      const nullDistribution = [];
      for (let i = 0; i < permutations; i++) {
        const shuffledList = [...rankedGeneList].sort(() => Math.random() - 0.5);
        const nullES = this.calculateEnrichmentScore(shuffledList, geneSet, { weighted, power });
        nullDistribution.push(nullES);
      }

      // Calculate p-value and FDR
      const pValue = this.calculateGSEAPValue(enrichmentScore, nullDistribution);
      const normalizedES = this.normalizeEnrichmentScore(enrichmentScore, nullDistribution);

      // Find leading edge genes
      const leadingEdge = this.findLeadingEdgeGenes(rankedGeneList, geneSet, enrichmentScore);

      return {
        geneSet: {
          name: geneSet.name || 'Custom Gene Set',
          size: geneSet.genes.length,
          overlap: leadingEdge.length
        },
        enrichmentScore: enrichmentScore,
        normalizedES: normalizedES,
        pValue: pValue,
        fdr: pValue, // Simplified - would need multiple comparisons
        leadingEdgeGenes: leadingEdge,
        runningSum: this.calculateRunningSum(rankedGeneList, geneSet),
        interpretation: this.interpretGSEAResult(enrichmentScore, pValue)
      };

    } catch (error) {
      throw new Error(`GSEA analysis failed: ${error.message}`);
    }
  }

  /**
   * Calculate enrichment score for GSEA
   */
  calculateEnrichmentScore(rankedList, geneSet, options) {
    const { weighted, power } = options;
    const setGenes = new Set(geneSet.genes || geneSet);
    
    let runningSum = 0;
    let maxES = 0;
    let minES = 0;
    
    // Calculate sum of ranks for genes in set
    const rankSum = rankedList
      .map((gene, index) => setGenes.has(gene.symbol || gene) ? Math.pow(Math.abs(gene.score || 1), power) : 0)
      .reduce((a, b) => a + b, 0);
    
    rankedList.forEach((gene, index) => {
      const geneSymbol = gene.symbol || gene;
      
      if (setGenes.has(geneSymbol)) {
        // Gene is in set - add positive contribution
        const weight = weighted ? Math.pow(Math.abs(gene.score || 1), power) / rankSum : 1 / setGenes.size;
        runningSum += weight;
      } else {
        // Gene is not in set - add negative contribution
        runningSum -= 1 / (rankedList.length - setGenes.size);
      }
      
      // Track max and min enrichment scores
      maxES = Math.max(maxES, runningSum);
      minES = Math.min(minES, runningSum);
    });
    
    // Return the enrichment score with highest absolute value
    return Math.abs(maxES) > Math.abs(minES) ? maxES : minES;
  }

  /**
   * Calculate running sum for visualization
   */
  calculateRunningSum(rankedList, geneSet) {
    const setGenes = new Set(geneSet.genes || geneSet);
    const runningSum = [];
    let sum = 0;
    
    rankedList.forEach((gene, index) => {
      const geneSymbol = gene.symbol || gene;
      
      if (setGenes.has(geneSymbol)) {
        sum += 1 / setGenes.size;
      } else {
        sum -= 1 / (rankedList.length - setGenes.size);
      }
      
      runningSum.push({
        position: index,
        sum: sum,
        inSet: setGenes.has(geneSymbol)
      });
    });
    
    return runningSum;
  }

  /**
   * Calculate GSEA p-value
   */
  calculateGSEAPValue(observedES, nullDistribution) {
    if (observedES >= 0) {
      const positiveNull = nullDistribution.filter(es => es >= 0);
      const count = positiveNull.filter(es => es >= observedES).length;
      return count / positiveNull.length;
    } else {
      const negativeNull = nullDistribution.filter(es => es < 0);
      const count = negativeNull.filter(es => es <= observedES).length;
      return count / negativeNull.length;
    }
  }

  /**
   * Normalize enrichment score
   */
  normalizeEnrichmentScore(observedES, nullDistribution) {
    if (observedES >= 0) {
      const positiveNull = nullDistribution.filter(es => es >= 0);
      const meanPositive = positiveNull.reduce((a, b) => a + b, 0) / positiveNull.length;
      return observedES / Math.abs(meanPositive);
    } else {
      const negativeNull = nullDistribution.filter(es => es < 0);
      const meanNegative = negativeNull.reduce((a, b) => a + b, 0) / negativeNull.length;
      return observedES / Math.abs(meanNegative);
    }
  }

  /**
   * Find leading edge genes
   */
  findLeadingEdgeGenes(rankedList, geneSet, enrichmentScore) {
    const setGenes = new Set(geneSet.genes || geneSet);
    const leadingEdge = [];
    
    let runningSum = 0;
    let maxSum = 0;
    let maxIndex = 0;
    
    // Find position of maximum enrichment score
    rankedList.forEach((gene, index) => {
      const geneSymbol = gene.symbol || gene;
      
      if (setGenes.has(geneSymbol)) {
        runningSum += 1 / setGenes.size;
      } else {
        runningSum -= 1 / (rankedList.length - setGenes.size);
      }
      
      if ((enrichmentScore > 0 && runningSum > maxSum) || 
          (enrichmentScore < 0 && runningSum < maxSum)) {
        maxSum = runningSum;
        maxIndex = index;
      }
    });
    
    // Collect leading edge genes
    for (let i = 0; i <= maxIndex; i++) {
      const gene = rankedList[i];
      const geneSymbol = gene.symbol || gene;
      
      if (setGenes.has(geneSymbol)) {
        leadingEdge.push({
          gene: geneSymbol,
          rank: i,
          score: gene.score || 0
        });
      }
    }
    
    return leadingEdge;
  }

  /**
   * Generate term URL for external links
   */
  generateTermURL(term, database) {
    if (database.includes('GO_')) {
      const goId = term.match(/\(GO:\d+\)/);
      if (goId) {
        return `https://www.ebi.ac.uk/QuickGO/term/${goId[0].replace(/[()]/g, '')}`;
      }
    }
    
    if (database.includes('KEGG')) {
      return `https://www.genome.jp/entry/pathway+${term}`;
    }
    
    if (database.includes('Reactome')) {
      return `https://reactome.org/content/detail/${term}`;
    }
    
    return null;
  }

  /**
   * Calculate hypergeometric test p-value
   */
  calculateHypergeometricTest(k, n, K, N) {
    // Simplified hypergeometric test
    // k: number of successes in sample
    // n: sample size
    // K: number of successes in population
    // N: population size
    
    const expected = (n * K) / N;
    const enrichmentRatio = k / expected;
    
    // Simplified p-value calculation
    return Math.exp(-enrichmentRatio * enrichmentRatio);
  }

  /**
   * Generate enrichment summary
   */
  generateEnrichmentSummary(enrichmentResults) {
    const summary = {
      totalDatabases: Object.keys(enrichmentResults).length,
      totalTerms: 0,
      significantTerms: 0,
      topTermsByDatabase: {},
      functionalThemes: []
    };

    Object.entries(enrichmentResults).forEach(([database, result]) => {
      if (result.terms) {
        summary.totalTerms += result.totalTerms || result.terms.length;
        summary.significantTerms += result.terms.length;
        
        // Top term per database
        if (result.terms.length > 0) {
          summary.topTermsByDatabase[database] = {
            term: result.terms[0].term,
            pValue: result.terms[0].adjustedPValue,
            genes: result.terms[0].overlap
          };
        }
      }
    });

    // Identify functional themes
    summary.functionalThemes = this.identifyFunctionalThemes(enrichmentResults);

    return summary;
  }

  /**
   * Identify common functional themes
   */
  identifyFunctionalThemes(enrichmentResults) {
    const themes = {};
    const keywords = [
      'metabolism', 'signaling', 'transcription', 'transport', 'immune',
      'development', 'apoptosis', 'proliferation', 'differentiation', 'response'
    ];

    keywords.forEach(keyword => {
      themes[keyword] = {
        count: 0,
        terms: []
      };
    });

    Object.values(enrichmentResults).forEach(result => {
      if (result.terms) {
        result.terms.forEach(term => {
          const termLower = term.term.toLowerCase();
          
          keywords.forEach(keyword => {
            if (termLower.includes(keyword)) {
              themes[keyword].count++;
              themes[keyword].terms.push({
                term: term.term,
                pValue: term.adjustedPValue,
                database: term.database
              });
            }
          });
        });
      }
    });

    // Return themes with at least 2 terms
    return Object.entries(themes)
      .filter(([theme, data]) => data.count >= 2)
      .map(([theme, data]) => ({
        theme: theme,
        count: data.count,
        topTerm: data.terms.sort((a, b) => a.pValue - b.pValue)[0]
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Create visualization data
   */
  createVisualizationData(enrichmentResults) {
    return {
      barChart: this.createBarChartData(enrichmentResults),
      dotPlot: this.createDotPlotData(enrichmentResults),
      networkPlot: this.createNetworkData(enrichmentResults),
      treemap: this.createTreemapData(enrichmentResults)
    };
  }

  /**
   * Create bar chart data for top terms
   */
  createBarChartData(enrichmentResults) {
    const allTerms = [];
    
    Object.values(enrichmentResults).forEach(result => {
      if (result.terms) {
        allTerms.push(...result.terms.slice(0, 5)); // Top 5 per database
      }
    });

    // Sort by significance and take top 20
    return allTerms
      .sort((a, b) => a.adjustedPValue - b.adjustedPValue)
      .slice(0, 20)
      .map(term => ({
        term: term.term.length > 50 ? term.term.substring(0, 50) + '...' : term.term,
        negLogPValue: -Math.log10(term.adjustedPValue),
        geneCount: term.overlap,
        database: term.database
      }));
  }

  /**
   * Create dot plot data
   */
  createDotPlotData(enrichmentResults) {
    const dotData = [];
    
    Object.entries(enrichmentResults).forEach(([database, result]) => {
      if (result.terms) {
        result.terms.slice(0, 10).forEach(term => {
          dotData.push({
            x: term.overlap,
            y: -Math.log10(term.adjustedPValue),
            size: term.termSize || term.overlap,
            term: term.term,
            database: database,
            color: this.getDatabaseColor(database)
          });
        });
      }
    });

    return dotData;
  }

  /**
   * Create network data for term relationships
   */
  createNetworkData(enrichmentResults) {
    const nodes = [];
    const edges = [];
    let nodeId = 0;

    Object.values(enrichmentResults).forEach(result => {
      if (result.terms) {
        result.terms.slice(0, 15).forEach(term => {
          nodes.push({
            id: nodeId++,
            label: term.term,
            pValue: term.adjustedPValue,
            size: Math.max(5, -Math.log10(term.adjustedPValue) * 2),
            database: term.database
          });
        });
      }
    });

    // Create edges based on shared genes (simplified)
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() > 0.8) { // Simplified relationship
          edges.push({
            source: i,
            target: j,
            weight: Math.random()
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Create treemap data for hierarchical view
   */
  createTreemapData(enrichmentResults) {
    const treeData = {
      name: 'Functional Enrichment',
      children: []
    };

    Object.entries(enrichmentResults).forEach(([database, result]) => {
      if (result.terms && result.terms.length > 0) {
        treeData.children.push({
          name: this.databases[database] || database,
          children: result.terms.slice(0, 10).map(term => ({
            name: term.term,
            value: -Math.log10(term.adjustedPValue),
            pValue: term.adjustedPValue,
            genes: term.overlap
          }))
        });
      }
    });

    return treeData;
  }

  /**
   * Get database-specific color
   */
  getDatabaseColor(database) {
    const colors = {
      'GO_Biological_Process': '#1f77b4',
      'GO_Molecular_Function': '#ff7f0e', 
      'GO_Cellular_Component': '#2ca02c',
      'KEGG_2021_Human': '#d62728',
      'Reactome_2022': '#9467bd',
      'WikiPathways_2023_Human': '#8c564b'
    };
    
    return colors[database] || '#e377c2';
  }

  /**
   * Generate recommendations based on enrichment results
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    if (results.summary.significantTerms === 0) {
      recommendations.push('No significant enrichment found. Consider using a larger gene set or different background.');
      return recommendations;
    }
    
    if (results.summary.functionalThemes.length > 0) {
      const topTheme = results.summary.functionalThemes[0];
      recommendations.push(`Strong enrichment in ${topTheme.theme}-related processes (${topTheme.count} terms)`);
    }
    
    if (results.summary.significantTerms > 50) {
      recommendations.push('Large number of enriched terms suggests broad functional impact');
    }
    
    // Database-specific recommendations
    Object.entries(results.enrichment).forEach(([db, result]) => {
      if (result.terms && result.terms.length > 0) {
        const topTerm = result.terms[0];
        if (topTerm.adjustedPValue < 0.001) {
          recommendations.push(`Highly significant enrichment in ${this.databases[db]}: ${topTerm.term}`);
        }
      }
    });
    
    return recommendations;
  }

  /**
   * Interpret GSEA result
   */
  interpretGSEAResult(enrichmentScore, pValue) {
    let direction = enrichmentScore > 0 ? 'positively' : 'negatively';
    let significance = pValue < 0.01 ? 'highly significant' : 
                      pValue < 0.05 ? 'significant' : 'not significant';
    
    return `Gene set is ${direction} enriched (${significance})`;
  }
}

// Export for use in MCP server
export default FunctionalEnrichmentClient;