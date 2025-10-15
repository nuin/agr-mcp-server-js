/**
 * Variant Analysis Module
 *
 * Provides clinical variant interpretation using ClinVar, gnomAD, and VEP
 * for understanding the functional and clinical significance of genetic variants.
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// API Endpoints
const CLINVAR_API = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const GNOMAD_API = 'https://gnomad.broadinstitute.org/api';
const VEP_API = 'https://rest.ensembl.org/vep/human/hgvs';
const MYVARIANT_API = 'https://myvariant.info/v1';

// Cache configuration
const CACHE_TTL = 3600; // 1 hour for variant data

/**
 * Variant Analysis Client
 */
export class VariantAnalysisClient {
  constructor(options = {}) {
    this.email = options.email || 'agr-mcp@example.com';
    this.tool = options.tool || 'AGR-Variant-Analysis';
    this.timeout = options.timeout || 30000;
    this.cache = new NodeCache({ stdTTL: CACHE_TTL });

    // Create axios instances
    this.ncbiClient = axios.create({
      baseURL: CLINVAR_API,
      timeout: this.timeout,
      headers: { Accept: 'application/json' }
    });

    this.myvariantClient = axios.create({
      baseURL: MYVARIANT_API,
      timeout: this.timeout,
      headers: { Accept: 'application/json' }
    });

    this.ensemblClient = axios.create({
      baseURL: VEP_API,
      timeout: this.timeout,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // ACMG classification criteria
    this.acmgCriteria = {
      pathogenic: {
        veryStrong: ['PVS1'], // null variant in gene with known LOF mechanism
        strong: ['PS1', 'PS2', 'PS3', 'PS4'], // same AA change, de novo, functional studies, prevalence
        moderate: ['PM1', 'PM2', 'PM3', 'PM4', 'PM5', 'PM6'], // critical domain, absent from controls, etc
        supporting: ['PP1', 'PP2', 'PP3', 'PP4', 'PP5'] // cosegregation, missense in gene, computational
      },
      benign: {
        standalone: ['BA1'], // Allele frequency >5%
        strong: ['BS1', 'BS2', 'BS3', 'BS4'], // Allele frequency, observed in healthy, functional studies
        supporting: ['BP1', 'BP2', 'BP3', 'BP4', 'BP5', 'BP6', 'BP7'] // Missense where truncating, in-frame, etc
      }
    };
  }

  /**
   * Analyze a genetic variant
   * @param {string} variant - Variant in HGVS or VCF format
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Comprehensive variant analysis
   */
  async analyzeVariant(variant, options = {}) {
    const {
      includePopulation = true,
      includeClinical = true,
      includeFunction = true,
      includePredictions = true
    } = options;

    const cacheKey = `variant_${variant}_${Object.values(options).join('_')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = {
        variant,
        summary: {},
        clinical: null,
        population: null,
        functional: null,
        predictions: null,
        interpretation: null
      };

      // Parse variant format
      const variantInfo = this.parseVariant(variant);
      results.parsed = variantInfo;

      // Fetch data in parallel
      const promises = [];

      if (includeClinical) {
        promises.push(this.getClinicalSignificance(variant));
      }
      if (includePopulation) {
        promises.push(this.getPopulationFrequency(variantInfo));
      }
      if (includeFunction) {
        promises.push(this.getFunctionalImpact(variant));
      }
      if (includePredictions) {
        promises.push(this.getInSilicoPredictions(variant));
      }

      const [clinical, population, functional, predictions] = await Promise.allSettled(promises);

      // Process results
      if (clinical?.status === 'fulfilled') {
        results.clinical = clinical.value;
      }
      if (population?.status === 'fulfilled') {
        results.population = population.value;
      }
      if (functional?.status === 'fulfilled') {
        results.functional = functional.value;
      }
      if (predictions?.status === 'fulfilled') {
        results.predictions = predictions.value;
      }

      // Generate interpretation
      results.interpretation = this.interpretVariant(results);

      // Generate summary
      results.summary = this.generateVariantSummary(results);

      this.cache.set(cacheKey, results);
      return results;

    } catch (error) {
      throw new Error(`Variant analysis failed: ${error.message}`);
    }
  }

  /**
   * Parse variant notation
   */
  parseVariant(variant) {
    const result = {
      original: variant,
      type: null,
      chromosome: null,
      position: null,
      ref: null,
      alt: null,
      gene: null,
      transcript: null,
      protein: null
    };

    // Check if HGVS format
    if (variant.includes(':c.') || variant.includes(':p.')) {
      result.type = 'hgvs';
      const parts = variant.split(':');
      if (parts[0].startsWith('NM_')) {
        result.transcript = parts[0];
      }
      if (parts[1]) {
        if (parts[1].startsWith('c.')) {
          result.cdna = parts[1];
        } else if (parts[1].startsWith('p.')) {
          result.protein = parts[1];
        }
      }
    }
    // Check if VCF format (chr-pos-ref-alt)
    else if (variant.match(/^(chr)?[\dXY]+-\d+-[ACGT]+-[ACGT]+$/i)) {
      result.type = 'vcf';
      const parts = variant.replace('chr', '').split('-');
      result.chromosome = parts[0];
      result.position = parseInt(parts[1]);
      result.ref = parts[2];
      result.alt = parts[3];
    }
    // Check if rsID
    else if (variant.match(/^rs\d+$/i)) {
      result.type = 'rsid';
      result.rsid = variant;
    }

    return result;
  }

  /**
   * Get clinical significance from ClinVar
   */
  async getClinicalSignificance(variant) {
    try {
      // Search ClinVar
      const searchResponse = await this.ncbiClient.get('/esearch.fcgi', {
        params: {
          db: 'clinvar',
          term: variant,
          retmode: 'json',
          email: this.email,
          tool: this.tool
        }
      });

      const idList = searchResponse.data.esearchresult?.idlist || [];
      if (idList.length === 0) {
        return { status: 'not_found', message: 'No ClinVar entries found' };
      }

      // Fetch details
      const summaryResponse = await this.ncbiClient.get('/esummary.fcgi', {
        params: {
          db: 'clinvar',
          id: idList[0],
          retmode: 'json',
          email: this.email,
          tool: this.tool
        }
      });

      const variantData = summaryResponse.data.result?.[idList[0]];
      if (!variantData) {
        return { status: 'error', message: 'Failed to retrieve ClinVar data' };
      }

      return {
        clinvarId: idList[0],
        significance: variantData.clinical_significance || 'Not provided',
        reviewStatus: variantData.review_status || 'Not reviewed',
        conditions: this.parseConditions(variantData.trait_set),
        lastEvaluated: variantData.last_evaluated || 'Unknown',
        submissions: variantData.number_submitters || 0,
        goldStars: this.calculateGoldStars(variantData.review_status),
        conflicting: variantData.conflicted === 'yes',
        url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${idList[0]}/`
      };

    } catch (error) {
      console.error('ClinVar fetch error:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Get population frequency from gnomAD/MyVariant
   */
  async getPopulationFrequency(variantInfo) {
    try {
      let queryString = variantInfo.original;

      // Build appropriate query
      if (variantInfo.type === 'vcf') {
        queryString = `chr${variantInfo.chromosome}:g.${variantInfo.position}${variantInfo.ref}>${variantInfo.alt}`;
      } else if (variantInfo.type === 'rsid') {
        queryString = variantInfo.rsid;
      }

      // Query MyVariant.info (aggregates gnomAD and other databases)
      const response = await this.myvariantClient.get('/query', {
        params: {
          q: queryString,
          fields: 'gnomad_genome,gnomad_exome,cadd,dbnsfp,dbsnp,clinvar',
          size: 1
        }
      });

      const hit = response.data.hits?.[0];
      if (!hit) {
        return { status: 'not_found', message: 'No population data found' };
      }

      // Extract frequencies
      const gnomadGenome = hit.gnomad_genome || {};
      const gnomadExome = hit.gnomad_exome || {};

      return {
        rsid: hit.dbsnp?.rsid || null,
        gnomAD: {
          genome: {
            alleleFrequency: gnomadGenome.af?.af || 0,
            alleleCount: gnomadGenome.ac?.ac || 0,
            alleleNumber: gnomadGenome.an?.an || 0,
            homozygotes: gnomadGenome.nhomalt || 0
          },
          exome: {
            alleleFrequency: gnomadExome.af?.af || 0,
            alleleCount: gnomadExome.ac?.ac || 0,
            alleleNumber: gnomadExome.an?.an || 0,
            homozygotes: gnomadExome.nhomalt || 0
          }
        },
        populations: this.extractPopulationFrequencies(gnomadGenome, gnomadExome),
        maxPopulationAF: this.calculateMaxPopAF(gnomadGenome, gnomadExome),
        isRare: this.isRareVariant(gnomadGenome, gnomadExome),
        caddScore: hit.cadd?.phred || null
      };

    } catch (error) {
      console.error('Population frequency fetch error:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Get functional impact from VEP
   */
  async getFunctionalImpact(variant) {
    try {
      // Query Ensembl VEP
      const response = await axios.post(
        'https://rest.ensembl.org/vep/human/hgvs',
        { hgvs_notations: [variant] },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          timeout: this.timeout
        }
      );

      const vepData = response.data?.[0];
      if (!vepData) {
        return { status: 'not_found', message: 'No VEP data found' };
      }

      // Process transcript consequences
      const consequences = vepData.transcript_consequences || [];
      const mostSevere = vepData.most_severe_consequence;

      return {
        mostSevereConsequence: mostSevere,
        transcripts: consequences.map(tc => ({
          transcriptId: tc.transcript_id,
          gene: tc.gene_symbol,
          impact: tc.impact,
          consequence: tc.consequence_terms?.join(', '),
          proteinChange: tc.amino_acids ? `${tc.amino_acids}` : null,
          codonChange: tc.codons || null,
          exon: tc.exon,
          biotype: tc.biotype,
          canonical: tc.canonical === 1
        })),
        regulatoryConsequences: vepData.regulatory_feature_consequences || [],
        impacts: this.categorizeImpacts(consequences)
      };

    } catch (error) {
      console.error('VEP fetch error:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Get in silico predictions
   */
  async getInSilicoPredictions(variant) {
    try {
      // Query MyVariant for prediction scores
      const response = await this.myvariantClient.get('/query', {
        params: {
          q: variant,
          fields: 'dbnsfp.sift,dbnsfp.polyphen2,dbnsfp.mutationtaster,dbnsfp.revel,dbnsfp.cadd',
          size: 1
        }
      });

      const hit = response.data.hits?.[0];
      if (!hit?.dbnsfp) {
        return { status: 'not_found', message: 'No prediction data available' };
      }

      const dbnsfp = hit.dbnsfp;

      return {
        sift: {
          score: dbnsfp.sift?.score || null,
          prediction: dbnsfp.sift?.pred || null,
          interpretation: this.interpretSift(dbnsfp.sift?.score)
        },
        polyphen2: {
          score: dbnsfp.polyphen2?.hdiv?.score || null,
          prediction: dbnsfp.polyphen2?.hdiv?.pred || null,
          interpretation: this.interpretPolyphen(dbnsfp.polyphen2?.hdiv?.score)
        },
        cadd: {
          score: dbnsfp.cadd?.phred || null,
          interpretation: this.interpretCadd(dbnsfp.cadd?.phred)
        },
        revel: {
          score: dbnsfp.revel?.score || null,
          interpretation: this.interpretRevel(dbnsfp.revel?.score)
        },
        mutationTaster: {
          score: dbnsfp.mutationtaster?.score || null,
          prediction: dbnsfp.mutationtaster?.pred || null
        },
        consensus: this.generateConsensus(dbnsfp)
      };

    } catch (error) {
      console.error('Prediction fetch error:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Interpret variant using ACMG guidelines
   */
  interpretVariant(results) {
    const evidence = {
      pathogenic: [],
      benign: [],
      score: 0
    };

    // Check population frequency (BA1, BS1)
    if (results.population?.maxPopulationAF) {
      const maxAF = results.population.maxPopulationAF;
      if (maxAF > 0.05) {
        evidence.benign.push({ criteria: 'BA1', strength: 'standalone', description: 'AF > 5% in population' });
      } else if (maxAF > 0.01) {
        evidence.benign.push({ criteria: 'BS1', strength: 'strong', description: 'AF > 1% in population' });
      } else if (maxAF < 0.0001) {
        evidence.pathogenic.push({ criteria: 'PM2', strength: 'moderate', description: 'Absent/rare in population' });
      }
    }

    // Check functional impact (PVS1)
    if (results.functional?.mostSevereConsequence) {
      const consequence = results.functional.mostSevereConsequence;
      if (consequence.includes('stop_gained') || consequence.includes('frameshift')) {
        evidence.pathogenic.push({ criteria: 'PVS1', strength: 'very_strong', description: 'Null variant' });
      }
    }

    // Check in silico predictions (PP3, BP4)
    if (results.predictions?.consensus) {
      const consensus = results.predictions.consensus;
      if (consensus.pathogenic >= 3) {
        evidence.pathogenic.push({ criteria: 'PP3', strength: 'supporting', description: 'Multiple computational tools predict deleterious' });
      } else if (consensus.benign >= 3) {
        evidence.benign.push({ criteria: 'BP4', strength: 'supporting', description: 'Multiple computational tools predict benign' });
      }
    }

    // Check ClinVar (PP5, BP6)
    if (results.clinical?.significance) {
      const sig = results.clinical.significance.toLowerCase();
      if (sig.includes('pathogenic')) {
        evidence.pathogenic.push({ criteria: 'PP5', strength: 'supporting', description: 'ClinVar pathogenic' });
      } else if (sig.includes('benign')) {
        evidence.benign.push({ criteria: 'BP6', strength: 'supporting', description: 'ClinVar benign' });
      }
    }

    // Calculate final classification
    const classification = this.calculateACMGClassification(evidence);

    return {
      classification,
      evidence,
      confidenceLevel: this.calculateConfidence(evidence),
      recommendations: this.generateRecommendations(classification, evidence)
    };
  }

  /**
   * Calculate ACMG classification
   */
  calculateACMGClassification(evidence) {
    const pathogenicPoints = this.calculatePoints(evidence.pathogenic);
    const benignPoints = this.calculatePoints(evidence.benign);

    // Apply ACMG rules
    if (evidence.benign.some(e => e.criteria === 'BA1')) {
      return 'Benign';
    }

    if (pathogenicPoints.veryStrong >= 1
        && (pathogenicPoints.strong >= 1 || pathogenicPoints.moderate >= 2
         || (pathogenicPoints.moderate >= 1 && pathogenicPoints.supporting >= 1)
         || pathogenicPoints.supporting >= 2)) {
      return 'Pathogenic';
    }

    if (pathogenicPoints.strong >= 2
        || (pathogenicPoints.strong >= 1 && pathogenicPoints.moderate >= 1)
        || (pathogenicPoints.strong >= 1 && pathogenicPoints.supporting >= 2)) {
      return 'Likely pathogenic';
    }

    if (benignPoints.strong >= 1 && benignPoints.supporting >= 1) {
      return 'Likely benign';
    }

    if (benignPoints.standalone >= 1 || benignPoints.strong >= 2) {
      return 'Benign';
    }

    return 'Uncertain significance';
  }

  /**
   * Calculate evidence points
   */
  calculatePoints(evidenceList) {
    return {
      veryStrong: evidenceList.filter(e => e.strength === 'very_strong').length,
      strong: evidenceList.filter(e => e.strength === 'strong').length,
      moderate: evidenceList.filter(e => e.strength === 'moderate').length,
      supporting: evidenceList.filter(e => e.strength === 'supporting').length,
      standalone: evidenceList.filter(e => e.strength === 'standalone').length
    };
  }

  /**
   * Parse conditions from ClinVar
   */
  parseConditions(traitSet) {
    if (!traitSet) return [];

    // Parse trait set string
    if (typeof traitSet === 'string') {
      return traitSet.split('|').map(t => t.trim());
    }

    return [];
  }

  /**
   * Calculate ClinVar gold stars
   */
  calculateGoldStars(reviewStatus) {
    const statusMap = {
      'practice guideline': 4,
      'reviewed by expert panel': 3,
      'criteria provided, multiple submitters, no conflicts': 2,
      'criteria provided, single submitter': 1
    };

    return statusMap[reviewStatus?.toLowerCase()] || 0;
  }

  /**
   * Extract population frequencies
   */
  extractPopulationFrequencies(genome, exome) {
    const populations = {};

    // Process genome data
    if (genome.af) {
      Object.keys(genome.af).forEach(pop => {
        if (pop !== 'af') {
          populations[pop] = {
            genome: genome.af[pop] || 0,
            exome: exome.af?.[pop] || 0
          };
        }
      });
    }

    return populations;
  }

  /**
   * Calculate maximum population allele frequency
   */
  calculateMaxPopAF(genome, exome) {
    let maxAF = 0;

    if (genome.af) {
      Object.values(genome.af).forEach(af => {
        if (typeof af === 'number' && af > maxAF) {
          maxAF = af;
        }
      });
    }

    if (exome.af) {
      Object.values(exome.af).forEach(af => {
        if (typeof af === 'number' && af > maxAF) {
          maxAF = af;
        }
      });
    }

    return maxAF;
  }

  /**
   * Determine if variant is rare
   */
  isRareVariant(genome, exome) {
    const genomeAF = genome.af?.af || 0;
    const exomeAF = exome.af?.af || 0;
    const maxAF = Math.max(genomeAF, exomeAF);

    return maxAF < 0.01; // Less than 1%
  }

  /**
   * Categorize VEP impacts
   */
  categorizeImpacts(consequences) {
    const impacts = {
      high: [],
      moderate: [],
      low: [],
      modifier: []
    };

    consequences.forEach(c => {
      const impact = c.impact?.toLowerCase();
      if (impact && impacts[impact]) {
        impacts[impact].push({
          gene: c.gene_symbol,
          consequence: c.consequence_terms?.join(', ')
        });
      }
    });

    return impacts;
  }

  /**
   * Interpret SIFT score
   */
  interpretSift(score) {
    if (score === null || score === undefined) return 'Unknown';
    if (score < 0.05) return 'Deleterious';
    return 'Tolerated';
  }

  /**
   * Interpret PolyPhen-2 score
   */
  interpretPolyphen(score) {
    if (score === null || score === undefined) return 'Unknown';
    if (score >= 0.908) return 'Probably damaging';
    if (score >= 0.446) return 'Possibly damaging';
    return 'Benign';
  }

  /**
   * Interpret CADD score
   */
  interpretCadd(score) {
    if (score === null || score === undefined) return 'Unknown';
    if (score >= 30) return 'Highly deleterious';
    if (score >= 20) return 'Deleterious';
    if (score >= 10) return 'Possibly deleterious';
    return 'Likely benign';
  }

  /**
   * Interpret REVEL score
   */
  interpretRevel(score) {
    if (score === null || score === undefined) return 'Unknown';
    if (score >= 0.75) return 'Likely pathogenic';
    if (score >= 0.5) return 'Possibly pathogenic';
    return 'Likely benign';
  }

  /**
   * Generate prediction consensus
   */
  generateConsensus(dbnsfp) {
    let pathogenic = 0;
    let benign = 0;

    // Check each predictor
    if (dbnsfp.sift?.score < 0.05) pathogenic++;
    else if (dbnsfp.sift?.score !== undefined) benign++;

    if (dbnsfp.polyphen2?.hdiv?.score >= 0.446) pathogenic++;
    else if (dbnsfp.polyphen2?.hdiv?.score !== undefined) benign++;

    if (dbnsfp.cadd?.phred >= 20) pathogenic++;
    else if (dbnsfp.cadd?.phred !== undefined) benign++;

    if (dbnsfp.revel?.score >= 0.5) pathogenic++;
    else if (dbnsfp.revel?.score !== undefined) benign++;

    return {
      pathogenic,
      benign,
      verdict: pathogenic > benign ? 'Likely deleterious' : 'Likely benign'
    };
  }

  /**
   * Generate variant summary
   */
  generateVariantSummary(results) {
    return {
      classification: results.interpretation?.classification || 'Unknown',
      clinicalSignificance: results.clinical?.significance || 'Not available',
      populationFrequency: results.population?.maxPopulationAF
        ? `${(results.population.maxPopulationAF * 100).toFixed(4)}%`
        : 'Not found',
      functionalImpact: results.functional?.mostSevereConsequence || 'Unknown',
      predictionConsensus: results.predictions?.consensus?.verdict || 'No predictions',
      isRare: results.population?.isRare || false,
      hasClinicalData: results.clinical?.status !== 'not_found',
      confidence: results.interpretation?.confidenceLevel || 'Low'
    };
  }

  /**
   * Calculate confidence level
   */
  calculateConfidence(evidence) {
    const totalEvidence = evidence.pathogenic.length + evidence.benign.length;

    if (totalEvidence >= 5) return 'High';
    if (totalEvidence >= 3) return 'Moderate';
    if (totalEvidence >= 1) return 'Low';
    return 'Very Low';
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(classification, evidence) {
    const recommendations = [];

    if (classification === 'Uncertain significance') {
      recommendations.push('Consider additional functional studies');
      recommendations.push('Check for segregation in family members');
      recommendations.push('Review updated population databases');
    }

    if (classification.includes('pathogenic')) {
      recommendations.push('Clinical correlation recommended');
      recommendations.push('Consider genetic counseling');
      recommendations.push('Screen family members if appropriate');
    }

    if (evidence.pathogenic.length === 0 && evidence.benign.length === 0) {
      recommendations.push('Insufficient evidence for classification');
      recommendations.push('Additional data sources needed');
    }

    return recommendations;
  }
}

// Export for use in MCP server
export default VariantAnalysisClient;
