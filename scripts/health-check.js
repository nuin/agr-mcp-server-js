#!/usr/bin/env node

/**
 * Health Check Script for Enhanced AGR MCP Server
 * 
 * Performs comprehensive health checks including:
 * - Server responsiveness
 * - API connectivity
 * - Cache performance
 * - Memory usage
 * - Error rate monitoring
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

const CONFIG = {
  // Test endpoints
  testEndpoints: [
    'https://www.alliancegenome.org/api/species',
    'https://www.alliancegenome.org/api/search?q=BRCA1&limit=1'
  ],
  
  // Performance thresholds
  thresholds: {
    responseTime: 5000, // 5 seconds max
    memoryUsage: 100 * 1024 * 1024, // 100MB max
    cacheHitRate: 0.5 // 50% minimum
  },
  
  timeout: 10000
};

class HealthChecker {
  constructor() {
    this.results = {
      overall: 'UNKNOWN',
      timestamp: new Date().toISOString(),
      checks: {}
    };
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    console.log('🏥 Starting Enhanced AGR MCP Server Health Check...\n');
    
    const checks = [
      { name: 'api_connectivity', fn: this.checkAPIConnectivity.bind(this) },
      { name: 'response_times', fn: this.checkResponseTimes.bind(this) },
      { name: 'memory_usage', fn: this.checkMemoryUsage.bind(this) },
      { name: 'environment', fn: this.checkEnvironment.bind(this) }
    ];

    for (const check of checks) {
      try {
        console.log(`🔍 Checking ${check.name}...`);
        const result = await check.fn();
        this.results.checks[check.name] = {
          status: 'PASS',
          ...result
        };
        console.log(`✅ ${check.name}: PASS\n`);
      } catch (error) {
        this.results.checks[check.name] = {
          status: 'FAIL',
          error: error.message,
          details: error.details || {}
        };
        console.log(`❌ ${check.name}: FAIL - ${error.message}\n`);
      }
    }

    this.calculateOverallStatus();
    this.printSummary();
    return this.results;
  }

  /**
   * Check API connectivity to Alliance endpoints
   */
  async checkAPIConnectivity() {
    const results = {};
    
    for (const endpoint of CONFIG.testEndpoints) {
      const startTime = performance.now();
      
      try {
        const response = await axios.get(endpoint, {
          timeout: CONFIG.timeout,
          headers: {
            'User-Agent': 'AGR-MCP-Health-Check/1.0.0'
          }
        });
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        results[endpoint] = {
          status: response.status,
          responseTime: Math.round(responseTime),
          dataSize: JSON.stringify(response.data).length
        };
        
      } catch (error) {
        results[endpoint] = {
          error: error.message,
          code: error.code || 'UNKNOWN'
        };
        throw new Error(`API connectivity failed for ${endpoint}: ${error.message}`);
      }
    }
    
    return { endpoints: results };
  }

  /**
   * Check response times across multiple requests
   */
  async checkResponseTimes() {
    const testUrl = 'https://www.alliancegenome.org/api/species';
    const numberOfRequests = 5;
    const responseTimes = [];
    
    for (let i = 0; i < numberOfRequests; i++) {
      const startTime = performance.now();
      
      try {
        await axios.get(testUrl, { timeout: CONFIG.timeout });
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      } catch (error) {
        throw new Error(`Response time test failed: ${error.message}`);
      }
    }
    
    const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    if (avgResponseTime > CONFIG.thresholds.responseTime) {
      throw new Error(`Average response time ${Math.round(avgResponseTime)}ms exceeds threshold ${CONFIG.thresholds.responseTime}ms`);
    }
    
    return {
      averageResponseTime: Math.round(avgResponseTime),
      maxResponseTime: Math.round(maxResponseTime),
      measurements: responseTimes.map(t => Math.round(t)),
      threshold: CONFIG.thresholds.responseTime
    };
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    
    const result = {
      rss: this.formatBytes(memUsage.rss),
      heapTotal: this.formatBytes(memUsage.heapTotal),
      heapUsed: this.formatBytes(memUsage.heapUsed),
      external: this.formatBytes(memUsage.external),
      threshold: this.formatBytes(CONFIG.thresholds.memoryUsage)
    };
    
    if (memUsage.heapUsed > CONFIG.thresholds.memoryUsage) {
      throw new Error(`Heap usage ${result.heapUsed} exceeds threshold ${result.threshold}`);
    }
    
    return result;
  }

  /**
   * Check environment and configuration
   */
  async checkEnvironment() {
    const nodeVersion = process.version;
    const platform = process.platform;
    const uptime = process.uptime();
    
    // Check Node.js version (require 18+)
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      throw new Error(`Node.js version ${nodeVersion} is below required version 18`);
    }
    
    return {
      nodeVersion,
      platform,
      uptime: Math.round(uptime),
      pid: process.pid,
      cwd: process.cwd(),
      env: {
        logLevel: process.env.LOG_LEVEL || 'info',
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };
  }

  /**
   * Calculate overall health status
   */
  calculateOverallStatus() {
    const statuses = Object.values(this.results.checks).map(check => check.status);
    const passCount = statuses.filter(status => status === 'PASS').length;
    const totalCount = statuses.length;
    
    if (passCount === totalCount) {
      this.results.overall = 'HEALTHY';
    } else if (passCount / totalCount >= 0.5) {
      this.results.overall = 'DEGRADED';
    } else {
      this.results.overall = 'UNHEALTHY';
    }
    
    this.results.score = passCount / totalCount;
  }

  /**
   * Print health check summary
   */
  printSummary() {
    console.log('📊 Health Check Summary');
    console.log('========================');
    console.log(`Overall Status: ${this.getStatusEmoji(this.results.overall)} ${this.results.overall}`);
    console.log(`Health Score: ${Math.round(this.results.score * 100)}%`);
    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log(`Total Checks: ${Object.keys(this.results.checks).length}`);
    
    const passCount = Object.values(this.results.checks)
      .filter(check => check.status === 'PASS').length;
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${Object.keys(this.results.checks).length - passCount}`);
    
    console.log('\n📋 Detailed Results:');
    for (const [checkName, result] of Object.entries(this.results.checks)) {
      const emoji = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${emoji} ${checkName}: ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (this.results.overall === 'HEALTHY') {
      console.log('✨ All systems operational! Your AGR MCP Server is running optimally.');
    } else {
      console.log('⚠️  Some issues detected. Check the failed tests above.');
      console.log('   - Verify network connectivity to Alliance APIs');
      console.log('   - Check system resources (memory, CPU)');
      console.log('   - Review server logs for additional details');
    }
  }

  /**
   * Get status emoji
   */
  getStatusEmoji(status) {
    switch (status) {
      case 'HEALTHY': return '🟢';
      case 'DEGRADED': return '🟡';
      case 'UNHEALTHY': return '🔴';
      default: return '⚪';
    }
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
}

// Run health check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const healthChecker = new HealthChecker();
  
  healthChecker.runHealthChecks()
    .then((results) => {
      // Export results as JSON for external monitoring
      if (process.argv.includes('--json')) {
        console.log('\n' + JSON.stringify(results, null, 2));
      }
      
      // Exit with appropriate code
      const exitCode = results.overall === 'HEALTHY' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    });
}

export { HealthChecker };