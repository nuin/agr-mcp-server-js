#!/usr/bin/env node

/**
 * AGR Chat - Natural Language Genomics Interface
 * 
 * Just type your questions naturally:
 * - "find BRCA1 genes"
 * - "what diseases are associated with TP53"
 * - "show me DNA repair genes but not p53"
 */

import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

class AGRChat {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.cyan}genomics> ${colors.reset}`,
      historySize: 100,
      removeHistoryDuplicates: true
    });
    
    this.history = [];
    this.setupHandlers();
  }

  setupHandlers() {
    // Welcome message
    console.log(`${colors.bright}${colors.green}
╔════════════════════════════════════════════════════════════╗
║           AGR Genomics Chat - Natural Language            ║
║                                                            ║
║  Just type your questions naturally:                      ║
║  • "find BRCA1 genes"                                     ║
║  • "what diseases are associated with TP53"               ║
║  • "show me DNA repair genes but not p53"                 ║
║  • "find orthologs of HGNC:1100"                         ║
║                                                            ║
║  Commands: help, clear, history, exit                     ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();
      
      if (!input) {
        this.rl.prompt();
        return;
      }

      // Handle special commands
      if (this.handleCommand(input)) {
        return;
      }

      // Process natural language query
      await this.processQuery(input);
    });

    this.rl.on('close', () => {
      console.log(`\n${colors.green}Thanks for using AGR Genomics Chat!${colors.reset}`);
      process.exit(0);
    });
  }

  handleCommand(input) {
    const lower = input.toLowerCase();
    
    switch(lower) {
      case 'exit':
      case 'quit':
      case 'bye':
        this.rl.close();
        return true;
        
      case 'help':
      case '?':
        this.showHelp();
        this.rl.prompt();
        return true;
        
      case 'clear':
      case 'cls':
        console.clear();
        this.rl.prompt();
        return true;
        
      case 'history':
        this.showHistory();
        this.rl.prompt();
        return true;
        
      default:
        return false;
    }
  }

  showHelp() {
    console.log(`
${colors.bright}Natural Language Examples:${colors.reset}
  ${colors.gray}• Gene search:${colors.reset} "find BRCA1 genes" or "search for p53"
  ${colors.gray}• Disease info:${colors.reset} "what diseases are linked to TP53"
  ${colors.gray}• Complex queries:${colors.reset} "DNA repair genes in human but not p53"
  ${colors.gray}• Orthologs:${colors.reset} "find mouse orthologs of human BRCA1"
  ${colors.gray}• Expression:${colors.reset} "where is HGNC:1100 expressed"
  ${colors.gray}• Species specific:${colors.reset} "insulin genes in mouse"

${colors.bright}Commands:${colors.reset}
  ${colors.cyan}help${colors.reset}     Show this help message
  ${colors.cyan}clear${colors.reset}    Clear the screen
  ${colors.cyan}history${colors.reset}  Show query history
  ${colors.cyan}exit${colors.reset}     Exit the chat
    `);
  }

  showHistory() {
    if (this.history.length === 0) {
      console.log(`${colors.gray}No query history yet${colors.reset}`);
    } else {
      console.log(`\n${colors.bright}Query History:${colors.reset}`);
      this.history.forEach((query, i) => {
        console.log(`  ${colors.gray}${i + 1}.${colors.reset} ${query}`);
      });
    }
  }

  async processQuery(query) {
    this.history.push(query);
    
    console.log(`${colors.gray}Searching...${colors.reset}`);
    
    // Use the alliance CLI to process the query
    const alliancePath = path.join(__dirname, 'alliance.js');
    
    const child = spawn('node', [alliancePath, query], {
      cwd: path.dirname(__dirname),
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(`${colors.yellow}${data}${colors.reset}`);
    });

    child.on('close', (code) => {
      if (code !== 0 && !output) {
        console.log(`${colors.yellow}Hmm, I couldn't understand that query. Try rephrasing it.${colors.reset}`);
        console.log(`${colors.gray}Examples: "find BRCA1 genes", "diseases linked to p53"${colors.reset}`);
      }
      this.rl.prompt();
    });
  }
}

// Start the chat interface
new AGRChat();