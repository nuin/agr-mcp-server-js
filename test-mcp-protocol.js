#!/usr/bin/env node

/**
 * Test MCP Protocol Compliance
 *
 * Verifies that the server binaries produce clean JSON-RPC output without pollution
 */

import { spawn } from 'child_process';

const TEST_TIMEOUT = 5000;

async function testServer(serverPath, serverName) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Testing ${serverName} ===`);
    console.log(`Server: ${serverPath}`);

    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';
    let testComplete = false;

    // Collect stdout (should be clean JSON-RPC only)
    server.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Collect stderr (logs can go here)
    server.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Send initialize request
    setTimeout(() => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      server.stdin.write(JSON.stringify(initRequest) + '\n');
    }, 1000);

    // Kill server and analyze after timeout
    setTimeout(() => {
      server.kill('SIGTERM');
      testComplete = true;

      console.log(`\n--- Stdout Analysis ---`);
      console.log(`Length: ${stdoutData.length} bytes`);

      if (stdoutData.length === 0) {
        console.log('⚠️  WARNING: No stdout output (server may not have started)');
        resolve({ pass: false, reason: 'No stdout output' });
        return;
      }

      // Check for pollution
      const lines = stdoutData.split('\n').filter(l => l.trim());
      console.log(`Lines: ${lines.length}`);

      let hasPollution = false;
      const pollutionLines = [];

      for (const line of lines) {
        if (line.trim().length === 0) continue;

        // Check if line is valid JSON-RPC
        try {
          const parsed = JSON.parse(line);
          if (!parsed.jsonrpc) {
            hasPollution = true;
            pollutionLines.push(line);
          }
        } catch (e) {
          // Not valid JSON - this is pollution
          hasPollution = true;
          pollutionLines.push(line);
        }
      }

      if (hasPollution) {
        console.log('❌ FAILED: Stdout contains pollution:');
        pollutionLines.forEach(line => {
          console.log(`   "${line.substring(0, 80)}"`);
        });
        resolve({ pass: false, reason: 'Stdout pollution detected' });
      } else {
        console.log('✅ PASSED: Stdout contains only valid JSON-RPC messages');
        resolve({ pass: true });
      }

      // Show stderr info (not a failure, just informational)
      if (stderrData.length > 0) {
        console.log(`\n--- Stderr Info (${stderrData.length} bytes) ---`);
        console.log(stderrData.substring(0, 200));
        if (stderrData.length > 200) {
          console.log('... (truncated)');
        }
      }

    }, TEST_TIMEOUT);

    server.on('error', (error) => {
      if (!testComplete) {
        reject(error);
      }
    });
  });
}

async function main() {
  console.log('MCP Protocol Compliance Test');
  console.log('============================\n');
  console.log('This test verifies that MCP server binaries produce clean JSON-RPC output');
  console.log('without any console.log pollution that would corrupt the protocol.\n');

  const tests = [
    { path: 'src/agr-server-simple.js', name: 'Simple AGR MCP Server' },
    { path: 'src/agr-server-simple-natural.js', name: 'Natural Language AGR MCP Server' }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await testServer(test.path, test.name);
      results.push({ ...test, ...result });
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.push({ ...test, pass: false, reason: error.message });
    }
  }

  // Summary
  console.log('\n\n=== Test Summary ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  results.forEach(r => {
    const status = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${r.name}${r.reason ? ` (${r.reason})` : ''}`);
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('⚠️  Some tests failed. The MCP server may not work correctly with Claude Code.');
    console.log('Fix: Remove all console.log() statements from server startup code.');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed! The servers are ready for MCP protocol usage.');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
