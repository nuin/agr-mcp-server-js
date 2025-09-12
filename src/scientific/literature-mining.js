#!/usr/bin/env node

/**
 * Literature Mining Module - PubMed Integration
 *
 * Provides scientific literature search and analysis capabilities
 * for gene-related research using NCBI's E-utilities API.
 *
 * Features:
 * - PubMed literature search
 * - Gene mention extraction
 * - Citation analysis
 * - Research trend tracking
 * - Abstract summarization
 *
 * @author Scientific Features Team
 * @version 1.0.0
 */

import axios from 'axios';

/**
 * NCBI E-utilities API endpoints
 */
const NCBI_ENDPOINTS = {
  search: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  summary: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi',
  fetch: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi',
  link: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi'
};

/**
 * Literature Mining Client
 */
export class LiteratureMiningClient {
  constructor(options = {}) {
    this.email = options.email || 'agr-mcp-server@example.com';
    this.tool = options.tool || 'AGR-MCP-Server';
    this.retmax = options.retmax || 100;
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'AGR-MCP-Literature-Mining/1.0.0'
      }
    });
  }

  /**
   * Search PubMed for gene-related literature
   * @param {string} geneSymbol - Gene symbol to search for
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results with PMIDs and metadata
   */
  async searchLiterature(geneSymbol, options = {}) {
    const {
      keywords = [],
      dateRange = null,
      maxResults = 50,
      sortBy = 'relevance'
    } = options;

    // Build search query
    let query = `"${geneSymbol}"[Gene Name]`;

    // Add additional keywords
    if (keywords.length > 0) {
      const keywordQuery = keywords.map(k => `"${k}"`).join(' AND ');
      query += ` AND (${keywordQuery})`;
    }

    // Add date range if specified
    if (dateRange) {
      const { startYear, endYear } = dateRange;
      query += ` AND ("${startYear}"[Date - Publication] : "${endYear}"[Date - Publication])`;
    }

    try {
      // Step 1: Search for PMIDs
      const searchResponse = await this.client.get(NCBI_ENDPOINTS.search, {
        params: {
          db: 'pubmed',
          term: query,
          retmax: maxResults,
          retmode: 'json',
          sort: sortBy === 'date' ? 'pub_date' : 'relevance',
          email: this.email,
          tool: this.tool
        }
      });

      const searchData = searchResponse.data;
      const pmids = searchData.esearchresult.idlist || [];

      if (pmids.length === 0) {
        return {
          query,
          total: 0,
          papers: [],
          summary: 'No literature found for the specified criteria'
        };
      }

      // Step 2: Get detailed information for found papers
      const papers = await this.getPaperDetails(pmids);

      // Step 3: Analyze and rank results
      const analyzedPapers = this.analyzePapers(papers, geneSymbol);

      return {
        query,
        total: parseInt(searchData.esearchresult.count),
        returned: pmids.length,
        papers: analyzedPapers,
        summary: `Found ${searchData.esearchresult.count} papers related to ${geneSymbol}`
      };

    } catch (error) {
      throw new Error(`Literature search failed: ${error.message}`);
    }
  }

  /**
   * Get detailed information for a list of PMIDs
   * @param {Array<string>} pmids - PubMed IDs
   * @returns {Promise<Array>} Paper details
   */
  async getPaperDetails(pmids) {
    if (pmids.length === 0) return [];

    try {
      const summaryResponse = await this.client.get(NCBI_ENDPOINTS.summary, {
        params: {
          db: 'pubmed',
          id: pmids.join(','),
          retmode: 'json',
          email: this.email,
          tool: this.tool
        }
      });

      const summaryData = summaryResponse.data;
      const papers = [];

      for (const pmid of pmids) {
        const paperData = summaryData.result[pmid];
        if (paperData && paperData.title) {
          papers.push({
            pmid,
            title: paperData.title,
            authors: this.formatAuthors(paperData.authors),
            journal: paperData.fulljournalname || paperData.source,
            date: paperData.pubdate,
            doi: paperData.elocationid?.startsWith('doi:')
              ? paperData.elocationid.replace('doi:', '') : null,
            abstract: null, // Will be fetched separately if needed
            citedBy: null,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            relevanceScore: null // Will be calculated
          });
        }
      }

      return papers;
    } catch (error) {
      throw new Error(`Failed to get paper details: ${error.message}`);
    }
  }

  /**
   * Get abstracts for papers (separate call to avoid rate limiting)
   * @param {Array<string>} pmids - PubMed IDs
   * @returns {Promise<Object>} PMID to abstract mapping
   */
  async getAbstracts(pmids) {
    if (pmids.length === 0) return {};

    try {
      const fetchResponse = await this.client.get(NCBI_ENDPOINTS.fetch, {
        params: {
          db: 'pubmed',
          id: pmids.slice(0, 10).join(','), // Limit to avoid timeout
          retmode: 'xml',
          rettype: 'abstract',
          email: this.email,
          tool: this.tool
        }
      });

      // Parse XML to extract abstracts (simplified)
      const abstracts = {};
      const xmlText = fetchResponse.data;

      // Basic XML parsing for abstracts
      const pmidRegex = /<PMID[^>]*>(\d+)<\/PMID>/g;
      const abstractRegex = /<AbstractText[^>]*>(.*?)<\/AbstractText>/gs;

      let pmidMatch;
      const pmidOrder = [];
      while ((pmidMatch = pmidRegex.exec(xmlText)) !== null) {
        pmidOrder.push(pmidMatch[1]);
      }

      let abstractMatch;
      let abstractIndex = 0;
      while ((abstractMatch = abstractRegex.exec(xmlText)) !== null && abstractIndex < pmidOrder.length) {
        const cleanAbstract = abstractMatch[1]
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .trim();

        abstracts[pmidOrder[abstractIndex]] = cleanAbstract;
        abstractIndex++;
      }

      return abstracts;
    } catch (error) {
      console.warn(`Failed to get abstracts: ${error.message}`);
      return {};
    }
  }

  /**
   * Analyze papers and calculate relevance scores
   * @param {Array} papers - Paper objects
   * @param {string} geneSymbol - Gene symbol for relevance calculation
   * @returns {Array} Analyzed and ranked papers
   */
  analyzePapers(papers, geneSymbol) {
    const currentYear = new Date().getFullYear();

    return papers.map(paper => {
      // Calculate relevance score based on:
      // 1. Gene mention in title (high weight)
      // 2. Recent publication (medium weight)
      // 3. Journal quality proxy (low weight)

      let relevanceScore = 0;
      const title = paper.title.toLowerCase();
      const gene = geneSymbol.toLowerCase();

      // Gene mention in title
      if (title.includes(gene)) {
        relevanceScore += 10;
      }

      // Recency bonus
      const pubYear = this.extractYear(paper.date);
      if (pubYear) {
        const yearDiff = currentYear - pubYear;
        relevanceScore += Math.max(0, 5 - (yearDiff * 0.5));
      }

      // Journal quality proxy (based on common high-impact journals)
      const highImpactJournals = ['nature', 'science', 'cell', 'nejm', 'jama', 'lancet'];
      const journal = (paper.journal || '').toLowerCase();
      if (highImpactJournals.some(j => journal.includes(j))) {
        relevanceScore += 3;
      }

      return {
        ...paper,
        relevanceScore: Math.round(relevanceScore * 10) / 10,
        publicationYear: pubYear
      };
    }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Find gene relationships from literature co-mentions
   * @param {string} geneSymbol - Primary gene
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Gene relationship network
   */
  async findGeneRelationships(geneSymbol, options = {}) {
    const { maxGenes = 20, minCoOccurrence = 2 } = options;

    try {
      // Search for papers mentioning the gene
      const literatureResult = await this.searchLiterature(geneSymbol, {
        maxResults: 100
      });

      // Get abstracts for analysis
      const pmids = literatureResult.papers.slice(0, 20).map(p => p.pmid);
      const abstracts = await this.getAbstracts(pmids);

      // Extract gene co-mentions from abstracts
      const geneCoOccurrences = {};
      const commonGenePattern = /\b([A-Z][A-Z0-9]{2,})\b/g;

      Object.values(abstracts).forEach(abstract => {
        if (!abstract) return;

        const genes = [...abstract.matchAll(commonGenePattern)]
          .map(match => match[1])
          .filter(gene => gene !== geneSymbol && gene.length <= 10);

        genes.forEach(gene => {
          geneCoOccurrences[gene] = (geneCoOccurrences[gene] || 0) + 1;
        });
      });

      // Filter and rank co-occurring genes
      const relatedGenes = Object.entries(geneCoOccurrences)
        .filter(([gene, count]) => count >= minCoOccurrence)
        .sort(([, a], [, b]) => b - a)
        .slice(0, maxGenes)
        .map(([gene, coOccurrences]) => ({
          gene,
          coOccurrences,
          relationshipStrength: Math.min(coOccurrences / 5, 1) // Normalize to 0-1
        }));

      return {
        primaryGene: geneSymbol,
        totalPapers: literatureResult.total,
        analyzedPapers: pmids.length,
        relatedGenes,
        summary: `Found ${relatedGenes.length} genes frequently mentioned with ${geneSymbol}`
      };

    } catch (error) {
      throw new Error(`Gene relationship analysis failed: ${error.message}`);
    }
  }

  /**
   * Track research trends for a gene over time
   * @param {string} geneSymbol - Gene symbol
   * @param {Object} options - Trend analysis options
   * @returns {Promise<Object>} Research trend data
   */
  async analyzeResearchTrends(geneSymbol, options = {}) {
    const { startYear = 2000, endYear = new Date().getFullYear() } = options;
    const trends = [];

    try {
      // Analyze publication trends in 2-year windows
      for (let year = startYear; year <= endYear; year += 2) {
        const windowEnd = Math.min(year + 1, endYear);

        const result = await this.searchLiterature(geneSymbol, {
          dateRange: { startYear: year, endYear: windowEnd },
          maxResults: 1 // We only need the count
        });

        trends.push({
          period: `${year}-${windowEnd}`,
          startYear: year,
          endYear: windowEnd,
          publications: result.total
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Calculate trend metrics
      const totalPublications = trends.reduce((sum, t) => sum + t.publications, 0);
      const recentYears = trends.slice(-3); // Last 6 years
      const recentPublications = recentYears.reduce((sum, t) => sum + t.publications, 0);

      const trendDirection = this.calculateTrendDirection(trends);

      return {
        gene: geneSymbol,
        timeRange: `${startYear}-${endYear}`,
        totalPublications,
        recentPublications,
        trendDirection,
        yearlyData: trends,
        summary: `${geneSymbol} has ${totalPublications} publications from ${startYear}-${endYear}, with ${trendDirection} trend`
      };

    } catch (error) {
      throw new Error(`Research trend analysis failed: ${error.message}`);
    }
  }

  /**
   * Helper: Format author list
   */
  formatAuthors(authors) {
    if (!authors || authors.length === 0) return 'Unknown authors';

    if (authors.length <= 3) {
      return authors.map(a => a.name).join(', ');
    } else {
      return `${authors[0].name} et al.`;
    }
  }

  /**
   * Helper: Extract publication year from date string
   */
  extractYear(dateString) {
    if (!dateString) return null;
    const yearMatch = dateString.match(/(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1]) : null;
  }

  /**
   * Helper: Calculate trend direction from time series
   */
  calculateTrendDirection(trends) {
    if (trends.length < 3) return 'insufficient data';

    const recentTrend = trends.slice(-3);
    const earlyTrend = trends.slice(0, 3);

    const recentAvg = recentTrend.reduce((sum, t) => sum + t.publications, 0) / recentTrend.length;
    const earlyAvg = earlyTrend.reduce((sum, t) => sum + t.publications, 0) / earlyTrend.length;

    const changePercent = ((recentAvg - earlyAvg) / Math.max(earlyAvg, 1)) * 100;

    if (changePercent > 20) return 'increasing';
    if (changePercent < -20) return 'decreasing';
    return 'stable';
  }
}

export default LiteratureMiningClient;
