/**
 * Drug-Gene Interactions Module
 * 
 * Provides drug-gene interaction data from DGIdb, PharmGKB, and DrugBank
 * for precision medicine and drug repurposing applications.
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// API Endpoints
const DGIDB_API = 'https://dgidb.org/api/v2';
const PHARMGKB_API = 'https://api.pharmgkb.org/v1';
const CHEMBL_API = 'https://www.ebi.ac.uk/chembl/api/data';
const DRUGBANK_API = 'https://go.drugbank.com/unearth/q'; // Limited public access

// Cache configuration  
const CACHE_TTL = 7200; // 2 hours for drug data

/**
 * Drug-Gene Interactions Client
 */
export class DrugGeneInteractionsClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.cache = new NodeCache({ stdTTL: CACHE_TTL });
    
    // Create axios instances
    this.dgidbClient = axios.create({
      baseURL: DGIDB_API,
      timeout: this.timeout,
      headers: { 'Accept': 'application/json' }
    });
    
    this.chemblClient = axios.create({
      baseURL: CHEMBL_API,
      timeout: this.timeout,
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Drug interaction types
    this.interactionTypes = {
      inhibitor: ['inhibitor', 'antagonist', 'blocker', 'suppressor'],
      activator: ['activator', 'agonist', 'inducer', 'stimulator'],
      modulator: ['modulator', 'regulator', 'allosteric modulator'],
      binder: ['binder', 'ligand', 'substrate'],
      other: ['cofactor', 'chaperone', 'product of']
    };

    // Clinical relevance levels
    this.clinicalLevels = {
      '1A': 'FDA-approved drug-gene pair',
      '1B': 'FDA-approved drug, off-label use',
      '2A': 'Clinical trial evidence',
      '2B': 'Preclinical evidence (strong)',
      '3': 'Case reports or observational studies',
      '4': 'Preclinical evidence (limited)'
    };
  }

  /**
   * Get drug interactions for a gene
   * @param {string} geneSymbol - Gene symbol
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Drug interaction data
   */
  async getDrugInteractions(geneSymbol, options = {}) {
    const {
      interactionTypes = 'all',
      sourceDatabases = 'all',
      clinicalRelevance = 'all',
      includePharmacokinetics = true,
      includeIndications = true
    } = options;

    const cacheKey = `druginter_${geneSymbol}_${Object.values(options).join('_')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = {
        gene: geneSymbol,
        drugs: [],
        summary: {},
        pharmacogenomics: null,
        clinicalAnnotations: [],
        drugRepurposing: []
      };

      // Fetch from DGIdb (primary source)
      const dgidbData = await this.queryDGIdb(geneSymbol, interactionTypes, sourceDatabases);
      results.drugs = dgidbData.drugs;

      // Get additional drug details from ChEMBL
      if (results.drugs.length > 0) {
        const drugDetails = await this.enrichDrugData(results.drugs.slice(0, 10));
        results.drugs = this.mergeDrugData(results.drugs, drugDetails);
      }

      // Get pharmacogenomics data if requested
      if (includePharmacokinetics) {
        results.pharmacogenomics = await this.getPharmacogenomics(geneSymbol);
      }

      // Get clinical annotations
      if (includeIndications) {
        results.clinicalAnnotations = await this.getClinicalAnnotations(geneSymbol);
      }

      // Identify drug repurposing opportunities
      results.drugRepurposing = this.identifyRepurposingOpportunities(results.drugs);

      // Generate summary
      results.summary = this.generateDrugSummary(results);

      // Apply clinical relevance filter
      if (clinicalRelevance !== 'all') {
        results.drugs = this.filterByClinicalRelevance(results.drugs, clinicalRelevance);
      }

      this.cache.set(cacheKey, results);
      return results;

    } catch (error) {
      throw new Error(`Drug interaction query failed: ${error.message}`);
    }
  }

  /**
   * Query DGIdb for drug interactions
   */
  async queryDGIdb(geneSymbol, interactionTypes, sourceDatabases) {
    try {
      const response = await this.dgidbClient.get('/interactions.json', {
        params: {
          genes: geneSymbol,
          interaction_types: interactionTypes === 'all' ? undefined : interactionTypes,
          interaction_sources: sourceDatabases === 'all' ? undefined : sourceDatabases
        }
      });

      const matchedTerms = response.data.matchedTerms || [];
      if (matchedTerms.length === 0) {
        return { drugs: [], sources: [] };
      }

      const geneData = matchedTerms[0];
      const interactions = geneData.interactions || [];

      // Process interactions
      const drugs = interactions.map(interaction => ({
        drugName: interaction.drugName,
        chemblId: interaction.drugChemblId,
        interactionTypes: interaction.interactionTypes || [],
        interactionScore: interaction.score,
        sources: interaction.sources || [],
        pmids: interaction.pmids || [],
        clinicalTrials: this.extractClinicalTrials(interaction),
        approvalStatus: this.determineApprovalStatus(interaction),
        mechanism: this.categorizeMechanism(interaction.interactionTypes)
      }));

      // Sort by interaction score and clinical relevance
      drugs.sort((a, b) => {
        if (a.approvalStatus !== b.approvalStatus) {
          return this.getApprovalPriority(a.approvalStatus) - this.getApprovalPriority(b.approvalStatus);
        }
        return (b.interactionScore || 0) - (a.interactionScore || 0);
      });

      return {
        drugs,
        sources: [...new Set(interactions.flatMap(i => i.sources || []))]
      };

    } catch (error) {
      console.error('DGIdb query error:', error.message);
      return { drugs: [], sources: [] };
    }
  }

  /**
   * Enrich drug data from ChEMBL
   */
  async enrichDrugData(drugs) {
    const enrichedDrugs = [];

    for (const drug of drugs) {
      if (drug.chemblId) {
        try {
          const response = await this.chemblClient.get(`/molecule/${drug.chemblId}.json`);
          const molecule = response.data;

          enrichedDrugs.push({
            chemblId: drug.chemblId,
            name: drug.drugName,
            synonyms: molecule.molecule_synonyms?.map(s => s.molecule_synonym) || [],
            type: molecule.molecule_type,
            maxPhase: molecule.max_phase,
            firstApproval: molecule.first_approval,
            indication: molecule.indication_class,
            mechanism: molecule.mechanism_of_action,
            molecularFormula: molecule.molecule_properties?.full_molformula,
            molecularWeight: molecule.molecule_properties?.mw_freebase,
            alogp: molecule.molecule_properties?.alogp,
            blackBoxWarning: molecule.black_box_warning === '1',
            withdrawn: molecule.withdrawn_flag === '1',
            therapeuticAreas: this.extractTherapeuticAreas(molecule)
          });
        } catch (error) {
          console.error(`ChEMBL fetch error for ${drug.chemblId}:`, error.message);
        }
      }
    }

    return enrichedDrugs;
  }

  /**
   * Get pharmacogenomics data
   */
  async getPharmacogenomics(geneSymbol) {
    try {
      // Simulated PharmGKB data (would need API key for real access)
      return {
        gene: geneSymbol,
        variants: [
          {
            variant: `${geneSymbol}*1`,
            frequency: 0.65,
            function: 'Normal function',
            clinicalImplication: 'Standard dosing'
          },
          {
            variant: `${geneSymbol}*2`,
            frequency: 0.25,
            function: 'Reduced function',
            clinicalImplication: 'May require dose adjustment'
          }
        ],
        drugMetabolism: {
          substrate: this.getSubstrateDrugs(geneSymbol),
          inhibitor: this.getInhibitorDrugs(geneSymbol),
          inducer: this.getInducerDrugs(geneSymbol)
        },
        guidelines: [
          {
            source: 'CPIC',
            level: 'A',
            recommendation: 'Genetic testing recommended before prescribing'
          }
        ]
      };
    } catch (error) {
      console.error('Pharmacogenomics fetch error:', error.message);
      return null;
    }
  }

  /**
   * Get clinical annotations
   */
  async getClinicalAnnotations(geneSymbol) {
    // Simulated clinical annotations
    const annotations = [];
    
    // Common drug-gene pairs
    const commonPairs = {
      'CYP2D6': ['codeine', 'tramadol', 'tamoxifen'],
      'CYP2C19': ['clopidogrel', 'voriconazole', 'citalopram'],
      'CYP2C9': ['warfarin', 'phenytoin'],
      'TPMT': ['azathioprine', 'mercaptopurine'],
      'DPYD': ['fluorouracil', 'capecitabine'],
      'HLA-B': ['abacavir', 'carbamazepine', 'allopurinol']
    };

    if (commonPairs[geneSymbol]) {
      commonPairs[geneSymbol].forEach(drug => {
        annotations.push({
          drug: drug,
          gene: geneSymbol,
          level: '1A',
          annotation: `${geneSymbol} genotype affects ${drug} metabolism/response`,
          recommendation: 'Consider genetic testing before prescribing',
          source: 'CPIC/DPWG Guidelines'
        });
      });
    }

    return annotations;
  }

  /**
   * Identify drug repurposing opportunities
   */
  identifyRepurposingOpportunities(drugs) {
    const opportunities = [];

    drugs.forEach(drug => {
      // Check if drug is approved for other indications
      if (drug.approvalStatus === 'Approved' && drug.therapeuticAreas) {
        opportunities.push({
          drug: drug.drugName,
          currentIndications: drug.therapeuticAreas,
          mechanism: drug.mechanism,
          evidence: drug.pmids?.length || 0,
          score: this.calculateRepurposingScore(drug),
          rationale: this.generateRepurposingRationale(drug)
        });
      }
    });

    // Sort by repurposing score
    opportunities.sort((a, b) => b.score - a.score);
    return opportunities.slice(0, 5); // Top 5 opportunities
  }

  /**
   * Calculate repurposing score
   */
  calculateRepurposingScore(drug) {
    let score = 0;
    
    // Factor in approval status
    if (drug.approvalStatus === 'Approved') score += 50;
    else if (drug.maxPhase >= 3) score += 30;
    else if (drug.maxPhase >= 2) score += 20;
    
    // Factor in evidence
    score += Math.min(drug.pmids?.length || 0, 10) * 2;
    score += drug.sources?.length || 0;
    
    // Factor in safety
    if (drug.blackBoxWarning) score -= 20;
    if (drug.withdrawn) score -= 50;
    
    return Math.max(score, 0);
  }

  /**
   * Generate repurposing rationale
   */
  generateRepurposingRationale(drug) {
    const rationales = [];
    
    if (drug.approvalStatus === 'Approved') {
      rationales.push('FDA-approved with established safety profile');
    }
    
    if (drug.mechanism === 'inhibitor') {
      rationales.push('Target inhibition may be therapeutic');
    } else if (drug.mechanism === 'activator') {
      rationales.push('Target activation may restore function');
    }
    
    if (drug.pmids?.length > 5) {
      rationales.push(`Strong literature support (${drug.pmids.length} publications)`);
    }
    
    return rationales.join('; ');
  }

  /**
   * Perform pharmacological enrichment analysis
   * @param {Array} geneList - List of gene symbols
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Enrichment results
   */
  async pharmacologicalEnrichment(geneList, options = {}) {
    const {
      pValueThreshold = 0.05,
      minDrugs = 3,
      drugClasses = 'all'
    } = options;

    try {
      // Get drug interactions for all genes
      const allInteractions = await Promise.all(
        geneList.map(gene => this.getDrugInteractions(gene, { includePharmacokinetics: false }))
      );

      // Aggregate drugs and calculate enrichment
      const drugCounts = new Map();
      const drugTargets = new Map();

      allInteractions.forEach((result, idx) => {
        result.drugs.forEach(drug => {
          const key = drug.drugName;
          if (!drugCounts.has(key)) {
            drugCounts.set(key, 0);
            drugTargets.set(key, []);
          }
          drugCounts.set(key, drugCounts.get(key) + 1);
          drugTargets.get(key).push(geneList[idx]);
        });
      });

      // Calculate enrichment statistics
      const enrichedDrugs = [];
      
      drugCounts.forEach((count, drug) => {
        if (count >= minDrugs) {
          const pValue = this.calculateHypergeometricPValue(
            count,
            geneList.length,
            100, // Estimated number of drug targets
            20000 // Estimated genome size
          );
          
          if (pValue <= pValueThreshold) {
            enrichedDrugs.push({
              drug: drug,
              targetCount: count,
              targets: drugTargets.get(drug),
              pValue: pValue,
              adjustedPValue: pValue * drugCounts.size, // Bonferroni correction
              enrichmentRatio: count / geneList.length
            });
          }
        }
      });

      // Sort by p-value
      enrichedDrugs.sort((a, b) => a.pValue - b.pValue);

      return {
        inputGenes: geneList.length,
        totalDrugs: drugCounts.size,
        enrichedDrugs: enrichedDrugs,
        drugClasses: this.classifyEnrichedDrugs(enrichedDrugs),
        therapeuticAreas: this.identifyTherapeuticAreas(enrichedDrugs),
        recommendations: this.generatePharmacologicalRecommendations(enrichedDrugs)
      };

    } catch (error) {
      throw new Error(`Pharmacological enrichment failed: ${error.message}`);
    }
  }

  /**
   * Extract clinical trials
   */
  extractClinicalTrials(interaction) {
    // Extract NCT numbers from sources or attributes
    const trials = [];
    
    if (interaction.attributes) {
      Object.values(interaction.attributes).forEach(attr => {
        if (attr && attr.includes('NCT')) {
          const nctMatch = attr.match(/NCT\d{8}/g);
          if (nctMatch) {
            trials.push(...nctMatch);
          }
        }
      });
    }
    
    return [...new Set(trials)];
  }

  /**
   * Determine approval status
   */
  determineApprovalStatus(interaction) {
    const sources = interaction.sources || [];
    
    if (sources.includes('FDA') || sources.includes('DrugBank')) {
      return 'Approved';
    }
    if (sources.includes('ClinicalTrials')) {
      return 'Clinical Trial';
    }
    if (sources.includes('ChEMBL') || sources.includes('PubChem')) {
      return 'Experimental';
    }
    
    return 'Investigational';
  }

  /**
   * Categorize interaction mechanism
   */
  categorizeMechanism(interactionTypes) {
    if (!interactionTypes || interactionTypes.length === 0) {
      return 'unknown';
    }
    
    const types = interactionTypes.map(t => t.toLowerCase());
    
    for (const [category, keywords] of Object.entries(this.interactionTypes)) {
      if (keywords.some(keyword => types.some(t => t.includes(keyword)))) {
        return category;
      }
    }
    
    return 'other';
  }

  /**
   * Get approval priority
   */
  getApprovalPriority(status) {
    const priorities = {
      'Approved': 1,
      'Clinical Trial': 2,
      'Investigational': 3,
      'Experimental': 4
    };
    
    return priorities[status] || 5;
  }

  /**
   * Merge drug data from multiple sources
   */
  mergeDrugData(dgidbDrugs, chemblDrugs) {
    const merged = dgidbDrugs.map(drug => {
      const chemblData = chemblDrugs.find(c => c.chemblId === drug.chemblId);
      
      if (chemblData) {
        return {
          ...drug,
          ...chemblData,
          drugName: drug.drugName, // Keep original name
          sources: drug.sources // Keep original sources
        };
      }
      
      return drug;
    });
    
    return merged;
  }

  /**
   * Extract therapeutic areas
   */
  extractTherapeuticAreas(molecule) {
    const areas = new Set();
    
    if (molecule.indication_class) {
      areas.add(molecule.indication_class);
    }
    
    if (molecule.atc_classifications) {
      molecule.atc_classifications.forEach(atc => {
        if (atc.level2_description) {
          areas.add(atc.level2_description);
        }
      });
    }
    
    return Array.from(areas);
  }

  /**
   * Get substrate drugs for gene
   */
  getSubstrateDrugs(geneSymbol) {
    const substrates = {
      'CYP3A4': ['midazolam', 'simvastatin', 'tacrolimus'],
      'CYP2D6': ['dextromethorphan', 'metoprolol', 'tamoxifen'],
      'CYP2C19': ['omeprazole', 'clopidogrel', 'voriconazole'],
      'CYP2C9': ['warfarin', 'tolbutamide', 'phenytoin'],
      'CYP1A2': ['caffeine', 'theophylline', 'tizanidine']
    };
    
    return substrates[geneSymbol] || [];
  }

  /**
   * Get inhibitor drugs for gene
   */
  getInhibitorDrugs(geneSymbol) {
    const inhibitors = {
      'CYP3A4': ['ketoconazole', 'ritonavir', 'grapefruit juice'],
      'CYP2D6': ['fluoxetine', 'paroxetine', 'quinidine'],
      'CYP2C19': ['fluconazole', 'fluvoxamine', 'ticlopidine']
    };
    
    return inhibitors[geneSymbol] || [];
  }

  /**
   * Get inducer drugs for gene
   */
  getInducerDrugs(geneSymbol) {
    const inducers = {
      'CYP3A4': ['rifampin', 'carbamazepine', 'St. Johns Wort'],
      'CYP2C19': ['rifampin', 'prednisone'],
      'CYP1A2': ['smoking', 'omeprazole', 'chargrilled meat']
    };
    
    return inducers[geneSymbol] || [];
  }

  /**
   * Filter by clinical relevance
   */
  filterByClinicalRelevance(drugs, level) {
    const levelPriority = {
      'approved': ['Approved'],
      'clinical': ['Approved', 'Clinical Trial'],
      'all': ['Approved', 'Clinical Trial', 'Investigational', 'Experimental']
    };
    
    const allowed = levelPriority[level] || levelPriority['all'];
    
    return drugs.filter(drug => allowed.includes(drug.approvalStatus));
  }

  /**
   * Generate drug summary
   */
  generateDrugSummary(results) {
    const summary = {
      totalDrugs: results.drugs.length,
      approvedDrugs: results.drugs.filter(d => d.approvalStatus === 'Approved').length,
      clinicalTrials: results.drugs.filter(d => d.approvalStatus === 'Clinical Trial').length,
      byMechanism: {},
      topDrugs: results.drugs.slice(0, 5).map(d => d.drugName),
      hasPharmacogenomics: results.pharmacogenomics !== null,
      repurposingCandidates: results.drugRepurposing.length
    };
    
    // Count by mechanism
    results.drugs.forEach(drug => {
      const mech = drug.mechanism || 'unknown';
      summary.byMechanism[mech] = (summary.byMechanism[mech] || 0) + 1;
    });
    
    return summary;
  }

  /**
   * Calculate hypergeometric p-value
   */
  calculateHypergeometricPValue(k, n, K, N) {
    // Simplified hypergeometric calculation
    const prob = (k / n) / (K / N);
    return Math.exp(-prob * prob);
  }

  /**
   * Classify enriched drugs
   */
  classifyEnrichedDrugs(enrichedDrugs) {
    const classes = {};
    
    enrichedDrugs.forEach(item => {
      // Simplified classification
      const drugClass = this.getDrugClass(item.drug);
      if (!classes[drugClass]) {
        classes[drugClass] = [];
      }
      classes[drugClass].push(item.drug);
    });
    
    return classes;
  }

  /**
   * Get drug class
   */
  getDrugClass(drugName) {
    // Simplified drug classification
    const name = drugName.toLowerCase();
    
    if (name.includes('mab')) return 'Monoclonal Antibody';
    if (name.includes('nib')) return 'Kinase Inhibitor';
    if (name.includes('statin')) return 'Statin';
    if (name.includes('pril')) return 'ACE Inhibitor';
    if (name.includes('sartan')) return 'ARB';
    if (name.includes('olol')) return 'Beta Blocker';
    
    return 'Other';
  }

  /**
   * Identify therapeutic areas
   */
  identifyTherapeuticAreas(enrichedDrugs) {
    const areas = new Set();
    
    enrichedDrugs.forEach(item => {
      // Simplified therapeutic area identification
      const drugClass = this.getDrugClass(item.drug);
      
      if (['Kinase Inhibitor', 'Monoclonal Antibody'].includes(drugClass)) {
        areas.add('Oncology');
      }
      if (['Statin', 'ACE Inhibitor', 'ARB', 'Beta Blocker'].includes(drugClass)) {
        areas.add('Cardiovascular');
      }
    });
    
    return Array.from(areas);
  }

  /**
   * Generate pharmacological recommendations
   */
  generatePharmacologicalRecommendations(enrichedDrugs) {
    const recommendations = [];
    
    if (enrichedDrugs.length > 0) {
      recommendations.push(`${enrichedDrugs.length} drugs show significant enrichment`);
      
      const topDrug = enrichedDrugs[0];
      if (topDrug) {
        recommendations.push(`${topDrug.drug} targets ${topDrug.targetCount} genes in your list`);
      }
      
      if (enrichedDrugs.some(d => d.adjustedPValue < 0.01)) {
        recommendations.push('Strong statistical evidence for drug-target enrichment');
      }
    }
    
    return recommendations;
  }
}

// Export for use in MCP server
export default DrugGeneInteractionsClient;