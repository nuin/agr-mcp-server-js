#!/usr/bin/env node

/**
 * Node v23 Compatibility Wrapper for agr-server-simple-natural.js
 *
 * This CommonJS wrapper detects Node v23 and re-execs with the necessary flag
 * BEFORE stdin is consumed. It then loads the ESM module.
 *
 * Why this works:
 * - CJS executes synchronously before stdin handling
 * - We can check version and re-exec immediately
 * - Child process inherits stdin/stdout/stderr correctly
 */

const nodeVersion = parseInt(process.versions.node.split('.')[0]);
const needsFlag = nodeVersion >= 23 && !process.execArgv.includes('--no-experimental-detect-module');

if (needsFlag) {
  // Re-exec with the flag BEFORE stdin is touched
  const { spawn } = require('child_process');
  const path = require('path');

  // The actual ESM server is in the same directory
  const esmServer = path.join(__dirname, 'agr-server-simple-natural.js');

  const child = spawn(
    process.execPath,
    ['--no-experimental-detect-module', esmServer, ...process.argv.slice(2)],
    { stdio: 'inherit' }
  );

  child.on('exit', (code) => process.exit(code || 0));
  child.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
} else {
  // No re-exec needed, just load the ESM module
  import('./agr-server-simple-natural.js').catch((err) => {
    console.error('Failed to load server:', err.message);
    process.exit(1);
  });
}
