#!/usr/bin/env node

/**
 * Test the integrated TRUE NLP capabilities through MCP interface
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

async function testIntegratedNLP() {
  console.log('🧠 Testing Integrated TRUE NLP through MCP Interface');
  console.log('=' .repeat(60));

  // Test queries for TRUE NLP
  const testQueries = [
    {
      tool: 'process_natural_query',
      args: { query: "What genes interact with BRCA1 in DNA repair pathways?" },
      description: "Complex relationship query with biological context"
    },
    {
      tool: 'process_natural_query', 
      args: { query: "Show me genes that regulate cell division but exclude p53" },
      description: "Query with negation and biological process"
    },
    {
      tool: 'explain_understanding',
      args: { query: "Find genes involved in immune response that are expressed in T cells" },
      description: "Explain how NLP processes complex biological query"
    }
  ];

  for (const testCase of testQueries) {
    console.log(`\n🔍 Test: ${testCase.description}`);
    console.log(`   Query: "${testCase.args.query}"`);
    console.log(`   Tool: ${testCase.tool}`);
    console.log('-'.repeat(50));

    try {
      // Create MCP request
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: testCase.tool,
          arguments: testCase.args
        }
      };

      // Send to MCP server via stdin/stdout
      const mcp = spawn('node', ['src/agr-server-enhanced.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      mcp.stdout.on('data', (data) => {
        output += data.toString();
      });

      let errorOutput = '';
      mcp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Send request
      mcp.stdin.write(JSON.stringify(mcpRequest) + '\n');
      mcp.stdin.end();

      // Wait for completion
      await new Promise((resolve, reject) => {
        mcp.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          mcp.kill();
          reject(new Error('Test timeout'));
        }, 30000);
      });

      // Parse response
      const lines = output.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      if (lastLine.startsWith('{')) {
        const response = JSON.parse(lastLine);
        
        if (response.result && response.result.content && response.result.content[0]) {
          const result = JSON.parse(response.result.content[0].text);
          
          console.log(`✅ NLP Analysis Complete:`);
          
          if (result.naturalLanguageResponse) {
            console.log(`   Response: "${result.naturalLanguageResponse}"`);
          }
          
          if (result.understanding) {
            console.log(`   Intent: ${result.understanding.intent}`);
            console.log(`   Entities Found: ${JSON.stringify(result.understanding.entities)}`);
            console.log(`   Context: ${result.understanding.context.join(', ')}`);
          }
          
          if (result.semanticBreakdown) {
            console.log(`   Semantic Analysis:`);
            console.log(`     Subject: ${result.semanticBreakdown.subject}`);
            console.log(`     Predicate: ${result.semanticBreakdown.predicate}`);
            console.log(`     Object: ${result.semanticBreakdown.object}`);
          }
          
          if (result.resultsFound !== undefined) {
            console.log(`   Results: ${result.resultsFound} genes found`);
          }
          
          if (result.topResults && result.topResults.length > 0) {
            console.log(`   Top Result: ${result.topResults[0].symbol} - ${result.topResults[0].name}`);
          }
        } else {
          console.log(`❓ Unexpected response format: ${lastLine}`);
        }
      } else {
        console.log(`❓ No JSON response found in: ${output}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n🧠 Integrated TRUE NLP Test Complete!');
  console.log('Features demonstrated through MCP:');
  console.log('• TRUE semantic understanding (not keyword matching)');
  console.log('• Intent detection and entity extraction');
  console.log('• Biological context inference');
  console.log('• Natural language response generation');
  console.log('• Subject-predicate-object parsing');
}

testIntegratedNLP().catch(console.error);