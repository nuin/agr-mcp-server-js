# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Setup

### Option 1: npm Package (Recommended)
```bash
# Install globally from npm
npm install -g agr-mcp-server-enhanced

# Start the server
agr-mcp-server

# Or use the natural language server
agr-mcp-natural

# Or start interactive chat
agr-chat
```

### Option 2: From Source
```bash
# Clone the repository
git clone https://github.com/nuin/agr-mcp-server-js.git
cd agr-mcp-server-js

# Install dependencies and validate setup
npm run setup

# Start the server
npm start
```

## Build/Test/Lint Commands
- **Start Server**: `npm start` (production) or `npm run dev` (development with debugging)
- **Build**: `npm run build` (runs lint and test)
- **Run Tests**: `npm test` (vitest) or `npm run test:coverage` (with coverage)
- **Run Single Test**: `npm test -- --run test/agr-client.test.js`
- **Test with Integration**: `RUN_INTEGRATION_TESTS=true npm test`
- **Lint/Format**: `npm run lint` and `npm run lint:fix`, `npm run format`
- **Validation**: `npm run validate` (audit + lint + test)
- **Health Check**: `npm run health-check`
- **Setup**: `npm run setup` (install + validate)
- **Benchmarking**: `npm run benchmark`
- **Documentation**: `npm run docs` (generates JSDoc documentation)

## Easy Query Commands (No JSON-RPC Required)
- **Query Help**: `npm run query` (shows available commands)
- **Search Genes**: `npm run query genes BRCA1`
- **Search Diseases**: `npm run query diseases "breast cancer"`
- **Gene Information**: `npm run query info HGNC:1100`
- **Cache Statistics**: `npm run query cache`

## Complex Natural Language Queries (NEW!)
- **Boolean NOT**: `npm run query complex "breast cancer genes in human AND DNA repair NOT p53"`
- **Boolean OR**: `npm run query complex "insulin OR glucose in mouse"`
- **Species Filter**: `npm run query complex "BRCA1 in human"`
- **Process Filter**: `npm run query complex "apoptosis genes NOT p53 in zebrafish"`
- **Multi-Entity**: `npm run query complex "diabetes genes and insulin signaling"`

### Supported Boolean Operators
- **AND**: Combine multiple criteria (implicit between terms)
- **OR**: Alternative terms (`gene1 OR gene2`)
- **NOT**: Exclude specific terms (`DNA repair NOT p53`)
- **Species**: `in human`, `in mouse`, `in zebrafish`, etc.
- **Process**: Automatically detects biological processes
- **Disease**: Recognizes disease terms for filtering

## Natural Language CLI Interface
- **Direct CLI**: `alliance "find BRCA1 genes in xenopus"`
- **Complex Query**: `alliance "DNA repair genes NOT p53 in human"`
- **Disease Search**: `alliance "search for breast cancer diseases"`
- **Gene Info**: `alliance "get information about HGNC:1100"`
- **Install Globally**: `npm install -g .` (enables `alliance` command)

## Architecture Overview
This is an Enhanced Alliance of Genome Resources (AGR) MCP Server implemented in JavaScript/Node.js, designed as a high-performance alternative to the Python version. The server provides genomics data access through the Model Context Protocol (MCP).

## Advanced Scientific Features (NEW! 🚀)

The server now includes comprehensive scientific analysis modules providing cutting-edge genomics capabilities:

### 🧬 Variant Analysis
- **ClinVar Integration**: Clinical significance and pathogenicity assessment
- **gnomAD Integration**: Population frequency analysis across diverse populations
- **VEP Integration**: Functional impact prediction and consequence analysis
- **ACMG Classification**: Automated variant classification using ACMG guidelines
- **Multi-Assembly Support**: GRCh37 and GRCh38 genome builds

### 💊 Drug-Gene Interactions
- **DGIdb Integration**: Comprehensive drug-gene interaction database
- **PharmGKB Integration**: Pharmacogenomics knowledge base
- **Clinical Trials**: Integration with clinical trial drug data
- **Drug Repurposing**: Identification of repurposing opportunities
- **Interaction Classification**: Detailed interaction type categorization

### 🧪 Protein Structure Analysis
- **PDB Integration**: Experimental 3D structures from Protein Data Bank
- **AlphaFold Integration**: AI-predicted structures with confidence scores
- **Structure Quality Assessment**: Comprehensive quality metrics
- **Variant-Structure Mapping**: 3D structural impact of genetic variants
- **Domain Analysis**: Protein domain identification and characterization

### 📊 Gene Expression Heatmaps
- **GTEx Integration**: Tissue-specific expression from Genotype-Tissue Expression
- **Human Protein Atlas**: Protein expression data across tissues
- **Multi-Gene Analysis**: Comparative expression profiling
- **Hierarchical Clustering**: Advanced clustering algorithms
- **Visualization Ready**: Heatmap data optimized for visualization

### 🎯 Functional Enrichment Analysis
- **GO Enrichment**: Gene Ontology functional annotation
- **KEGG Pathways**: Metabolic and signaling pathway analysis
- **Reactome Integration**: Comprehensive pathway database
- **GSEA Support**: Gene Set Enrichment Analysis
- **Statistical Testing**: Hypergeometric and other statistical methods
- **Multiple Testing Correction**: Bonferroni, FDR, and other corrections

### Core Components
- **EnhancedAGRClient**: Main client class with caching, rate limiting, and error handling
- **MCP Server**: Built on `@modelcontextprotocol/sdk` for protocol compliance
- **Natural Language CLI**: Binary at `bin/alliance.js` for conversational queries
- **Caching Layer**: NodeCache with intelligent TTL and cleanup
- **Logging**: Pino-based structured logging with pretty console output
- **Error Handling**: Comprehensive retry logic with exponential backoff
- **Rate Limiting**: Per-endpoint tracking with sliding window algorithm
- **Input Validation**: Gene ID format validation and sequence validation

### Key Files
- `src/agr-server-enhanced.js`: Main server implementation with all genomics tools
- `bin/alliance.js`: Natural language CLI interface for conversational queries
- `package.json`: Dependencies and npm scripts (30+ scripts available)
- `test/agr-client.test.js`: Comprehensive Vitest test suite with mocking, performance, and integration tests
- `test/setup.js`: Test configuration and setup
- `vitest.config.js`: Vitest configuration with coverage thresholds and test environment setup
- `scripts/`: Utility scripts for health checks, benchmarking, and demos
- `config/claude-desktop-config.json`: Claude Desktop MCP configuration

### Available MCP Tools (24 total)

#### Core Genomics Tools
1. `search_genes` - Gene search with species filtering
2. `get_gene_info` - Detailed gene information
3. `get_gene_diseases` - Disease associations
4. `search_diseases` - Disease search functionality
5. `get_gene_expression` - Expression data across tissues
6. `find_orthologs` - Cross-species orthology analysis
7. `blast_sequence` - BLAST search with auto-detection

#### Advanced Query Tools
8. `complex_search` - Natural language queries with Boolean operators (AND, OR, NOT)
9. `faceted_search` - Multi-dimensional filtering with aggregations

#### Scientific Analysis Tools (NEW!)
10. `analyze_variant` - **Comprehensive variant analysis with ClinVar, gnomAD, and VEP integration**
11. `get_drug_interactions` - **Drug-gene interactions using DGIdb and PharmGKB databases**
12. `get_protein_structure` - **Protein structure information from PDB and AlphaFold**
13. `get_expression_heatmap` - **Gene expression heatmap data across tissues and cell types**
14. `functional_enrichment_analysis` - **Comprehensive functional enrichment analysis with GO, KEGG, and GSEA**

#### Literature Mining Tools
15. `search_literature` - PubMed literature search for gene-related papers
16. `find_gene_relationships` - Literature-based gene relationship discovery
17. `analyze_research_trends` - Publication trend analysis over time

#### Evolutionary Analysis Tools
18. `build_phylogenetic_tree` - Phylogenetic tree construction for gene families
19. `get_conservation_score` - Evolutionary conservation analysis

#### Pathway Analysis Tools
20. `get_gene_pathways` - KEGG, Reactome, and GO pathway information
21. `pathway_enrichment` - Pathway enrichment analysis

#### System Tools
22. `get_species_list` - Supported model organisms
23. `get_cache_stats` - Performance monitoring
24. `clear_cache` - Cache management

### API Endpoints Used
- Main API: `https://www.alliancegenome.org/api`
- FMS: `https://fms.alliancegenome.org/api`
- JBrowse: `https://jbrowse.alliancegenome.org`

## Configuration
- Environment variables: `LOG_LEVEL`, `API_TIMEOUT`, `CACHE_TTL`, `CACHE_MAX_KEYS`
- Default cache TTL: 5 minutes (gene info: 10 minutes)
- Rate limiting: 100 requests/minute per endpoint
- Automatic retry: 3 attempts with exponential backoff
- Node.js version requirement: 18+

## Development Workflow
- Uses ESLint with Standard config and Prettier for formatting
- Vitest for testing with coverage reporting (thresholds: 70% branches, 80% functions/lines/statements)
- JSDoc documentation throughout codebase
- Docker support with docker-compose
- PM2 process manager support for production
- Test environment isolation with mocking support
- CI/CD ready with GitHub Actions reporter
- Automatic retry in CI (2 retries for failed tests)

## Testing Strategy
- **Unit Tests**: Core functionality with axios mocking
- **Integration Tests**: Real API calls (enabled with `RUN_INTEGRATION_TESTS=true`)
- **Performance Tests**: Load testing and concurrent request handling
- **Input Validation Tests**: Gene ID formats, sequence validation, query sanitization
- **Error Handling Tests**: Network errors, HTTP errors, timeout scenarios
- **Caching Tests**: Cache hit/miss validation and statistics

## Claude Code Installation & Usage

### Option 1: npm Package Installation (Recommended)

Install the AGR MCP server from npm:

```bash
# Install globally from npm
npm install -g agr-mcp-server-enhanced

# The server binaries are now available globally:
# - agr-mcp-server (main MCP server)
# - agr-mcp-natural (natural language MCP server)
# - alliance (CLI interface)
# - agr-chat (interactive chat)
```

**Configure Claude Code** with global installation:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "agr-genomics": {
      "command": "agr-mcp-server",
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Option 2: Local Development Setup

For development or if you prefer local installation:

```bash
# Clone this repository
git clone https://github.com/your-username/agr-mcp-server-js.git
cd agr-mcp-server-js

# Install dependencies and validate setup
npm run setup

# Test that the server works
npm start
```

**Configure Claude Code** for local setup:

```json
{
  "mcpServers": {
    "agr-genomics": {
      "command": "node",
      "args": ["/FULL/PATH/TO/agr-mcp-server-js/src/agr-server-enhanced.js"],
      "cwd": "/FULL/PATH/TO/agr-mcp-server-js",
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Find your absolute path**:
```bash
# In the project directory, run:
pwd
# Copy the output and use it in the config above
```

### Verification & Usage

After setup, restart Claude Code completely and verify with these queries:

- "Search for BRCA1 genes"
- "Find genes related to insulin"  
- "Get detailed information about HGNC:1100"
- "Show me cache statistics"

## Real Usage Examples

### Gene Search Examples

**Basic gene search:**
```bash
npm run query genes BRCA1
```
**Result:** Returns 108 genes across species including:
- BRCA1 (Homo sapiens) - BRCA1 DNA repair associated (HGNC:1100)
- Brca1 (Rattus norvegicus) - BRCA1, DNA repair associated (RGD:2218)
- Brca1 (Mus musculus) - breast cancer 1, early onset (MGI:104537)
- brca1 (Xenopus tropicalis) - breast cancer 1 (Xenbase:XB-GENE-490624)

**Advanced gene search:**
```bash
npm run query genes TP53
```
**Result:** Returns 148 genes including:
- TP53 (Homo sapiens) - tumor protein p53 (HGNC:11998)
- tp53 (Danio rerio) - tumor protein p53 (ZFIN:ZDB-GENE-990415-270)  
- Tp53 (Rattus norvegicus) - tumor protein p53 (RGD:3889)

### Detailed Gene Information

**Get comprehensive gene details:**
```bash
npm run query info HGNC:1100
```
**Result:** Returns complete gene information including:
- **Symbol:** BRCA1
- **Name:** BRCA1 DNA repair associated
- **Species:** Homo sapiens
- **Location:** Chromosome 17 (43,044,295-43,170,327)
- **Synonyms:** FANCS, BRCAI, PPP1R53, RNF53, etc.
- **Function:** 190 kD nuclear phosphoprotein, tumor suppressor
- **Disease associations:** ~40% of inherited breast cancers
- **Cross-references:** ENSEMBL, NCBI, UniProt, etc.


### Performance Monitoring

**Check cache performance:**
```bash
npm run query cache
```
**Result:** Shows real-time stats:
- Cached items: 0-1000+
- Cache hits: Performance metric
- Cache misses: Miss rate tracking
- Server uptime: Runtime duration

### Natural Language Queries (Claude Code)

Once installed in Claude Code, you can use natural language:

**"Search for BRCA1 genes across all species"**
- Returns cross-species gene results
- Shows orthologs and disease associations

**"Get detailed information about the TP53 gene"**  
- Provides comprehensive gene data
- Includes function, location, and references

**"What are the cache statistics for the genomics server?"**
- Shows performance metrics
- Cache hit/miss ratios and uptime

**"Find genes associated with DNA repair"**
- Semantic search capabilities
- Returns relevant gene families

### Complex Query Usage Examples

**Real Examples That Work:**
```bash
# DNA repair genes excluding p53 in humans
npm run query complex "breast cancer genes in human AND DNA repair NOT p53"
# Result: 6,021 genes (XRCC3, XRCC1, RAD50, ERCC1, etc.)

# Metabolic genes in mouse model
npm run query complex "insulin OR glucose in mouse"
# Result: 28 genes (Insl5, Igfbp7, Irs3, Ide, etc.)

# Species-specific BRCA1 research
npm run query complex "BRCA1 in human"
# Result: 29 human BRCA1-related genes

# Exclude common genes for focused research
npm run query complex "apoptosis genes NOT p53 in zebrafish"
# Result: Apoptosis pathway genes excluding TP53
```

### Troubleshooting

If the MCP server isn't working:

1. **Check server starts manually**: `cd /path/to/project && npm start`
2. **Verify Node.js version**: `node --version` (needs 18+)
3. **Check config file syntax**: Ensure JSON is valid
4. **Check logs**: Look for error messages when Claude Code starts
5. **Verify paths**: Ensure all paths in config are absolute and correct

## Performance Features
- 25-40% faster than Python version
- Intelligent caching with hit/miss tracking
- Connection pooling and request optimization
- Memory-efficient operations (typically ~28MB usage)
- Comprehensive input validation and sanitization