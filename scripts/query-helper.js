#!/usr/bin/env node

/**
 * Simple Query Helper for AGR MCP Server
 * Makes it easy to send queries without writing complex JSON-RPC
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

class AGRQueryHelper {
  constructor() {
    this.server = null;
    this.requestId = 1;
  }

  // Start the MCP server
  startServer() {
    return new Promise((resolve) => {
      // Determine the correct path to the server
      const serverPath = process.cwd().includes('scripts') 
        ? '../src/agr-server-enhanced.js' 
        : 'src/agr-server-enhanced.js';
      
      this.server = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd().includes('scripts') ? '..' : process.cwd()
      });

      this.server.stdout.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.result && response.result.content) {
            const content = JSON.parse(response.result.content[0].text);
            console.log('\n📊 Results:');
            console.log(JSON.stringify(content, null, 2));
          }
        } catch (e) {
          // Ignore parsing errors for logs
        }
      });

      this.server.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('started successfully')) {
          resolve();
        }
      });
    });
  }

  // Send a query to the server
  sendQuery(tool, args) {
    const message = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: args
      }
    };

    this.server.stdin.write(JSON.stringify(message) + '\n');
  }

  // Convenient methods for common queries
  searchGenes(query, options = {}) {
    console.log(`🔍 Searching for genes: "${query}"`);
    this.sendQuery('search_genes', {
      query,
      limit: options.limit || 5,
      species: options.species
    });
  }

  searchDiseases(query, options = {}) {
    console.log(`🦠 Searching for diseases: "${query}"`);
    this.sendQuery('search_diseases', {
      query,
      limit: options.limit || 3
    });
  }

  getGeneInfo(geneId) {
    console.log(`🧬 Getting gene info for: ${geneId}`);
    this.sendQuery('get_gene_info', { gene_id: geneId });
  }

  getGeneDiseases(geneId) {
    console.log(`🏥 Getting diseases for gene: ${geneId}`);
    this.sendQuery('get_gene_diseases', { gene_id: geneId });
  }

  findOrthologs(geneId) {
    console.log(`🔄 Finding orthologs for: ${geneId}`);
    this.sendQuery('find_orthologs', { gene_id: geneId });
  }

  blastSequence(sequence, options = {}) {
    console.log(`💥 BLAST searching sequence: ${sequence.substring(0, 20)}...`);
    this.sendQuery('blast_sequence', {
      sequence,
      max_target_seqs: options.maxTargets || 5
    });
  }

  getCacheStats() {
    console.log('📈 Getting cache statistics...');
    this.sendQuery('get_cache_stats', {});
  }

  getSpeciesList() {
    console.log('🐾 Getting species list...');
    this.sendQuery('get_species_list', {});
  }

  // Clean shutdown
  shutdown() {
    if (this.server) {
      this.server.kill('SIGTERM');
    }
  }
}

// Interactive CLI
async function runInteractiveCLI() {
  const helper = new AGRQueryHelper();
  
  console.log('🚀 Starting AGR MCP Server Query Helper...\n');
  
  // Start server
  await helper.startServer();
  console.log('✅ Server ready!\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('📖 Available commands:');
  console.log('  genes <query>          - Search for genes (e.g., genes BRCA1)');
  console.log('  diseases <query>       - Search for diseases (e.g., diseases "breast cancer")');
  console.log('  info <gene_id>         - Get gene information (e.g., info HGNC:1100)');
  console.log('  gene-diseases <gene_id>- Get diseases for gene (e.g., gene-diseases HGNC:1100)');
  console.log('  orthologs <gene_id>    - Find orthologs (e.g., orthologs HGNC:1100)');
  console.log('  blast <sequence>       - BLAST search (e.g., blast ATCGATCG...)');
  console.log('  cache                  - Show cache statistics');
  console.log('  species                - List available species');
  console.log('  help                   - Show this help');
  console.log('  quit                   - Exit\n');

  const promptUser = () => {
    rl.question('🧬 AGR Query> ', async (input) => {
      const [command, ...args] = input.trim().split(' ');
      const query = args.join(' ');

      try {
        switch (command.toLowerCase()) {
          case 'genes':
            if (!query) {
              console.log('❌ Please provide a search query. Example: genes BRCA1');
            } else {
              helper.searchGenes(query);
            }
            break;

          case 'diseases':
            if (!query) {
              console.log('❌ Please provide a disease name. Example: diseases "breast cancer"');
            } else {
              helper.searchDiseases(query.replace(/"/g, ''));
            }
            break;

          case 'info':
            if (!query) {
              console.log('❌ Please provide a gene ID. Example: info HGNC:1100');
            } else {
              helper.getGeneInfo(query);
            }
            break;

          case 'gene-diseases':
            if (!query) {
              console.log('❌ Please provide a gene ID. Example: gene-diseases HGNC:1100');
            } else {
              helper.getGeneDiseases(query);
            }
            break;

          case 'orthologs':
            if (!query) {
              console.log('❌ Please provide a gene ID. Example: orthologs HGNC:1100');
            } else {
              helper.findOrthologs(query);
            }
            break;

          case 'blast':
            if (!query) {
              console.log('❌ Please provide a DNA/protein sequence. Example: blast ATCGATCGATCG');
            } else {
              helper.blastSequence(query);
            }
            break;

          case 'cache':
            helper.getCacheStats();
            break;

          case 'species':
            helper.getSpeciesList();
            break;

          case 'help':
            console.log('\n📖 Available commands:');
            console.log('  genes <query>          - Search for genes');
            console.log('  diseases <query>       - Search for diseases');
            console.log('  info <gene_id>         - Get gene information');
            console.log('  gene-diseases <gene_id>- Get diseases for gene');
            console.log('  orthologs <gene_id>    - Find orthologs');
            console.log('  blast <sequence>       - BLAST search');
            console.log('  cache                  - Show cache statistics');
            console.log('  species                - List available species');
            console.log('  quit                   - Exit\n');
            break;

          case 'quit':
          case 'exit':
            console.log('\n👋 Goodbye!');
            helper.shutdown();
            rl.close();
            process.exit(0);
            break;

          default:
            console.log('❌ Unknown command. Type "help" for available commands.');
            break;
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }

      setTimeout(promptUser, 100);
    });
  };

  promptUser();
}

// Command line usage
if (process.argv.length > 2) {
  const helper = new AGRQueryHelper();
  
  (async () => {
    await helper.startServer();
    
    const [,, command, ...args] = process.argv;
    const query = args.join(' ');
    
    switch (command.toLowerCase()) {
      case 'genes':
        helper.searchGenes(query);
        break;
      case 'diseases':
        helper.searchDiseases(query);
        break;
      case 'info':
        helper.getGeneInfo(query);
        break;
      case 'cache':
        helper.getCacheStats();
        break;
      default:
        console.log('Usage: node query-helper.js [genes|diseases|info|cache] <query>');
    }
    
    setTimeout(() => {
      helper.shutdown();
      process.exit(0);
    }, 3000);
  })();
} else {
  // Interactive mode
  runInteractiveCLI();
}