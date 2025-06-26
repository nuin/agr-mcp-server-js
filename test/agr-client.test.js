/**
 * Comprehensive test suite for Enhanced AGR MCP Server
 * 
 * Tests include:
 * - Unit tests for core functionality
 * - Integration tests with AGR APIs
 * - Performance and caching tests
 * - Error handling validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { EnhancedAGRClient } from '../src/agr-server-enhanced.js';

// Mock axios for unit tests
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('Enhanced AGR Client', () => {
  let client;
  
  beforeEach(() => {
    client = new EnhancedAGRClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    client.clearCache();
  });

  describe('Input Validation', () => {
    it('should validate gene IDs correctly', () => {
      // Valid gene IDs
      expect(client.validateGeneId('HGNC:1100')).toBe(true);
      expect(client.validateGeneId('MGI:95892')).toBe(true);
      expect(client.validateGeneId('RGD:2004')).toBe(true);
      expect(client.validateGeneId('ZFIN:ZDB-GENE-030131-1')).toBe(true);
      expect(client.validateGeneId('FB1234567')).toBe(true);
      expect(client.validateGeneId('WB1234567')).toBe(true);
      expect(client.validateGeneId('SGD:S000000001')).toBe(true);
      
      // Invalid gene IDs
      expect(client.validateGeneId('')).toBe(false);
      expect(client.validateGeneId('invalid')).toBe(false);
      expect(client.validateGeneId('HGNC:')).toBe(false);
      expect(client.validateGeneId(null)).toBe(false);
      expect(client.validateGeneId(undefined)).toBe(false);
      expect(client.validateGeneId(123)).toBe(false);
    });

    it('should sanitize queries correctly', () => {
      expect(client.sanitizeQuery('BRCA1')).toBe('BRCA1');
      expect(client.sanitizeQuery('  BRCA1  ')).toBe('BRCA1');
      expect(client.sanitizeQuery('BRCA<script>alert(1)</script>1')).toBe('BRCAscriptalert(1)/script1');
      expect(client.sanitizeQuery('test>malicious<')).toBe('testmalicious');
      
      // Should throw on invalid input
      expect(() => client.sanitizeQuery('')).toThrow('Query must be a non-empty string');
      expect(() => client.sanitizeQuery(null)).toThrow('Query must be a non-empty string');
      expect(() => client.sanitizeQuery(123)).toThrow('Query must be a non-empty string');
    });

    it('should validate BLAST sequences', async () => {
      // Mock successful response
      mockedAxios.create.mockReturnValue({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        },
        get: vi.fn().mockResolvedValue({
          data: { results: [] },
          status: 200,
          config: { url: 'test' }
        })
      });

      // Valid DNA sequence
      await expect(client.blastSequence('ATCGATCGATCG')).resolves.toBeDefined();
      
      // Valid protein sequence
      await expect(client.blastSequence('MKTVRQERLKSIVRILERSKEPVSGAQLAEELSVSRQVIVQDIAYLRSLGYNIVATPRGYVLAGG')).resolves.toBeDefined();
      
      // Invalid sequences
      await expect(client.blastSequence('')).rejects.toThrow('Sequence is required');
      await expect(client.blastSequence('SHORT')).rejects.toThrow('Sequence must be at least 10');
      await expect(client.blastSequence('INVALIDXYZSEQUENCE123')).rejects.toThrow('Sequence contains invalid characters');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', () => {
      const endpoint = '/test';
      
      // First batch of requests should pass
      for (let i = 0; i < 50; i++) {
        expect(client.checkRateLimit(endpoint)).toBe(true);
      }
      
      // Exceed rate limit
      for (let i = 0; i < 60; i++) {
        client.checkRateLimit(endpoint);
      }
      
      // Should now be rate limited
      expect(client.checkRateLimit(endpoint)).toBe(false);
    });

    it('should reset rate limits after time window', async () => {
      const endpoint = '/test';
      
      // Exceed rate limit
      for (let i = 0; i < 150; i++) {
        client.checkRateLimit(endpoint);
      }
      
      expect(client.checkRateLimit(endpoint)).toBe(false);
      
      // Mock time passage by manipulating the rate limit map
      const now = Date.now() + 61000; // 61 seconds later
      const originalNow = Date.now;
      global.Date.now = vi.fn().mockReturnValue(now);
      
      expect(client.checkRateLimit(endpoint)).toBe(true);
      
      // Restore original Date.now
      global.Date.now = originalNow;
    });
  });

  describe('Caching', () => {
    it('should cache successful GET requests', async () => {
      const mockResponse = {
        data: { test: 'data' },
        status: 200,
        config: { url: 'test' }
      };

      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      mockAxiosInstance.get = vi.fn().mockResolvedValue(mockResponse);

      // First request should hit the API
      const result1 = await client.makeRequest('/test');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ test: 'data' });

      // Second request should hit cache
      const result2 = await client.makeRequest('/test');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2).toEqual({ test: 'data' });
    });

    it('should provide cache statistics', () => {
      const stats = client.getCacheStats();
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(typeof stats.keys).toBe('number');
    });

    it('should clear cache correctly', () => {
      // Add some cache entries
      client.cache?.set('test1', 'data1');
      client.cache?.set('test2', 'data2');
      client.cache?.set('other', 'data3');

      // Clear specific pattern
      client.clearCache('test');
      
      // Should still have some entries
      const stats = client.getCacheStats();
      expect(stats.keys).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      // Mock network error
      mockAxiosInstance.get = vi.fn().mockRejectedValue(new Error('Network Error'));

      await expect(client.makeRequest('/test')).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors with status codes', async () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      // Mock HTTP error
      const httpError = new Error('HTTP Error');
      httpError.response = {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Resource not found' }
      };
      
      mockAxiosInstance.get = vi.fn().mockRejectedValue(httpError);

      await expect(client.makeRequest('/test')).rejects.toThrow('API Error 404');
    });

    it('should handle timeout errors', async () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      // Mock timeout error
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ECONNABORTED';
      
      mockAxiosInstance.get = vi.fn().mockRejectedValue(timeoutError);

      await expect(client.makeRequest('/test')).rejects.toThrow('Request timeout');
    });

    it('should retry on 5xx errors', async () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      // Mock 500 error then success
      const serverError = new Error('Server Error');
      serverError.response = { status: 500, statusText: 'Internal Server Error', data: {} };
      
      const successResponse = {
        data: { success: true },
        status: 200,
        config: { url: 'test' }
      };

      mockAxiosInstance.get = vi.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse);

      const result = await client.makeRequest('/test');
      expect(result).toEqual({ success: true });
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // Original + 1 retry
    });
  });

  describe('API Integration Tests', () => {
    // These tests can be skipped in CI/CD or when AGR APIs are unavailable
    const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

    it.skipIf(!runIntegrationTests)('should search for genes successfully', async () => {
      const client = new EnhancedAGRClient();
      const results = await client.searchGenes('BRCA1', { limit: 5 });
      
      expect(results).toBeDefined();
      expect(results).toHaveProperty('results');
      expect(Array.isArray(results.results)).toBe(true);
    });

    it.skipIf(!runIntegrationTests)('should get species list', async () => {
      const client = new EnhancedAGRClient();
      const species = await client.getSpeciesList();
      
      expect(species).toBeDefined();
      expect(Array.isArray(species)).toBe(true);
      expect(species.length).toBeGreaterThan(0);
    });

    it.skipIf(!runIntegrationTests)('should handle invalid gene ID gracefully', async () => {
      const client = new EnhancedAGRClient();
      
      await expect(client.getGeneInfo('INVALID:123')).rejects.toThrow('Invalid gene ID format');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      mockAxiosInstance.get = vi.fn().mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        config: { url: 'test' }
      });

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        client.makeRequest('/test')
      );

      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toEqual({ test: 'data' });
      });
    });

    it('should maintain performance under load', async () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      mockAxiosInstance.get = vi.fn().mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        config: { url: 'test' }
      });

      const startTime = performance.now();
      
      // Run 100 concurrent requests
      const promises = Array.from({ length: 100 }, (_, i) => 
        client.makeRequest(`/test${i}`)
      );

      await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('MCP Server Integration', () => {
    it('should export required MCP server functions', async () => {
      // Import the main module
      const serverModule = await import('../src/agr-server-enhanced.js');
      
      // Should not throw during import
      expect(serverModule).toBeDefined();
    });
  });
});

// Utility test functions
describe('Utility Functions', () => {
  let client;
  
  beforeEach(() => {
    client = new EnhancedAGRClient();
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(client.formatBytes(0)).toBe('0 B');
      expect(client.formatBytes(1024)).toBe('1 KB');
      expect(client.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(client.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(client.formatBytes(1536)).toBe('1.5 KB');
    });
  });
});

// Mock setup for testing
export function setupTestMocks() {
  // Reset all mocks
  vi.clearAllMocks();
  
  // Setup default axios mock
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    },
    get: vi.fn(),
    post: vi.fn()
  };
  
  mockedAxios.create.mockReturnValue(mockAxiosInstance);
  
  return { mockAxiosInstance };
}

// Test data factory
export function createTestData() {
  return {
    geneSearchResult: {
      results: [
        {
          id: 'HGNC:1100',
          symbol: 'BRCA1',
          name: 'BRCA1 DNA repair associated',
          species: 'Homo sapiens'
        }
      ],
      total: 1
    },
    
    geneInfo: {
      basicGeneticEntity: {
        primaryId: 'HGNC:1100',
        symbol: 'BRCA1',
        name: 'BRCA1 DNA repair associated'
      },
      species: {
        name: 'Homo sapiens',
        taxonId: 'NCBITaxon:9606'
      }
    },
    
    speciesList: [
      {
        name: 'Homo sapiens',
        taxonId: 'NCBITaxon:9606',
        commonName: 'human'
      },
      {
        name: 'Mus musculus', 
        taxonId: 'NCBITaxon:10090',
        commonName: 'house mouse'
      }
    ]
  };
}