import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global setup
    globals: true,
    
    // Test files patterns
    include: [
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**'
    ],
    
    // Test timeout
    testTimeout: 30000,
    hookTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      enabled: false, // Enable with --coverage flag
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'test/**',
        'scripts/**',
        'docs/**',
        '**/*.config.{js,ts,mjs,cjs}',
        '**/*.test.{js,ts,mjs,cjs}',
        '**/*.spec.{js,ts,mjs,cjs}'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Reporter configuration
    reporter: process.env.CI ? ['junit', 'github-actions'] : ['verbose'],
    outputFile: {
      junit: './test-results/junit.xml'
    },
    
    // Setup files
    setupFiles: ['./test/setup.js'],
    
    // Test concurrency
    threads: true,
    maxThreads: 4,
    minThreads: 1,
    
    // Mocking
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Watch mode
    watch: false,
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent'
    },
    
    // Retry failed tests
    retry: process.env.CI ? 2 : 0,
    
    // Isolate tests
    isolate: true,
    
    // Performance
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
        useAtomics: true
      }
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@test': new URL('./test', import.meta.url).pathname
    }
  },
  
  // Define global constants
  define: {
    __TEST__: true
  }
});