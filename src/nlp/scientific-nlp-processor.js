#!/usr/bin/env node

/**
 * Scientific Natural Language Processing Module
 * True NLP for genomics queries with semantic understanding
 */

import axios from 'axios';

/**
 * Scientific NLP Processor with semantic understanding
 */
export class ScientificNLPProcessor {
  constructor() {
    this.baseURL = 'https://www.alliancegenome.org/api';
    
    // Biological entity patterns
    this.genePatterns = /\b([A-Z][A-Z0-9]{2,}|[A-Z][a-z]+\d*)\b/g;
    this.speciesPatterns = {
      'human': 'Homo sapiens',
      'humans': 'Homo sapiens',
      'mouse': 'Mus musculus', 
      'mice': 'Mus musculus',
      'rat': 'Rattus norvegicus',
      'rats': 'Rattus norvegicus',
      'zebrafish': 'Danio rerio',
      'fly': 'Drosophila melanogaster',
      'flies': 'Drosophila melanogaster',
      'worm': 'Caenorhabditis elegans',
      'yeast': 'Saccharomyces cerevisiae'
    };
    
    // Intent patterns
    this.intentPatterns = {
      search: /\b(find|search|show|get|look for|identify)\b/i,
      compare: /\b(compare|versus|vs|difference between)\b/i,
      analyze: /\b(analyze|analyse|study|examine|investigate)\b/i,
      relationship: /\b(interact|related|associated|connected|linked)\b/i,
      pathway: /\b(pathway|signaling|cascade|network)\b/i,
      disease: /\b(disease|cancer|disorder|syndrome|condition)\b/i,
      function: /\b(function|role|purpose|does|mechanism)\b/i
    };
    
    // Biological context patterns  
    this.biologicalContexts = {
      'DNA repair': ['repair', 'damage', 'fix', 'restoration'],
      'cell cycle': ['division', 'mitosis', 'cycle', 'proliferation'],
      'apoptosis': ['death', 'suicide', 'programmed death'],
      'transcription': ['expression', 'transcribe', 'RNA'],
      'metabolism': ['metabolic', 'energy', 'pathway'],
      'development': ['embryonic', 'developmental', 'growth'],
      'immune': ['immunity', 'defense', 'response']
    };
  }

  /**
   * Process natural language query with semantic understanding
   */
  async processQuery(naturalQuery) {
    try {
      // Parse natural language into structured components
      const semanticParse = this.parseSemantics(naturalQuery);
      
      // Extract biological entities
      const entities = this.extractBiologicalEntities(naturalQuery);
      
      // Understand intent and context
      const intent = this.detectIntent(naturalQuery);
      const context = this.inferBiologicalContext(naturalQuery);
      
      // Build structured query
      const structuredQuery = this.buildStructuredQuery(semanticParse, entities, intent, context);
      
      // Execute with appropriate method
      const results = await this.executeSemanticQuery(structuredQuery);
      
      // Generate natural language response
      const nlResponse = this.generateNaturalResponse(results, intent, naturalQuery);
      
      return {
        originalQuery: naturalQuery,
        understanding: {
          intent,
          entities,
          context,
          semanticParse
        },
        structuredQuery,
        results,
        naturalLanguageResponse: nlResponse
      };
      
    } catch (error) {
      return {
        error: `NLP processing failed: ${error.message}`,
        originalQuery: naturalQuery
      };
    }
  }

  /**
   * Parse semantic structure of natural language
   */
  parseSemantics(query) {
    const lowercaseQuery = query.toLowerCase();
    
    return {
      subject: this.extractSubject(query),
      predicate: this.extractPredicate(query), 
      object: this.extractObject(query),
      modifiers: this.extractModifiers(query),
      negations: this.extractNegations(query),
      quantifiers: this.extractQuantifiers(query)
    };
  }

  /**
   * Extract biological entities with context awareness
   */
  extractBiologicalEntities(query) {
    const entities = {
      genes: [],
      species: [],
      diseases: [],
      processes: [],
      functions: []
    };
    
    // Extract genes
    const geneMatches = query.match(this.genePatterns) || [];
    entities.genes = [...new Set(geneMatches.filter(g => g.length > 2))];
    
    // Extract species
    Object.entries(this.speciesPatterns).forEach(([common, scientific]) => {
      if (query.toLowerCase().includes(common)) {
        entities.species.push(scientific);
      }
    });
    
    // Extract biological processes
    Object.entries(this.biologicalContexts).forEach(([process, keywords]) => {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        entities.processes.push(process);
      }
    });
    
    return entities;
  }

  /**
   * Detect user intent from natural language
   */
  detectIntent(query) {
    for (const [intent, pattern] of Object.entries(this.intentPatterns)) {
      if (pattern.test(query)) {
        return intent;
      }
    }
    return 'search'; // default
  }

  /**
   * Infer biological context and relationships
   */
  inferBiologicalContext(query) {
    const contexts = [];
    const lowercaseQuery = query.toLowerCase();
    
    // Detect biological processes
    Object.entries(this.biologicalContexts).forEach(([process, keywords]) => {
      if (keywords.some(keyword => lowercaseQuery.includes(keyword))) {
        contexts.push(process);
      }
    });
    
    // Detect relationship context
    if (/\b(interact|bind|regulate|control|affect)\b/i.test(query)) {
      contexts.push('protein interaction');
    }
    
    if (/\b(upstream|downstream|pathway|cascade)\b/i.test(query)) {
      contexts.push('signaling pathway');
    }
    
    return contexts;
  }

  /**
   * Extract semantic components
   */
  extractSubject(query) {
    // Simplified subject extraction
    const geneMatch = query.match(/\b([A-Z][A-Z0-9]{2,}|genes?\s+\w+)/i);
    return geneMatch ? geneMatch[1] : null;
  }

  extractPredicate(query) {
    const actionMatch = query.match(/\b(interact|regulate|control|bind|affect|cause|lead to|result in)\b/i);
    return actionMatch ? actionMatch[1] : 'related to';
  }

  extractObject(query) {
    const objectMatch = query.match(/\b(with|in|for|of)\s+([A-Z]\w+(?:\s+\w+)*)/i);
    return objectMatch ? objectMatch[2] : null;
  }

  extractModifiers(query) {
    const modifiers = [];
    if (/\bdirectly\b/i.test(query)) modifiers.push('direct');
    if (/\bindirectly\b/i.test(query)) modifiers.push('indirect');
    if (/\bstrongly\b/i.test(query)) modifiers.push('strong');
    return modifiers;
  }

  extractNegations(query) {
    const negations = [];
    const negationPattern = /\b(not|don't|doesn't|exclude|without|except)\s+([A-Za-z\s]+)/gi;
    let match;
    while ((match = negationPattern.exec(query)) !== null) {
      negations.push(match[2].trim());
    }
    return negations;
  }

  extractQuantifiers(query) {
    if (/\ball\b/i.test(query)) return 'all';
    if (/\bsome\b/i.test(query)) return 'some';
    if (/\bmany\b/i.test(query)) return 'many';
    if (/\bfew\b/i.test(query)) return 'few';
    return 'some';
  }

  /**
   * Build structured query from semantic understanding
   */
  buildStructuredQuery(semantics, entities, intent, context) {
    let query = '';
    
    // Build based on intent
    switch (intent) {
      case 'search':
        query = this.buildSearchQuery(entities, context);
        break;
      case 'relationship':
        query = this.buildRelationshipQuery(entities, semantics);
        break;
      case 'function':
        query = this.buildFunctionQuery(entities);
        break;
      default:
        query = this.buildGeneralQuery(entities);
    }
    
    // Apply negations
    if (semantics.negations.length > 0) {
      query += ' NOT ' + semantics.negations.join(' NOT ');
    }
    
    // Apply species filter
    if (entities.species.length > 0) {
      query += ` in ${entities.species[0]}`;
    }
    
    return query.trim();
  }

  buildSearchQuery(entities, context) {
    let parts = [];
    
    if (entities.genes.length > 0) {
      parts.push(entities.genes.join(' OR '));
    }
    
    if (context.length > 0) {
      parts.push(context.join(' '));
    }
    
    return parts.join(' AND ');
  }

  buildRelationshipQuery(entities, semantics) {
    if (entities.genes.length >= 2) {
      return `${entities.genes[0]} ${semantics.predicate} ${entities.genes[1]}`;
    }
    return entities.genes.join(' ') + ' interactions';
  }

  buildFunctionQuery(entities) {
    return entities.genes.join(' ') + ' function';
  }

  buildGeneralQuery(entities) {
    return entities.genes.join(' OR ');
  }

  /**
   * Execute semantic query using appropriate AGR method
   */
  async executeSemanticQuery(structuredQuery) {
    try {
      // Direct API call to AGR search
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          category: 'gene',
          q: structuredQuery,
          limit: 10,
          offset: 0
        }
      });
      
      return {
        entities: {
          genes: {
            total: response.data.total,
            results: response.data.results || []
          }
        }
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Generate natural language response
   */
  generateNaturalResponse(results, intent, originalQuery) {
    if (!results || !results.entities) {
      return "I couldn't find any relevant results for your query.";
    }

    const totalResults = results.entities.genes?.total || 0;
    const topResults = results.entities.genes?.results || [];
    
    let response = '';
    
    switch (intent) {
      case 'search':
        response = `I found ${totalResults} genes related to your query. `;
        break;
      case 'function':
        response = `Here's what I found about the function of these genes: `;
        break;
      case 'relationship':
        response = `I discovered ${totalResults} potential relationships. `;
        break;
      default:
        response = `Your search returned ${totalResults} results. `;
    }
    
    if (topResults.length > 0) {
      response += `The top matches include: `;
      const topGenes = topResults.slice(0, 3).map(gene => 
        `${gene.symbol} (${gene.species}) - ${gene.name}`
      );
      response += topGenes.join('; ') + '.';
    }
    
    return response;
  }

  /**
   * Handle conversational follow-up
   */
  async handleFollowUp(currentQuery, conversationHistory) {
    // Resolve pronouns and references from context
    const resolvedQuery = this.resolveReferences(currentQuery, conversationHistory);
    return this.processQuery(resolvedQuery);
  }

  /**
   * Resolve pronouns and references using conversation context
   */
  resolveReferences(query, history) {
    let resolved = query;
    
    // Replace "it" with last mentioned gene
    if (/\bit\b/i.test(resolved) && history.length > 0) {
      const lastGenes = history[history.length - 1].understanding?.entities?.genes || [];
      if (lastGenes.length > 0) {
        resolved = resolved.replace(/\bit\b/i, lastGenes[0]);
      }
    }
    
    // Replace "these genes" with previously mentioned genes
    if (/\bthese genes?\b/i.test(resolved) && history.length > 0) {
      const lastGenes = history[history.length - 1].understanding?.entities?.genes || [];
      if (lastGenes.length > 0) {
        resolved = resolved.replace(/\bthese genes?\b/i, lastGenes.join(' and '));
      }
    }
    
    return resolved;
  }
}

export default ScientificNLPProcessor;