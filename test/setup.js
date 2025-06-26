/**
 * Test setup file for Vitest
 * 
 * This file runs before each test suite and sets up:
 * - Global test utilities
 * - Mock configurations
 * - Test environment setup
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  
  // Configure global test timeout
  vi.setConfig({ testTimeout: 30000 });
  
  console.log('🧪 Test environment initialized');
});

afterAll(() => {
  console.log('🏁 Test suite completed');
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset modules cache
  vi.resetModules();
  
  // Reset timers
  vi.useRealTimers();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for a specified amount of time
   * @param {number} ms - Milliseconds to wait
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Create a mock function with default implementation
   * @param {*} returnValue - Value to return
   */
  createMockFunction: (returnValue) => vi.fn().mockResolvedValue(returnValue),
  
  /**
   * Mock console methods to suppress output during tests
   */
  suppressConsole: () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  },
  
  /**
   * Restore console methods
   */
  restoreConsole: () => {
    vi.restoreAllMocks();
  },
  
  /**
   * Generate test data for various entities
   */
  generateTestData: {
    gene: (overrides = {}) => ({
      id: 'HGNC:1100',
      symbol: 'BRCA1',
      name: 'BRCA1 DNA repair associated',
      species: 'Homo sapiens',
      ...overrides
    }),
    
    disease: (overrides = {}) => ({
      id: 'DOID:1612',
      name: 'breast cancer',
      definition: 'A cancer that originates in the breast tissue',
      ...overrides
    }),
    
    species: (overrides = {}) => ({
      name: 'Homo sapiens',
      taxonId: 'NCBITaxon:9606',
      commonName: 'human',
      ...overrides
    })
  }
};

// Mock environment-specific modules if needed
if (process.env.NODE_ENV === 'test') {
  // Add any test-specific mocks here
}

// Suppress console output during tests unless explicitly needed
global.testUtils.suppressConsole();

export default {};
