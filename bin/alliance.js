#!/usr/bin/env node

/**
 * Alliance Genome Resources CLI - Natural Language Interface
 * 
 * Usage: alliance "find BRCA1 genes in xenopus in the Alliance"
 *        alliance "search for breast cancer diseases"
 *        alliance "get information about HGNC:1100"
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AllianceNLP {
  constructor() {
    this.patterns = {
      // Gene searches
      geneSearch: [
        /(?:find|search\s+(?:for\s+)?)\s*(\w+)\s+genes?\s*(?:in\s+(\w+))?/i,
        /(\w+)\s+genes?\s*(?:in\s+(\w+))?/i,
        /genes?\s+(?:for\s+)?(\w+)\s*(?:in\s+(\w+))?/i
      ],
      
      // Disease searches  
      diseaseSearch: [
        /find\s+(.+?)\s+diseases?/i,
        /search\s+(?:for\s+)?(.+?)\s+diseases?/i,
        /diseases?\s+(?:for\s+)?(.+)/i,
        /(.+)\s+diseases?/i
      ],
      
      // Gene information
      geneInfo: [
        /(?:get\s+)?(?:info|information)\s+(?:about\s+|for\s+)?([A-Z]+:\d+)/i,
        /(?:details\s+(?:about\s+|for\s+)?)([A-Z]+:\d+)/i,
        /([A-Z]+:\d+)\s+(?:info|information|details)/i
      ],
      
      // BLAST searches
      blastSearch: [
        /blast\s+(?:search\s+)?(.{10,})/i,
        /(?:search\s+)?sequence\s+(.{10,})/i
      ],
      
      // Cache/stats
      cacheStats: [
        /cache\s+(?:stats|statistics)/i,
        /performance/i,
        /stats/i
      ]
    };
    
    this.speciesMap = {
      'human': 'Homo sapiens',
      'humans': 'Homo sapiens',
      'mouse': 'Mus musculus', 
      'mice': 'Mus musculus',
      'rat': 'Rattus norvegicus',
      'rats': 'Rattus norvegicus',
      'zebrafish': 'Danio rerio',
      'xenopus': 'Xenopus',
      'frog': 'Xenopus',
      'frogs': 'Xenopus',
      'fly': 'Drosophila melanogaster',
      'flies': 'Drosophila melanogaster',
      'worm': 'Caenorhabditis elegans',
      'worms': 'Caenorhabditis elegans',
      'yeast': 'Saccharomyces cerevisiae'
    };
  }

  parseCommand(text) {
    const cleanText = text.toLowerCase().replace(/\s+in\s+the\s+alliance$/i, '').trim();
    
    // Try gene searches first
    for (const pattern of this.patterns.geneSearch) {
      const match = cleanText.match(pattern);
      if (match) {
        const gene = match[1];
        const species = match[2] ? this.mapSpecies(match[2]) : null;
        return {
          type: 'search_genes',
          query: gene,
          species: species,
          description: `Searching for ${gene} genes${species ? ` in ${species}` : ''}`
        };
      }
    }
    
    // Try disease searches
    for (const pattern of this.patterns.diseaseSearch) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          type: 'search_diseases', 
          query: match[1].trim(),
          description: `Searching for ${match[1]} diseases`
        };
      }
    }
    
    // Try gene information
    for (const pattern of this.patterns.geneInfo) {
      const match = text.match(pattern); // Use original case for gene IDs
      if (match) {
        return {
          type: 'get_gene_info',
          geneId: match[1],
          description: `Getting information for gene ${match[1]}`
        };
      }
    }
    
    // Try BLAST searches
    for (const pattern of this.patterns.blastSearch) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          type: 'blast_sequence',
          sequence: match[1].replace(/\s/g, '').toUpperCase(),
          description: `BLAST searching sequence ${match[1].substring(0, 20)}...`
        };
      }
    }
    
    // Try cache stats
    for (const pattern of this.patterns.cacheStats) {
      if (pattern.test(cleanText)) {
        return {
          type: 'get_cache_stats',
          description: 'Getting cache statistics'
        };
      }
    }
    
    // Default: treat as gene search
    const words = cleanText.split(/\s+/);
    const possibleGene = words.find(word => /^[A-Z0-9]+$/i.test(word) && word.length > 2);
    
    if (possibleGene) {
      return {
        type: 'search_genes',
        query: possibleGene,
        description: `Searching for ${possibleGene} genes (best guess)`
      };
    }
    
    return null;
  }
  
  mapSpecies(species) {
    const lower = species.toLowerCase();
    return this.speciesMap[lower] || species;
  }
}

class AllianceCLI {
  constructor() {
    this.nlp = new AllianceNLP();
    this.serverPath = join(__dirname, '..', 'src', 'agr-server-enhanced.js');
  }
  
  async runQuery(command) {
    return new Promise((resolve, reject) => {
      const server = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'inherit']
      });
      
      let responseReceived = false;
      
      server.stdout.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.result && response.result.content) {
            const content = JSON.parse(response.result.content[0].text);
            responseReceived = true;
            resolve(content);
          }
        } catch (e) {
          // Ignore JSON parse errors for logs
        }
      });
      
      server.on('error', (error) => {
        reject(error);
      });
      
      // Send query immediately after brief startup delay
      setTimeout(() => {
        const message = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: command
        };
        
        server.stdin.write(JSON.stringify(message) + '\n');
      }, 1000);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!responseReceived) {
          server.kill('SIGTERM');
          reject(new Error('Query timeout'));
        }
      }, 10000);
      
      // Clean shutdown after response
      setTimeout(() => {
        if (responseReceived) {
          server.kill('SIGTERM');
        }
      }, 1000);
    });
  }
  
  formatResults(type, data) {
    switch (type) {
      case 'search_genes':
        if (data.results && data.results.length > 0) {
          console.log(`\n🧬 Found ${data.total} genes:\n`);
          data.results.slice(0, 5).forEach((gene, i) => {
            console.log(`${i + 1}. ${gene.symbol} (${gene.species})`);
            console.log(`   ${gene.name}`);
            if (gene.id) console.log(`   ID: ${gene.id}`);
            if (gene.diseases && gene.diseases.length > 0) {
              console.log(`   Associated diseases: ${gene.diseases.slice(0, 3).join(', ')}`);
            }
            console.log('');
          });
          
          if (data.total > 5) {
            console.log(`... and ${data.total - 5} more results\n`);
          }
        } else {
          console.log('❌ No genes found matching your search.');
        }
        break;
        
      case 'search_diseases':
        if (data.results && data.results.length > 0) {
          console.log(`\n🦠 Found ${data.total} diseases:\n`);
          data.results.slice(0, 3).forEach((disease, i) => {
            console.log(`${i + 1}. ${disease.name}`);
            if (disease.definition) {
              console.log(`   ${disease.definition}`);
            }
            if (disease.synonyms && disease.synonyms.length > 0) {
              console.log(`   Also known as: ${disease.synonyms.slice(0, 2).join(', ')}`);
            }
            console.log('');
          });
          
          if (data.total > 3) {
            console.log(`... and ${data.total - 3} more results\n`);
          }
        } else {
          console.log('❌ No diseases found matching your search.');
        }
        break;
        
      case 'get_gene_info':
        console.log(`\n📊 Gene Information:\n`);
        console.log(`Name: ${data.name}`);
        console.log(`Symbol: ${data.symbol}`);
        console.log(`ID: ${data.id}`);
        console.log(`Species: ${data.species.name}`);
        if (data.synonyms && data.synonyms.length > 0) {
          console.log(`Synonyms: ${data.synonyms.slice(0, 3).join(', ')}`);
        }
        if (data.geneSynopsis) {
          console.log(`\nDescription: ${data.geneSynopsis.substring(0, 300)}...`);
        }
        break;
        
      case 'get_cache_stats':
        console.log(`\n📈 Alliance Server Performance:\n`);
        console.log(`Cached items: ${data.cache.keys}`);
        console.log(`Cache hits: ${data.cache.hits}`);
        console.log(`Cache misses: ${data.cache.misses}`);
        console.log(`Server uptime: ${Math.round(data.uptime)}s`);
        break;
        
      default:
        console.log('\n📄 Results:');
        console.log(JSON.stringify(data, null, 2));
    }
  }
  
  showHelp() {
    console.log('🧬 Alliance of Genome Resources - Natural Language CLI\n');
    console.log('Usage: alliance "<natural language query>"\n');
    console.log('Examples:');
    console.log('  alliance "find BRCA1 genes in xenopus"');
    console.log('  alliance "search for breast cancer diseases"');
    console.log('  alliance "get information about HGNC:1100"');
    console.log('  alliance "BLAST sequence ATCGATCGATCG"');
    console.log('  alliance "cache statistics"\n');
    console.log('Supported patterns:');
    console.log('  • Gene searches: "find/search [gene] genes [in species]"');
    console.log('  • Disease searches: "find/search [disease] diseases"'); 
    console.log('  • Gene info: "info about [GENE:ID]"');
    console.log('  • BLAST: "blast [sequence]"');
    console.log('  • Performance: "cache stats"\n');
    console.log('Species shortcuts: human, mouse, rat, zebrafish, xenopus, fly, worm, yeast');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const query = args.join(' ').trim();
  
  if (!query || query === '--help' || query === '-h') {
    new AllianceCLI().showHelp();
    return;
  }
  
  const cli = new AllianceCLI();
  const parsed = cli.nlp.parseCommand(query);
  
  if (!parsed) {
    console.log('❌ Could not understand your query. Try:');
    console.log('  alliance "find BRCA1 genes"');
    console.log('  alliance "search breast cancer diseases"');
    console.log('  alliance --help');
    return;
  }
  
  console.log(`🔍 ${parsed.description}...`);
  
  try {
    // Build MCP command
    let mcpCommand;
    switch (parsed.type) {
      case 'search_genes':
        mcpCommand = {
          name: 'search_genes',
          arguments: {
            query: parsed.query,
            limit: 5,
            ...(parsed.species && { species: parsed.species })
          }
        };
        break;
        
      case 'search_diseases':
        mcpCommand = {
          name: 'search_diseases',
          arguments: {
            query: parsed.query,
            limit: 3
          }
        };
        break;
        
      case 'get_gene_info':
        mcpCommand = {
          name: 'get_gene_info',
          arguments: {
            gene_id: parsed.geneId
          }
        };
        break;
        
      case 'blast_sequence':
        mcpCommand = {
          name: 'blast_sequence',
          arguments: {
            sequence: parsed.sequence,
            max_target_seqs: 5
          }
        };
        break;
        
      case 'get_cache_stats':
        mcpCommand = {
          name: 'get_cache_stats',
          arguments: {}
        };
        break;
    }
    
    const result = await cli.runQuery(mcpCommand);
    cli.formatResults(parsed.type, result);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log('Make sure the Alliance server is available and try again.');
  }
}

main().catch(console.error);