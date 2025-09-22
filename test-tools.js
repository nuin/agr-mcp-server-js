#!/usr/bin/env node

// Test script to verify MCP server tools
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing MCP server tools...');

const serverPath = join(__dirname, 'src', 'agr-server-enhanced.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;

function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method: method,
    params: params
  };
  server.stdin.write(JSON.stringify(request) + '\n');
}

// Initialize first
sendRequest('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'test-client', version: '1.0.0' }
});

// Then request tools list
setTimeout(() => {
  console.log('Requesting tools list...');
  sendRequest('tools/list');
}, 1000);

// Test a gene search
setTimeout(() => {
  console.log('Testing gene search...');
  sendRequest('tools/call', {
    name: 'search_genes',
    arguments: { query: 'PTEN', limit: 3 }
  });
}, 2000);

server.stdout.on('data', (data) => {
  const responses = data.toString().split('\n').filter(line => line.trim());
  responses.forEach(response => {
    if (response.startsWith('{')) {
      try {
        const parsed = JSON.parse(response);
        console.log('Parsed response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Non-JSON response:', response);
      }
    } else {
      console.log('Log output:', response);
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Cleanup after 10 seconds
setTimeout(() => {
  console.log('Test complete, cleaning up...');
  server.kill();
}, 10000);