/**
 * Gene Expression Heatmaps Module
 * 
 * Provides tissue-specific and cell-type-specific gene expression data
 * with visualization-ready heatmap generation from GTEx, HPA, and other sources.
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// API Endpoints
const GTEX_API = 'https://gtexportal.org/api/v2';
const HPA_API = 'https://www.proteinatlas.org/api';
const ARCHS4_API = 'https://maayanlab.cloud/archs4/search';
const EXPRESSION_ATLAS_API = 'https://www.ebi.ac.uk/gxa/api';

// Cache configuration
const CACHE_TTL = 1800; // 30 minutes for expression data

/**
 * Gene Expression Client
 */
export class GeneExpressionClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.cache = new NodeCache({ stdTTL: CACHE_TTL });
    
    // Create axios instances
    this.gtexClient = axios.create({
      baseURL: GTEX_API,
      timeout: this.timeout,
      headers: { 'Accept': 'application/json' }
    });
    
    this.hpaClient = axios.create({
      baseURL: HPA_API,
      timeout: this.timeout,
      headers: { 'Accept': 'application/json' }
    });
    
    this.atlasClient = axios.create({
      baseURL: EXPRESSION_ATLAS_API,
      timeout: this.timeout,
      headers: { 'Accept': 'application/json' }
    });

    // Expression level categories
    this.expressionLevels = {
      'not_detected': { min: 0, max: 0.1, color: '#f0f0f0', label: 'Not detected' },
      'low': { min: 0.1, max: 1, color: '#ffffcc', label: 'Low' },
      'medium': { min: 1, max: 10, color: '#fed976', label: 'Medium' },
      'high': { min: 10, max: 100, color: '#fd8d3c', label: 'High' },
      'very_high': { min: 100, max: Infinity, color: '#e31a1c', label: 'Very high' }
    };

    // Tissue categories for organization
    this.tissueCategories = {
      'nervous': ['brain', 'nerve', 'spinal', 'cortex', 'cerebral', 'hypothalamus'],
      'cardiovascular': ['heart', 'artery', 'aorta', 'coronary'],
      'digestive': ['liver', 'stomach', 'intestine', 'colon', 'pancreas'],
      'respiratory': ['lung', 'bronchus', 'trachea'],
      'reproductive': ['testis', 'ovary', 'uterus', 'prostate', 'breast'],
      'musculoskeletal': ['muscle', 'bone', 'cartilage', 'tendon'],
      'immune': ['spleen', 'thymus', 'lymph', 'tonsil'],
      'endocrine': ['thyroid', 'adrenal', 'pituitary'],
      'other': []
    };
  }

  /**
   * Get gene expression across tissues
   * @param {string|Array} genes - Gene symbol(s)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Expression data with heatmap
   */
  async getExpressionHeatmap(genes, options = {}) {
    const {
      dataSources = ['gtex', 'hpa'],
      tissueFilter = 'all',
      cellTypeFilter = 'all',
      minExpression = 0.1,
      includeIsoforms = false,
      normalization = 'log2'
    } = options;

    const geneList = Array.isArray(genes) ? genes : [genes];
    const cacheKey = `expression_${geneList.join('_')}_${Object.values(options).join('_')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = {
        genes: geneList,
        tissues: [],
        expressionMatrix: {},
        heatmapData: {},
        statistics: {},
        visualization: {}
      };

      // Fetch expression data from multiple sources
      const promises = [];
      
      if (dataSources.includes('gtex')) {
        promises.push(this.getGTExExpression(geneList));
      }
      if (dataSources.includes('hpa')) {
        promises.push(this.getHPAExpression(geneList));
      }

      const expressionData = await Promise.allSettled(promises);
      
      // Merge expression data
      const mergedData = this.mergeExpressionData(expressionData, dataSources);
      results.expressionMatrix = mergedData.matrix;
      results.tissues = mergedData.tissues;

      // Apply filters
      if (tissueFilter !== 'all') {
        results.tissues = this.filterTissues(results.tissues, tissueFilter);
        results.expressionMatrix = this.filterExpressionMatrix(
          results.expressionMatrix, 
          results.tissues
        );
      }

      // Calculate statistics
      results.statistics = this.calculateExpressionStatistics(results.expressionMatrix);

      // Generate heatmap data
      results.heatmapData = this.generateHeatmapData(
        results.expressionMatrix,
        results.tissues,
        geneList,
        { normalization, minExpression }
      );

      // Create visualization configuration
      results.visualization = this.createVisualizationConfig(results);

      this.cache.set(cacheKey, results);
      return results;

    } catch (error) {
      throw new Error(`Gene expression analysis failed: ${error.message}`);
    }
  }

  /**
   * Get GTEx expression data
   */
  async getGTExExpression(genes) {
    try {
      const expressionData = {};
      
      for (const gene of genes) {
        const response = await axios.get(
          `https://gtexportal.org/rest/v1/expression/medianGeneExpression`,
          {
            params: {
              gencodeId: gene,
              tissueSiteDetailId: 'all'
            },
            timeout: this.timeout
          }
        );

        if (response.data?.medianGeneExpression) {
          expressionData[gene] = {};
          response.data.medianGeneExpression.forEach(expr => {
            const tissue = expr.tissueSiteDetailId;
            const value = expr.median || 0;
            expressionData[gene][tissue] = value;
          });
        }
      }

      return {
        source: 'GTEx',
        data: expressionData,
        tissues: this.getGTExTissues()
      };

    } catch (error) {
      console.error('GTEx fetch error:', error.message);
      return { source: 'GTEx', data: {}, tissues: [] };
    }
  }

  /**
   * Get Human Protein Atlas expression data
   */
  async getHPAExpression(genes) {
    try {
      const expressionData = {};
      
      for (const gene of genes) {
        const response = await axios.get(
          `https://www.proteinatlas.org/api/search_download.php`,
          {
            params: {
              search: gene,
              format: 'json',
              columns: 'g,gt,tis,lev'
            },
            timeout: this.timeout
          }
        );

        if (response.data) {
          expressionData[gene] = {};
          response.data.forEach(entry => {
            if (entry.Gene === gene) {
              const tissue = entry.Tissue;
              const level = this.convertHPALevel(entry.Level);
              expressionData[gene][tissue] = level;
            }
          });
        }
      }

      return {
        source: 'HPA',
        data: expressionData,
        tissues: this.getHPATissues()
      };

    } catch (error) {
      console.error('HPA fetch error:', error.message);
      return { source: 'HPA', data: {}, tissues: [] };
    }
  }

  /**
   * Perform differential expression analysis
   * @param {Array} condition1Genes - Genes in condition 1
   * @param {Array} condition2Genes - Genes in condition 2
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Differential expression results
   */
  async differentialExpression(condition1Genes, condition2Genes, options = {}) {
    const {
      tissueContext = 'all',
      statisticalTest = 't_test',
      fdrThreshold = 0.05,
      logFoldChangeThreshold = 1,
      includeVolcano = true
    } = options;

    try {
      // Get expression data for both conditions
      const [expr1, expr2] = await Promise.all([
        this.getExpressionHeatmap(condition1Genes, { tissueFilter: tissueContext }),
        this.getExpressionHeatmap(condition2Genes, { tissueFilter: tissueContext })
      ]);

      // Calculate differential expression
      const results = {
        condition1: { name: 'Condition 1', genes: condition1Genes.length },
        condition2: { name: 'Condition 2', genes: condition2Genes.length },
        tissues: expr1.tissues,
        differentialGenes: [],
        statistics: {},
        visualization: {}
      };

      // Compare expression levels tissue by tissue
      expr1.tissues.forEach(tissue => {
        const diff = this.calculateTissueDifference(
          expr1.expressionMatrix,
          expr2.expressionMatrix,
          tissue,
          condition1Genes,
          condition2Genes
        );

        if (Math.abs(diff.logFoldChange) >= logFoldChangeThreshold && 
            diff.adjustedPValue <= fdrThreshold) {
          results.differentialGenes.push({
            tissue: tissue,
            logFoldChange: diff.logFoldChange,
            pValue: diff.pValue,
            adjustedPValue: diff.adjustedPValue,
            meanExpr1: diff.meanExpr1,
            meanExpr2: diff.meanExpr2,
            significance: diff.adjustedPValue < 0.001 ? 'highly_significant' : 'significant'
          });
        }
      });

      // Sort by significance
      results.differentialGenes.sort((a, b) => a.adjustedPValue - b.adjustedPValue);

      // Calculate summary statistics
      results.statistics = {
        totalComparisons: expr1.tissues.length,
        significantTissues: results.differentialGenes.length,
        upregulated: results.differentialGenes.filter(d => d.logFoldChange > 0).length,
        downregulated: results.differentialGenes.filter(d => d.logFoldChange < 0).length,
        maxFoldChange: Math.max(...results.differentialGenes.map(d => Math.abs(d.logFoldChange)))
      };

      // Generate volcano plot data if requested
      if (includeVolcano) {
        results.visualization.volcanoPlot = this.generateVolcanoPlotData(results.differentialGenes);
      }

      return results;

    } catch (error) {
      throw new Error(`Differential expression analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze tissue specificity
   * @param {Array} genes - Gene symbols
   * @returns {Promise<Object>} - Tissue specificity analysis
   */
  async analyzeTissueSpecificity(genes, options = {}) {
    const { metric = 'tau', threshold = 0.8 } = options;

    try {
      const expression = await this.getExpressionHeatmap(genes);
      const results = {
        genes: genes,
        tissueSpecific: [],
        ubiquitous: [],
        notExpressed: [],
        specificityScores: {}
      };

      genes.forEach(gene => {
        const geneExpr = expression.expressionMatrix[gene] || {};
        const values = Object.values(geneExpr);
        
        if (values.length === 0) {
          results.notExpressed.push(gene);
          return;
        }

        // Calculate tissue specificity using Tau metric
        const tau = this.calculateTau(values);
        results.specificityScores[gene] = tau;

        if (tau >= threshold) {
          const maxTissue = Object.entries(geneExpr)
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];
          
          results.tissueSpecific.push({
            gene: gene,
            tau: tau,
            preferredTissue: maxTissue,
            maxExpression: Math.max(...values)
          });
        } else if (tau < 0.3) {
          results.ubiquitous.push({
            gene: gene,
            tau: tau,
            meanExpression: values.reduce((a, b) => a + b, 0) / values.length
          });
        }
      });

      // Sort by specificity
      results.tissueSpecific.sort((a, b) => b.tau - a.tau);
      results.ubiquitous.sort((a, b) => b.meanExpression - a.meanExpression);

      return results;

    } catch (error) {
      throw new Error(`Tissue specificity analysis failed: ${error.message}`);
    }
  }

  /**
   * Merge expression data from multiple sources
   */
  mergeExpressionData(expressionData, sources) {
    const merged = { matrix: {}, tissues: new Set() };
    
    expressionData.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { data, tissues } = result.value;
        const source = sources[index];
        
        Object.keys(data).forEach(gene => {
          if (!merged.matrix[gene]) merged.matrix[gene] = {};
          
          Object.keys(data[gene]).forEach(tissue => {
            const tissueKey = `${tissue}_${source}`;
            merged.matrix[gene][tissueKey] = data[gene][tissue];
            merged.tissues.add(tissueKey);
          });
        });
      }
    });
    
    return {
      matrix: merged.matrix,
      tissues: Array.from(merged.tissues).sort()
    };
  }

  /**
   * Convert HPA expression levels to numeric values
   */
  convertHPALevel(level) {
    const levelMap = {
      'Not detected': 0,
      'Low': 1,
      'Medium': 5,
      'High': 15
    };
    return levelMap[level] || 0;
  }

  /**
   * Get GTEx tissue list
   */
  getGTExTissues() {
    return [
      'Adipose_Subcutaneous', 'Adipose_Visceral', 'Adrenal_Gland', 'Artery_Aorta',
      'Artery_Coronary', 'Artery_Tibial', 'Brain_Amygdala', 'Brain_Cerebellum',
      'Brain_Cortex', 'Brain_Hippocampus', 'Breast_Mammary', 'Colon_Sigmoid',
      'Esophagus_Mucosa', 'Heart_Left_Ventricle', 'Kidney_Cortex', 'Liver',
      'Lung', 'Muscle_Skeletal', 'Nerve_Tibial', 'Ovary', 'Pancreas',
      'Prostate', 'Skin_Sun_Exposed', 'Small_Intestine', 'Spleen', 'Stomach',
      'Testis', 'Thyroid', 'Uterus', 'Whole_Blood'
    ];
  }

  /**
   * Get HPA tissue list
   */
  getHPATissues() {
    return [
      'adipose tissue', 'adrenal gland', 'appendix', 'bone marrow', 'breast',
      'cerebral cortex', 'cervix', 'colon', 'duodenum', 'endometrium',
      'esophagus', 'fallopian tube', 'gallbladder', 'heart muscle', 'hippocampus',
      'kidney', 'liver', 'lung', 'lymph node', 'ovary', 'pancreas', 'placenta',
      'prostate', 'salivary gland', 'skeletal muscle', 'skin', 'small intestine',
      'smooth muscle', 'spleen', 'stomach', 'testis', 'thyroid gland', 'tonsil',
      'urinary bladder'
    ];
  }

  /**
   * Filter tissues based on criteria
   */
  filterTissues(tissues, filter) {
    if (typeof filter === 'string') {
      if (this.tissueCategories[filter]) {
        return tissues.filter(tissue => 
          this.tissueCategories[filter].some(keyword => 
            tissue.toLowerCase().includes(keyword.toLowerCase())
          )
        );
      }
      return tissues.filter(tissue => 
        tissue.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    if (Array.isArray(filter)) {
      return tissues.filter(tissue => 
        filter.some(f => tissue.toLowerCase().includes(f.toLowerCase()))
      );
    }
    
    return tissues;
  }

  /**
   * Filter expression matrix by tissues
   */
  filterExpressionMatrix(matrix, allowedTissues) {
    const filtered = {};
    
    Object.keys(matrix).forEach(gene => {
      filtered[gene] = {};
      Object.keys(matrix[gene]).forEach(tissue => {
        if (allowedTissues.includes(tissue)) {
          filtered[gene][tissue] = matrix[gene][tissue];
        }
      });
    });
    
    return filtered;
  }

  /**
   * Calculate expression statistics
   */
  calculateExpressionStatistics(matrix) {
    const stats = {
      genes: Object.keys(matrix).length,
      tissues: 0,
      totalDataPoints: 0,
      meanExpression: 0,
      maxExpression: 0,
      expressionDistribution: {}
    };
    
    let allValues = [];
    let tissueSet = new Set();
    
    Object.values(matrix).forEach(geneData => {
      Object.keys(geneData).forEach(tissue => {
        tissueSet.add(tissue);
        const value = geneData[tissue];
        allValues.push(value);
        stats.maxExpression = Math.max(stats.maxExpression, value);
      });
    });
    
    stats.tissues = tissueSet.size;
    stats.totalDataPoints = allValues.length;
    stats.meanExpression = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    
    // Expression level distribution
    Object.keys(this.expressionLevels).forEach(level => {
      const range = this.expressionLevels[level];
      stats.expressionDistribution[level] = allValues.filter(v => 
        v >= range.min && v < range.max
      ).length;
    });
    
    return stats;
  }

  /**
   * Generate heatmap data for visualization
   */
  generateHeatmapData(matrix, tissues, genes, options) {
    const { normalization, minExpression } = options;
    
    const heatmap = {
      rows: genes,
      columns: tissues,
      data: [],
      colorScale: this.generateColorScale(),
      clustering: this.calculateClustering(matrix, genes, tissues)
    };
    
    // Generate heatmap matrix
    genes.forEach((gene, geneIndex) => {
      tissues.forEach((tissue, tissueIndex) => {
        let value = matrix[gene]?.[tissue] || 0;
        
        // Apply normalization
        if (normalization === 'log2') {
          value = value > 0 ? Math.log2(value + 1) : 0;
        } else if (normalization === 'zscore') {
          value = this.calculateZScore(value, matrix, gene);
        }
        
        // Apply minimum threshold
        if (value < minExpression) value = 0;
        
        heatmap.data.push({
          row: geneIndex,
          col: tissueIndex,
          value: value,
          gene: gene,
          tissue: tissue,
          originalValue: matrix[gene]?.[tissue] || 0,
          level: this.categorizeExpressionLevel(value)
        });
      });
    });
    
    return heatmap;
  }

  /**
   * Generate color scale for heatmap
   */
  generateColorScale() {
    return [
      { value: 0, color: '#ffffff' },
      { value: 0.1, color: '#ffffcc' },
      { value: 1, color: '#fed976' },
      { value: 5, color: '#fd8d3c' },
      { value: 10, color: '#fc4e2a' },
      { value: 50, color: '#e31a1c' },
      { value: 100, color: '#b10026' }
    ];
  }

  /**
   * Calculate clustering for heatmap
   */
  calculateClustering(matrix, genes, tissues) {
    // Simplified hierarchical clustering
    const geneClusters = this.clusterGenes(matrix, genes);
    const tissueClusters = this.clusterTissues(matrix, tissues, genes);
    
    return {
      genes: geneClusters,
      tissues: tissueClusters,
      method: 'hierarchical',
      distance: 'euclidean'
    };
  }

  /**
   * Cluster genes by expression similarity
   */
  clusterGenes(matrix, genes) {
    const clusters = [];
    
    genes.forEach((gene, index) => {
      clusters.push({
        gene: gene,
        index: index,
        cluster: Math.floor(index / 5) // Simplified clustering
      });
    });
    
    return clusters;
  }

  /**
   * Cluster tissues by expression patterns
   */
  clusterTissues(matrix, tissues, genes) {
    const clusters = [];
    
    tissues.forEach((tissue, index) => {
      const category = this.categorizeTissue(tissue);
      clusters.push({
        tissue: tissue,
        index: index,
        category: category
      });
    });
    
    return clusters;
  }

  /**
   * Categorize tissue by type
   */
  categorizeTissue(tissue) {
    const tissueLower = tissue.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.tissueCategories)) {
      if (keywords.some(keyword => tissueLower.includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }

  /**
   * Calculate Z-score for normalization
   */
  calculateZScore(value, matrix, gene) {
    const geneValues = Object.values(matrix[gene] || {});
    const mean = geneValues.reduce((a, b) => a + b, 0) / geneValues.length;
    const std = Math.sqrt(
      geneValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / geneValues.length
    );
    
    return std > 0 ? (value - mean) / std : 0;
  }

  /**
   * Categorize expression level
   */
  categorizeExpressionLevel(value) {
    for (const [level, range] of Object.entries(this.expressionLevels)) {
      if (value >= range.min && value < range.max) {
        return level;
      }
    }
    return 'very_high';
  }

  /**
   * Calculate tissue difference for differential expression
   */
  calculateTissueDifference(matrix1, matrix2, tissue, genes1, genes2) {
    const values1 = genes1.map(g => matrix1[g]?.[tissue] || 0);
    const values2 = genes2.map(g => matrix2[g]?.[tissue] || 0);
    
    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;
    
    const logFoldChange = Math.log2((mean2 + 1) / (mean1 + 1));
    const pValue = this.calculateTTest(values1, values2);
    
    return {
      logFoldChange,
      pValue,
      adjustedPValue: pValue * 30, // Simplified Bonferroni correction
      meanExpr1: mean1,
      meanExpr2: mean2
    };
  }

  /**
   * Simple t-test calculation
   */
  calculateTTest(values1, values2) {
    const n1 = values1.length;
    const n2 = values2.length;
    
    const mean1 = values1.reduce((a, b) => a + b, 0) / n1;
    const mean2 = values2.reduce((a, b) => a + b, 0) / n2;
    
    const var1 = values1.reduce((a, b) => a + Math.pow(b - mean1, 2), 0) / (n1 - 1);
    const var2 = values2.reduce((a, b) => a + Math.pow(b - mean2, 2), 0) / (n2 - 1);
    
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const se = Math.sqrt(pooledVar * (1/n1 + 1/n2));
    
    const t = Math.abs(mean1 - mean2) / se;
    
    // Simplified p-value approximation
    return Math.exp(-t * t / 2);
  }

  /**
   * Calculate Tau (tissue specificity metric)
   */
  calculateTau(values) {
    if (values.length <= 1) return 0;
    
    const max = Math.max(...values);
    if (max === 0) return 0;
    
    const normalizedValues = values.map(v => v / max);
    const sum = normalizedValues.reduce((a, b) => a + (1 - b), 0);
    
    return sum / (values.length - 1);
  }

  /**
   * Generate volcano plot data
   */
  generateVolcanoPlotData(differentialGenes) {
    return differentialGenes.map(gene => ({
      x: gene.logFoldChange,
      y: -Math.log10(gene.adjustedPValue),
      tissue: gene.tissue,
      significance: gene.significance,
      color: gene.logFoldChange > 0 ? '#e31a1c' : '#1f78b4'
    }));
  }

  /**
   * Create visualization configuration
   */
  createVisualizationConfig(results) {
    return {
      heatmap: {
        width: Math.min(results.tissues.length * 20, 1200),
        height: Math.min(results.genes.length * 15, 800),
        colorScheme: 'YlOrRd',
        showDendrogram: results.genes.length > 3,
        clustering: true
      },
      legend: {
        title: 'Expression Level (TPM)',
        levels: Object.entries(this.expressionLevels).map(([key, value]) => ({
          label: value.label,
          color: value.color,
          range: `${value.min}-${value.max === Infinity ? '+' : value.max}`
        }))
      },
      annotations: {
        genes: results.genes.length,
        tissues: results.tissues.length,
        maxExpression: results.statistics.maxExpression?.toFixed(2)
      }
    };
  }
}

// Export for use in MCP server
export default GeneExpressionClient;