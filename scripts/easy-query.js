#!/usr/bin/env node

/**
 * Easy Query Tool for AGR MCP Server
 * Simple commands without complex JSON-RPC
 */

import { spawn } from 'child_process';

// Simple query functions
const queries = {
  genes: (query, limit = 5) => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'search_genes',
      arguments: { query, limit }
    }
  }),

  diseases: (query, limit = 3) => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'search_diseases',
      arguments: { query, limit }
    }
  }),

  info: (gene_id) => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_gene_info',
      arguments: { gene_id }
    }
  }),

  cache: () => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_cache_stats',
      arguments: {}
    }
  }),

  blast: (sequence, max_target_seqs = 5) => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'blast_sequence',
      arguments: { sequence, max_target_seqs }
    }
  })
};

// Main function
async function runQuery(command, query) {
  if (!queries[command]) {
    console.log('❌ Available commands: genes, diseases, info, cache, blast');
    console.log('📖 Examples:');
    console.log('  node easy-query.js genes BRCA1');
    console.log('  node easy-query.js diseases "breast cancer"');
    console.log('  node easy-query.js info HGNC:1100');
    console.log('  node easy-query.js cache');
    return;
  }

  console.log(`🚀 Running: ${command} ${query || ''}`);
  
  // Start server and send query
  const server = spawn('node', ['src/agr-server-enhanced.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let hasResponse = false;

  server.stdout.on('data', (data) => {
    try {
      const response = JSON.parse(data.toString());
      if (response.result && response.result.content) {
        const content = JSON.parse(response.result.content[0].text);
        
        console.log('\n✅ Results:');
        
        // Format output based on command type
        if (command === 'genes' && content.results) {
          console.log(`📊 Found ${content.total} genes:`);
          content.results.slice(0, 5).forEach((gene, i) => {
            console.log(`${i + 1}. ${gene.symbol} (${gene.species}) - ${gene.name}`);
            if (gene.id) console.log(`   ID: ${gene.id}`);
            if (gene.diseases && gene.diseases.length > 0) {
              console.log(`   Diseases: ${gene.diseases.slice(0, 3).join(', ')}`);
            }
            console.log('');
          });
        } 
        else if (command === 'diseases' && content.results) {
          console.log(`🦠 Found ${content.total} diseases:`);
          content.results.slice(0, 3).forEach((disease, i) => {
            console.log(`${i + 1}. ${disease.name}`);
            if (disease.definition) console.log(`   ${disease.definition}`);
            if (disease.synonyms) console.log(`   Also known as: ${disease.synonyms.slice(0, 2).join(', ')}`);
            console.log('');
          });
        }
        else if (command === 'cache') {
          console.log('📈 Cache Statistics:');
          console.log(`   Cached items: ${content.cache.keys}`);
          console.log(`   Cache hits: ${content.cache.hits}`);
          console.log(`   Cache misses: ${content.cache.misses}`);
          console.log(`   Server uptime: ${Math.round(content.uptime)}s`);
        }
        else {
          // Default: show formatted JSON
          console.log(JSON.stringify(content, null, 2));
        }
        
        hasResponse = true;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Send the query
  const queryObj = queries[command](query);
  server.stdin.write(JSON.stringify(queryObj) + '\n');

  // Wait for response, then cleanup
  setTimeout(() => {
    if (!hasResponse) {
      console.log('⏰ No response received, query may have failed');
    }
    server.kill('SIGTERM');
    process.exit(0);
  }, 8000);
}

// Parse command line arguments
const [,, command, ...args] = process.argv;
const query = args.join(' ');

if (!command) {
  console.log('🧬 AGR MCP Server - Easy Query Tool\n');
  console.log('📖 Usage: node easy-query.js <command> [query]\n');
  console.log('Available commands:');
  console.log('  genes <query>     - Search for genes');
  console.log('  diseases <query>  - Search for diseases');
  console.log('  info <gene_id>    - Get gene information');
  console.log('  cache             - Show cache statistics');
  console.log('  blast <sequence>  - BLAST sequence search\n');
  console.log('Examples:');
  console.log('  node easy-query.js genes BRCA1');
  console.log('  node easy-query.js diseases "breast cancer"');
  console.log('  node easy-query.js info HGNC:1100');
  console.log('  node easy-query.js cache');
} else {
  runQuery(command, query);
}