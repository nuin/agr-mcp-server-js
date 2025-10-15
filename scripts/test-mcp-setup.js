#!/usr/bin/env node

/**
 * Test script to verify MCP server setup
 * Run this to diagnose issues before adding to Claude Code
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 AGR MCP Server Setup Verification\n');

// Test 1: Check Node version
console.log('1. Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 18) {
  console.log(`   ✓ Node.js ${nodeVersion} (requires >= 18.0.0)\n`);
} else {
  console.log(`   ✗ Node.js ${nodeVersion} is too old (requires >= 18.0.0)\n`);
  process.exit(1);
}

// Test 2: Check if server files exist
console.log('2. Checking server files...');
const serverFiles = [
  'src/agr-server-simple.js',
  'src/agr-server-enhanced.js'
];

let allFilesExist = true;
for (const file of serverFiles) {
  const filepath = join(projectRoot, file);
  if (fs.existsSync(filepath)) {
    console.log(`   ✓ ${file} exists`);
  } else {
    console.log(`   ✗ ${file} missing`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log('\n   Run: npm install\n');
  process.exit(1);
}
console.log();

// Test 3: Check dependencies
console.log('3. Checking dependencies...');
try {
  const packagePath = join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredDeps = ['@modelcontextprotocol/sdk', 'axios'];

  const nodeModules = join(projectRoot, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    console.log('   ✗ node_modules missing');
    console.log('   Run: npm install\n');
    process.exit(1);
  }

  for (const dep of requiredDeps) {
    const depPath = join(nodeModules, dep);
    if (fs.existsSync(depPath)) {
      console.log(`   ✓ ${dep} installed`);
    } else {
      console.log(`   ✗ ${dep} missing`);
      console.log('   Run: npm install\n');
      process.exit(1);
    }
  }
  console.log();
} catch (error) {
  console.log(`   ✗ Error checking dependencies: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Test server startup
console.log('4. Testing server startup...');
const serverPath = join(projectRoot, 'src/agr-server-simple.js');

const serverProcess = spawn('node', [serverPath]);
let startupOutput = '';

serverProcess.stdout.on('data', (data) => {
  startupOutput += data.toString();
});

serverProcess.stderr.on('data', (data) => {
  startupOutput += data.toString();
});

setTimeout(() => {
  if (startupOutput.includes('started') || startupOutput.includes('Starting')) {
    console.log('   ✓ Server starts successfully');
    console.log('   ✓ Server is waiting for MCP input (this is correct)\n');
    serverProcess.kill();

    console.log('✅ All checks passed!');
    console.log('\nNext steps:');
    console.log('  1. Add to Claude Code:');
    console.log('     claude mcp add agr-genomics agr-mcp-server');
    console.log('\n  2. Completely restart Claude Code');
    console.log('\n  3. Test with: "Search for BRCA1 genes"');
  } else if (startupOutput.length === 0) {
    console.log('   ✗ Server started but no output');
    console.log('   This might still work - try adding to Claude Code\n');
    serverProcess.kill();
  } else {
    console.log('   ✗ Server failed with errors:');
    console.log(startupOutput);
    serverProcess.kill();
    process.exit(1);
  }
}, 2000);
