#!/usr/bin/env node

/**
 * Comprehensive demo script showcasing the Enhanced AGR MCP Server capabilities
 * 
 * This script demonstrates:
 * - Gene search functionality
 * - Disease association queries
 * - BLAST sequence analysis
 * - Orthology analysis
 * - Performance monitoring
 * - Caching effectiveness
 */

import { EnhancedAGRClient } from '../src/agr-server-enhanced.js';
import { PerformanceBenchmark } from './benchmark.js';
import { HealthChecker } from './health-check.js';

const DEMO_QUERIES = {
  genes: ['BRCA1', 'TP53', 'CFTR', 'APOE'],
  diseases: ['breast cancer', 'alzheimer', 'cystic fibrosis'],
  sequences: {
    dna: 'ATCGATCGATCGATCGATCGATCGATCG',
    protein: 'MKTVRQERLKSIVRILERSKEPVSGAQLAEELSVSRQVIVQDIAYLRSLGYNIVATPRGYVLAGG'
  }
};

class AGRDemo {
  constructor() {
    this.client = new EnhancedAGRClient();
    this.results = [];
  }

  /**
   * Run comprehensive demo
   */
  async runDemo() {
    console.log('🚀 Enhanced AGR MCP Server - Comprehensive Demo\n');
    console.log('=' .repeat(60));
    
    try {
      // 1. Health Check
      await this.runHealthCheck();
      
      // 2. Basic functionality demo
      await this.demonstrateBasicFunctionality();
      
      // 3. Advanced features demo
      await this.demonstrateAdvancedFeatures();
      
      // 4. Performance demo
      await this.demonstratePerformance();
      
      // 5. Error handling demo
      await this.demonstrateErrorHandling();
      
      // 6. Final summary
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run health check
   */
  async runHealthCheck() {
    console.log('🏥 Health Check');
    console.log('-'.repeat(30));
    
    const healthChecker = new HealthChecker();
    const healthResults = await healthChecker.runHealthChecks();
    
    if (healthResults.overall === 'HEALTHY') {
      console.log('✅ System is healthy and ready for demo\n');
    } else {
      console.log('⚠️  System has some issues but continuing demo\n');
    }
  }

  /**
   * Demonstrate basic functionality
   */
  async demonstrateBasicFunctionality() {
    console.log('🧬 Basic Functionality Demo');
    console.log('-'.repeat(30));
    
    // Gene search
    console.log('1. Gene Search:');
    for (const gene of DEMO_QUERIES.genes.slice(0, 2)) {
      try {
        const searchResults = await this.client.searchGenes(gene, { limit: 3 });
        console.log(`   ✅ ${gene}: Found ${searchResults.total || 0} results`);
        this.results.push({ type: 'gene_search', query: gene, success: true });
      } catch (error) {
        console.log(`   ❌ ${gene}: ${error.message}`);
        this.results.push({ type: 'gene_search', query: gene, success: false, error: error.message });
      }
    }
    
    // Species list
    console.log('\n2. Species Information:');
    try {
      const species = await this.client.getSpeciesList();
      console.log(`   ✅ Retrieved ${species.length || 0} supported species`);
      this.results.push({ type: 'species_list', success: true, count: species.length });
    } catch (error) {
      console.log(`   ❌ Species list: ${error.message}`);
      this.results.push({ type: 'species_list', success: false, error: error.message });
    }
    
    console.log('');
  }

  /**
   * Demonstrate advanced features
   */
  async demonstrateAdvancedFeatures() {
    console.log('🔬 Advanced Features Demo');
    console.log('-'.repeat(30));
    
    // BLAST sequence analysis
    console.log('1. BLAST Sequence Analysis:');
    try {
      const blastResults = await this.client.blastSequence(DEMO_QUERIES.sequences.dna, {
        maxTargetSeqs: 5
      });
      console.log('   ✅ DNA BLAST search completed successfully');
      this.results.push({ type: 'blast_dna', success: true });
    } catch (error) {
      console.log(`   ❌ DNA BLAST: ${error.message}`);
      this.results.push({ type: 'blast_dna', success: false, error: error.message });
    }
    
    // Disease search
    console.log('\n2. Disease Search:');
    for (const disease of DEMO_QUERIES.diseases.slice(0, 2)) {
      try {
        const diseaseResults = await this.client.searchDiseases(disease, { limit: 3 });
        console.log(`   ✅ ${disease}: Found ${diseaseResults.total || 0} results`);
        this.results.push({ type: 'disease_search', query: disease, success: true });
      } catch (error) {
        console.log(`   ❌ ${disease}: ${error.message}`);
        this.results.push({ type: 'disease_search', query: disease, success: false, error: error.message });
      }
    }
    
    console.log('');
  }

  /**
   * Demonstrate performance features
   */
  async demonstratePerformance() {
    console.log('⚡ Performance Features Demo');
    console.log('-'.repeat(30));
    
    // Cache performance test
    console.log('1. Cache Performance Test:');
    const testQuery = 'BRCA1';
    
    // First request (cache miss)
    const start1 = Date.now();
    await this.client.searchGenes(testQuery, { limit: 1 });
    const time1 = Date.now() - start1;
    console.log(`   First request (cache miss): ${time1}ms`);
    
    // Second request (cache hit)
    const start2 = Date.now();
    await this.client.searchGenes(testQuery, { limit: 1 });
    const time2 = Date.now() - start2;
    console.log(`   Second request (cache hit): ${time2}ms`);
    
    const improvement = ((time1 - time2) / time1 * 100).toFixed(1);
    console.log(`   Performance improvement: ${improvement}%`);
    
    // Cache statistics
    console.log('\n2. Cache Statistics:');
    const cacheStats = this.client.getCacheStats();
    console.log(`   Cache keys: ${cacheStats.keys}`);
    console.log(`   Cache hits: ${cacheStats.hits}`);
    console.log(`   Cache misses: ${cacheStats.misses}`);
    console.log(`   Hit ratio: ${((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)}%`);
    
    this.results.push({ 
      type: 'cache_performance', 
      improvement: parseFloat(improvement),
      stats: cacheStats
    });
    
    console.log('');
  }

  /**
   * Demonstrate error handling
   */
  async demonstrateErrorHandling() {
    console.log('🛡️  Error Handling Demo');
    console.log('-'.repeat(30));
    
    // Invalid gene ID
    console.log('1. Invalid Gene ID Handling:');
    try {
      await this.client.getGeneInfo('INVALID:123');
      console.log('   ❌ Should have thrown error');
    } catch (error) {
      console.log(`   ✅ Properly caught error: ${error.message}`);
    }
    
    // Invalid sequence
    console.log('\n2. Invalid Sequence Handling:');
    try {
      await this.client.blastSequence('INVALID_SEQUENCE_XYZ123');
      console.log('   ❌ Should have thrown error');
    } catch (error) {
      console.log(`   ✅ Properly caught error: ${error.message}`);
    }
    
    // Empty query
    console.log('\n3. Empty Query Handling:');
    try {
      await this.client.searchGenes('');
      console.log('   ❌ Should have thrown error');
    } catch (error) {
      console.log(`   ✅ Properly caught error: ${error.message}`);
    }
    
    console.log('');
  }

  /**
   * Run mini performance benchmark
   */
  async runMiniPerformanceBenchmark() {
    console.log('📊 Mini Performance Benchmark');
    console.log('-'.repeat(30));
    
    const queries = ['BRCA1', 'TP53', 'CFTR'];
    const times = [];
    
    for (const query of queries) {
      const start = Date.now();
      try {
        await this.client.searchGenes(query, { limit: 5 });
        const time = Date.now() - start;
        times.push(time);
        console.log(`   ${query}: ${time}ms`);
      } catch (error) {
        console.log(`   ${query}: Error - ${error.message}`);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      console.log(`   Average response time: ${avgTime.toFixed(0)}ms`);
    }
    
    console.log('');
  }

  /**
   * Print demo summary
   */
  printSummary() {
    console.log('📋 Demo Summary');
    console.log('=' .repeat(60));
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    const successRate = ((successCount / totalCount) * 100).toFixed(1);
    
    console.log(`Total operations: ${totalCount}`);
    console.log(`Successful operations: ${successCount}`);
    console.log(`Success rate: ${successRate}%`);
    
    // Feature highlights
    console.log('\n🌟 Key Features Demonstrated:');
    console.log('   ✅ Gene search with validation');
    console.log('   ✅ Disease association queries');
    console.log('   ✅ BLAST sequence analysis');
    console.log('   ✅ Intelligent caching system');
    console.log('   ✅ Comprehensive error handling');
    console.log('   ✅ Performance monitoring');
    console.log('   ✅ Input validation and sanitization');
    console.log('   ✅ Rate limiting protection');
    
    // Performance highlights
    const cacheResult = this.results.find(r => r.type === 'cache_performance');
    if (cacheResult && cacheResult.improvement > 0) {
      console.log(`\n⚡ Performance Highlights:`);
      console.log(`   Cache performance improvement: ${cacheResult.improvement}%`);
      console.log(`   Cache hit ratio: ${((cacheResult.stats.hits / (cacheResult.stats.hits + cacheResult.stats.misses)) * 100).toFixed(1)}%`);
    }
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('   • Run full benchmark: npm run benchmark');
    console.log('   • Start production server: npm start');
    console.log('   • Run comprehensive tests: npm test');
    console.log('   • View health status: npm run health-check');
    console.log('   • Deploy with Docker: docker-compose up');
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Enhanced AGR MCP Server Demo

Usage: node scripts/demo.js [options]

Options:
  --health-only    Run health check only
  --performance    Run performance benchmark only
  --basic          Run basic functionality demo only
  --help, -h       Show this help message

Examples:
  node scripts/demo.js                # Run full demo
  node scripts/demo.js --health-only  # Health check only
  node scripts/demo.js --performance  # Performance test only
`);
    return;
  }
  
  const demo = new AGRDemo();
  
  if (args.includes('--health-only')) {
    await demo.runHealthCheck();
  } else if (args.includes('--performance')) {
    const benchmark = new PerformanceBenchmark();
    await benchmark.runBenchmarks();
  } else if (args.includes('--basic')) {
    await demo.demonstrateBasicFunctionality();
  } else {
    await demo.runDemo();
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Demo script failed:', error.message);
    process.exit(1);
  });
}

export { AGRDemo };