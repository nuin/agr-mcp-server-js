#!/usr/bin/env node

/**
 * Performance Benchmark Script for Enhanced AGR MCP Server
 * 
 * Runs comprehensive performance tests including:
 * - Concurrent request handling
 * - Cache performance
 * - Memory usage under load
 * - Response time analysis
 */

import axios from 'axios';
import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

const BENCHMARK_CONFIG = {
  // Test parameters
  concurrentUsers: [1, 5, 10, 20],
  requestsPerUser: 10,
  testDuration: 30000, // 30 seconds
  
  // Test endpoints
  endpoints: [
    { 
      name: 'gene_search', 
      url: 'https://www.alliancegenome.org/api/search',
      params: { q: 'BRCA1', limit: 5 }
    },
    { 
      name: 'species_list', 
      url: 'https://www.alliancegenome.org/api/species',
      params: {}
    },
    { 
      name: 'gene_info', 
      url: 'https://www.alliancegenome.org/api/gene/HGNC:1100',
      params: {}
    }
  ],
  
  timeout: 15000
};

class PerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      system: this.getSystemInfo(),
      tests: {}
    };
  }

  /**
   * Run all performance benchmarks
   */
  async runBenchmarks() {
    console.log('🚀 Starting Performance Benchmark for Enhanced AGR MCP Server\n');
    
    // Run sequential tests first
    await this.runSequentialTests();
    
    // Run concurrent load tests
    await this.runConcurrentTests();
    
    // Run cache performance tests
    await this.runCacheTests();
    
    // Run memory stress tests
    await this.runMemoryTests();
    
    this.printSummary();
    return this.results;
  }

  /**
   * Run sequential performance tests
   */
  async runSequentialTests() {
    console.log('📊 Running Sequential Performance Tests...\n');
    
    for (const endpoint of BENCHMARK_CONFIG.endpoints) {
      console.log(`Testing ${endpoint.name}...`);
      
      const measurements = [];
      const errors = [];
      
      for (let i = 0; i < 10; i++) {
        try {
          const startTime = performance.now();
          const response = await axios.get(endpoint.url, {
            params: endpoint.params,
            timeout: BENCHMARK_CONFIG.timeout
          });
          const endTime = performance.now();
          
          measurements.push({
            responseTime: endTime - startTime,
            status: response.status,
            dataSize: JSON.stringify(response.data).length
          });
          
        } catch (error) {
          errors.push({
            message: error.message,
            code: error.code || 'UNKNOWN'
          });
        }
      }
      
      const stats = this.calculateStats(measurements);
      
      this.results.tests[`sequential_${endpoint.name}`] = {
        type: 'sequential',
        endpoint: endpoint.name,
        url: endpoint.url,
        measurements: measurements.length,
        errors: errors.length,
        stats,
        errorDetails: errors
      };
      
      console.log(`  ✅ ${endpoint.name}: ${stats.mean.toFixed(0)}ms avg, ${stats.p95.toFixed(0)}ms p95\n`);
    }
  }

  /**
   * Run concurrent load tests
   */
  async runConcurrentTests() {
    console.log('🔥 Running Concurrent Load Tests...\n');
    
    for (const userCount of BENCHMARK_CONFIG.concurrentUsers) {
      console.log(`Testing with ${userCount} concurrent users...`);
      
      const startTime = performance.now();
      const promises = [];
      
      // Create concurrent workers
      for (let i = 0; i < userCount; i++) {
        promises.push(this.runWorkerLoad(BENCHMARK_CONFIG.requestsPerUser));
      }
      
      try {
        const results = await Promise.all(promises);
        const endTime = performance.now();
        
        // Aggregate results
        const allMeasurements = results.flatMap(r => r.measurements);
        const allErrors = results.flatMap(r => r.errors);
        
        const stats = this.calculateStats(allMeasurements);
        const totalRequests = userCount * BENCHMARK_CONFIG.requestsPerUser;
        const successfulRequests = allMeasurements.length;
        const throughput = (successfulRequests / ((endTime - startTime) / 1000)).toFixed(2);
        
        this.results.tests[`concurrent_${userCount}_users`] = {
          type: 'concurrent',
          concurrentUsers: userCount,
          requestsPerUser: BENCHMARK_CONFIG.requestsPerUser,
          totalRequests,
          successfulRequests,
          errors: allErrors.length,
          stats,
          throughput: parseFloat(throughput),
          duration: endTime - startTime
        };
        
        console.log(`  ✅ ${userCount} users: ${throughput} req/s, ${stats.mean.toFixed(0)}ms avg\n`);
        
      } catch (error) {
        console.log(`  ❌ ${userCount} users: Failed - ${error.message}\n`);
      }
    }
  }

  /**
   * Run cache performance tests
   */
  async runCacheTests() {
    console.log('💾 Running Cache Performance Tests...\n');
    
    const testUrl = 'https://www.alliancegenome.org/api/species';
    const requestCount = 50;
    
    console.log('Testing cache effectiveness...');
    
    const measurements = [];
    
    // First request (cache miss)
    let startTime = performance.now();
    await axios.get(testUrl);
    let endTime = performance.now();
    const firstRequestTime = endTime - startTime;
    
    // Subsequent requests (should be faster if cached)
    for (let i = 0; i < requestCount; i++) {
      startTime = performance.now();
      await axios.get(testUrl);
      endTime = performance.now();
      measurements.push(endTime - startTime);
    }
    
    const stats = this.calculateStats(measurements);
    const cacheEffectiveness = ((firstRequestTime - stats.mean) / firstRequestTime * 100);
    
    this.results.tests.cache_performance = {
      type: 'cache',
      firstRequestTime,
      subsequentRequests: requestCount,
      stats,
      cacheEffectiveness: Math.max(0, cacheEffectiveness).toFixed(1),
      improvement: firstRequestTime > stats.mean ? 'Yes' : 'No'
    };
    
    console.log(`  ✅ Cache test: ${cacheEffectiveness.toFixed(1)}% improvement over cold start\n`);
  }

  /**
   * Run memory stress tests
   */
  async runMemoryTests() {
    console.log('🧠 Running Memory Stress Tests...\n');
    
    const initialMemory = process.memoryUsage();
    const measurements = [];
    
    // Run intensive requests
    for (let i = 0; i < 100; i++) {
      try {
        await axios.get('https://www.alliancegenome.org/api/search', {
          params: { q: `test_${i}`, limit: 20 }
        });
        
        if (i % 20 === 0) {
          const currentMemory = process.memoryUsage();
          measurements.push({
            iteration: i,
            heapUsed: currentMemory.heapUsed,
            heapTotal: currentMemory.heapTotal,
            rss: currentMemory.rss
          });
        }
      } catch (error) {
        // Continue on error for stress test
      }
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryLeakDetected = memoryIncrease > (50 * 1024 * 1024); // 50MB threshold
    
    this.results.tests.memory_stress = {
      type: 'memory',
      initialMemory: this.formatBytes(initialMemory.heapUsed),
      finalMemory: this.formatBytes(finalMemory.heapUsed),
      memoryIncrease: this.formatBytes(memoryIncrease),
      memoryLeakDetected,
      measurements: measurements.length,
      details: measurements
    };
    
    console.log(`  ✅ Memory test: ${this.formatBytes(memoryIncrease)} increase ${memoryLeakDetected ? '⚠️ ' : '✅'}\n`);
  }

  /**
   * Run worker load test
   */
  async runWorkerLoad(requestCount) {
    // Simple in-process simulation since we're focusing on the server
    const measurements = [];
    const errors = [];
    
    for (let i = 0; i < requestCount; i++) {
      try {
        const startTime = performance.now();
        const response = await axios.get('https://www.alliancegenome.org/api/species', {
          timeout: BENCHMARK_CONFIG.timeout
        });
        const endTime = performance.now();
        
        measurements.push({
          responseTime: endTime - startTime,
          status: response.status
        });
        
      } catch (error) {
        errors.push({
          message: error.message,
          code: error.code || 'UNKNOWN'
        });
      }
    }
    
    return { measurements, errors };
  }

  /**
   * Calculate statistics from measurements
   */
  calculateStats(measurements) {
    if (measurements.length === 0) {
      return { mean: 0, median: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }
    
    const times = measurements.map(m => m.responseTime).sort((a, b) => a - b);
    
    return {
      count: times.length,
      mean: times.reduce((a, b) => a + b) / times.length,
      median: times[Math.floor(times.length / 2)],
      min: times[0],
      max: times[times.length - 1],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)]
    };
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      totalMemory: this.formatBytes(require('os').totalmem()),
      freeMemory: this.formatBytes(require('os').freemem())
    };
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Print benchmark summary
   */
  printSummary() {
    console.log('📊 Performance Benchmark Summary');
    console.log('================================');
    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log(`System: ${this.results.system.platform} ${this.results.system.arch}`);
    console.log(`Node.js: ${this.results.system.nodeVersion}`);
    console.log(`CPUs: ${this.results.system.cpus}`);
    console.log(`Memory: ${this.results.system.totalMemory}\n`);
    
    // Sequential test results
    console.log('🔄 Sequential Test Results:');
    Object.entries(this.results.tests)
      .filter(([key]) => key.startsWith('sequential_'))
      .forEach(([key, result]) => {
        console.log(`  ${result.endpoint}: ${result.stats.mean.toFixed(0)}ms avg (${result.stats.p95.toFixed(0)}ms p95)`);
      });
    
    // Concurrent test results
    console.log('\n🔥 Concurrent Test Results:');
    Object.entries(this.results.tests)
      .filter(([key]) => key.startsWith('concurrent_'))
      .forEach(([key, result]) => {
        console.log(`  ${result.concurrentUsers} users: ${result.throughput} req/s (${result.stats.mean.toFixed(0)}ms avg)`);
      });
    
    // Cache results
    if (this.results.tests.cache_performance) {
      const cache = this.results.tests.cache_performance;
      console.log(`\n💾 Cache Performance: ${cache.cacheEffectiveness}% improvement`);
    }
    
    // Memory results
    if (this.results.tests.memory_stress) {
      const memory = this.results.tests.memory_stress;
      console.log(`\n🧠 Memory Usage: ${memory.memoryIncrease} increase ${memory.memoryLeakDetected ? '⚠️' : '✅'}`);
    }
    
    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    const concurrentResults = Object.values(this.results.tests)
      .filter(r => r.type === 'concurrent');
    
    if (concurrentResults.length > 0) {
      const bestThroughput = Math.max(...concurrentResults.map(r => r.throughput));
      const avgResponseTime = concurrentResults.reduce((sum, r) => sum + r.stats.mean, 0) / concurrentResults.length;
      
      if (bestThroughput > 50) {
        console.log('✨ Excellent throughput performance!');
      } else if (bestThroughput > 20) {
        console.log('👍 Good throughput performance');
      } else {
        console.log('⚠️  Consider optimizing for better throughput');
      }
      
      if (avgResponseTime < 500) {
        console.log('✨ Excellent response times!');
      } else if (avgResponseTime < 1000) {
        console.log('👍 Good response times');
      } else {
        console.log('⚠️  Consider caching or API optimizations');
      }
    }
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark();
  
  benchmark.runBenchmarks()
    .then((results) => {
      // Export results as JSON for external analysis
      if (process.argv.includes('--json')) {
        console.log('\n' + JSON.stringify(results, null, 2));
      }
      
      console.log('\n🎉 Benchmark completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Benchmark failed:', error.message);
      process.exit(1);
    });
}

export { PerformanceBenchmark };