# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Enhanced Alliance of Genome Resources (AGR) MCP Server - A high-performance JavaScript/Node.js implementation providing genomics data access through the Model Context Protocol. This server offers 27 specialized tools for genomics research including advanced NLP capabilities, variant analysis, drug-gene interactions, and comprehensive pathway enrichment.

## Development Commands

### Essential Commands
- `npm run setup` - Complete setup: install dependencies, validate, and test
- `npm start` - Start production server
- `npm run dev` - Start with debugging enabled
- `npm test` - Run full test suite (Vitest)
- `npm run test:coverage` - Run tests with coverage report
- `npm run build` - Lint and test (pre-deployment)
- `npm run validate` - Full validation: audit, lint, and test

### Testing
- `npm test -- --run test/agr-client.test.js` - Run single test file
- `RUN_INTEGRATION_TESTS=true npm test` - Run with live API integration tests
- Coverage thresholds: 70% branches, 80% functions/lines/statements

### Code Quality
- `npm run lint` / `npm run lint:fix` - ESLint with Standard config
- `npm run format` - Prettier formatting
- `npm run docs` - Generate JSDoc documentation

### Utilities
- `npm run query genes BRCA1` - Quick gene search without MCP
- `npm run query complex "query"` - Test complex NLP queries
- `npm run health-check` - API connectivity verification
- `npm run benchmark` - Performance testing

## Architecture

### Core Components
```
src/
├── agr-server-enhanced.js       # Main MCP server (27 tools)
├── agr-server-simple.js         # Simplified server (24 tools)
├── agr-server-simple-natural.js # NLP-only server (3 tools)
├── nlp-standalone-server.js     # Standalone NLP service
├── nlp/
│   ├── scientific-nlp-processor.js  # TRUE semantic NLP engine
│   └── nlp-server.js                # NLP service layer
└── scientific/
    ├── variant-analysis.js          # ClinVar, gnomAD, VEP integration
    ├── drug-gene-interactions.js    # DGIdb, PharmGKB
    ├── protein-structure.js         # PDB, AlphaFold
    ├── gene-expression.js           # GTEx, HPA heatmaps
    ├── functional-enrichment.js     # GO, KEGG, GSEA
    ├── literature-mining.js         # PubMed search
    ├── phylogenetic-analysis.js     # Conservation, trees
    └── pathway-analysis.js          # KEGG, Reactome
```

### EnhancedAGRClient Class (src/agr-server-enhanced.js:98)
The main client handles all API interactions with intelligent features:

- **Caching Layer**: NodeCache with configurable TTL (5min default, 10min for gene info)
- **Rate Limiting**: 100 requests/minute per endpoint using sliding window
- **Retry Logic**: 3 attempts with exponential backoff for 5xx errors
- **Connection Pooling**: Optimized axios instance with interceptors
- **Input Validation**: Gene ID format checking, sequence validation
- **Query Parsing**: Complex NLP query parser with Boolean operators (parseComplexQuery:298)

Key methods:
- `makeRequest(endpoint, options)` - Core HTTP client with caching/retry (line 180)
- `parseComplexQuery(query)` - NLP query parser for Boolean/species/process filters (line 298)
- `complexSearch(query, options)` - Cross-entity search with aggregations (line 691)
- `facetedSearch(filters)` - Multi-dimensional filtering (line 908)

### MCP Tools (27 Total)

**Core Genomics (8 tools)**
1. `search_genes` - Gene search with species filtering and complex query support
2. `get_gene_info` - Comprehensive gene information
3. `get_gene_diseases` - Disease associations and models
4. `search_diseases` - Disease search
5. `get_gene_expression` - Expression data across tissues
6. `find_orthologs` - Cross-species orthology
7. `blast_sequence` - BLAST with auto-detection
8. `get_species_list` - Supported organisms

**Advanced Query (2 tools)**
9. `complex_search` - Boolean queries (AND/OR/NOT) with species/process filters
10. `faceted_search` - Multi-dimensional filtering with aggregations

**Scientific Analysis (5 tools)**
11. `analyze_variant` - ClinVar, gnomAD, VEP integration
12. `get_drug_interactions` - DGIdb, PharmGKB
13. `get_protein_structure` - PDB, AlphaFold
14. `get_expression_heatmap` - GTEx, HPA
15. `functional_enrichment_analysis` - GO, KEGG, GSEA

**Literature & Evolution (5 tools)**
16-18. Literature mining (PubMed search, relationships, trends)
19-20. Phylogenetic analysis (trees, conservation)

**Pathways (2 tools)**
21-22. Pathway analysis (KEGG, Reactome, enrichment)

**NLP (3 tools)**
23. `process_natural_query` - Semantic understanding with intent detection
24. `continue_conversation` - Context-aware follow-ups
25. `explain_understanding` - Show NLP reasoning

**System (2 tools)**
26. `get_cache_stats` - Performance monitoring
27. `clear_cache` - Cache management

### API Endpoints
```javascript
const CONFIG = {
  endpoints: {
    base: 'https://www.alliancegenome.org/api',
    blast: 'https://blast.alliancegenome.org',
    fms: 'https://fms.alliancegenome.org/api',
    jbrowse: 'https://jbrowse.alliancegenome.org'
  },
  timeout: 30000,           // 30 seconds
  maxRetries: 3,            // Exponential backoff
  cache: { ttl: 300 },      // 5 minutes (600 for gene info)
  rateLimit: {
    windowMs: 60000,        // 1 minute window
    maxRequests: 100        // Per endpoint
  }
};
```

## Configuration & Environment

### Environment Variables
```bash
LOG_LEVEL=error         # error (default for MCP), info, debug - CRITICAL: Use error in MCP mode to avoid stdout pollution
API_TIMEOUT=30000       # Request timeout in milliseconds
CACHE_TTL=300          # Default cache TTL in seconds
CACHE_MAX_KEYS=1000    # Maximum cache entries
NODE_ENV=production    # production, development, test
```

**CRITICAL: MCP Logging Configuration**
- Default LOG_LEVEL is 'error' to prevent stdout pollution in MCP stdio mode
- All logs write to stderr (fd 2) to avoid corrupting JSON-RPC protocol messages
- Only use LOG_LEVEL=info or LOG_LEVEL=debug for troubleshooting, never in production MCP mode
- The server uses pino logger configured to write to stderr: `pino.destination({ dest: 2 })`
- Previous bug (v3.2.0): Logs to stdout caused "Unexpected token" and connection failures

### Requirements
- Node.js >= 18.0.0
- npm >= 8.0.0

## Development Workflow

### Code Quality
- **Linting**: ESLint with Standard config
- **Formatting**: Prettier
- **Documentation**: JSDoc throughout codebase
- **Testing**: Vitest with mocking support
  - Unit tests with axios mocking
  - Integration tests (`RUN_INTEGRATION_TESTS=true`)
  - Performance benchmarks
  - Coverage thresholds enforced

### Test Configuration (vitest.config.js)
```javascript
{
  testTimeout: 30000,
  coverage: {
    thresholds: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  retry: process.env.CI ? 2 : 0,  // Auto-retry in CI
  setupFiles: ['./test/setup.js']
}
```

## Claude Code Integration

### Setup Instructions

**Option 1: npm Global Install (Recommended for Users)**
```bash
# Install globally
npm install -g agr-mcp-server-enhanced

# Add to Claude Code
claude mcp add agr-genomics agr-mcp-server

# Verify
claude mcp list
```

**Option 2: Local Development Setup**
```bash
# Clone and install
git clone https://github.com/nuin/agr-mcp-server-js.git
cd agr-mcp-server-js
npm install

# Test your setup (RECOMMENDED)
npm run test:mcp

# Link locally for testing
npm link

# Add to Claude Code (use enhanced server for all 27 tools)
claude mcp add agr-genomics "$(pwd)/src/agr-server-enhanced.js"

# Or use the simple server (24 tools)
claude mcp add agr-genomics agr-mcp-server
```

**After adding, COMPLETELY RESTART Claude Code** (not just reload) and test with: "Search for BRCA1 genes"

**Having issues?** Run `npm run test:mcp` to diagnose problems before contacting support.

### Example Queries

**Basic genomics:**
- "Search for BRCA1 genes"
- "Get information about HGNC:1100"
- "Find orthologs of TP53 in mouse"
- "Show me cache statistics"

**Complex queries (Boolean operators):**
- "breast cancer genes in human AND DNA repair NOT p53"
- "insulin OR glucose in mouse"
- "apoptosis genes NOT p53 in zebrafish"

**TRUE NLP queries (semantic understanding):**
- "What genes interact with BRCA1 in DNA repair pathways?"
- "Show genes that regulate cell division but exclude p53"
- "Find genes involved in immune response expressed in T cells"

## Key Implementation Details

### Query Parsing (src/agr-server-enhanced.js:298-431)
The `parseComplexQuery` method extracts:
- Boolean operators (AND, OR, NOT)
- Species filters ("in human", "in mouse")
- Biological processes (repair, apoptosis, signaling)
- Molecular functions (kinase, transcription factor)
- Chromosome locations

Example flow:
```javascript
"breast cancer genes in human AND DNA repair NOT p53"
→ Parse: terms=["breast", "cancer", "DNA", "repair"], species=["Homo sapiens"], NOT=["p53"]
→ Build: "breast cancer DNA repair NOT p53" with species filter
→ Execute: API call with structured query
```

### Caching Strategy (src/agr-server-enhanced.js:180-255)
- GET requests cached with TTL (5min default, 10min for gene info)
- Cache key: `${method}:${url}:${params}`
- Automatic cleanup on expired keys
- Stats tracking: hits, misses, keys

### Error Handling
- 3 retry attempts with exponential backoff for 5xx errors
- Rate limiting: 100 req/min per endpoint
- Input validation for gene IDs and sequences
- Graceful degradation on partial failures

### MCP Protocol Implementation (CRITICAL)
**Stdout Pollution Prevention:**
- The server uses MCP stdio transport which requires clean stdout for JSON-RPC messages
- ALL logging MUST go to stderr (file descriptor 2) to avoid corrupting the protocol
- Logger configuration: `pino.destination({ dest: 2, sync: false })`
- Default LOG_LEVEL is 'error' to minimize output
- NEVER use console.log() in production code - use logger.debug() instead
- Fixed in v3.2.1: Logs now properly routed to stderr

**Testing MCP Protocol:**
```bash
# Verify stdout is clean (should output only JSON-RPC response)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node src/agr-server-enhanced.js 2>/dev/null

# Verify connection works
claude mcp list
# Should show: agr-genomics: ... - ✓ Connected
```

## Troubleshooting

### Common Setup Issues

**1. "Command not found: agr-mcp-server"**
```bash
# Check if globally installed
npm list -g agr-mcp-server-enhanced

# If not installed, run:
npm install -g agr-mcp-server-enhanced

# Verify the binary is available
which agr-mcp-server
```

**2. "Server not responding", "✗ Failed to connect", or "Unexpected token" errors**

These errors typically indicate stdout pollution corrupting the MCP JSON-RPC protocol (fixed in v3.2.1). To diagnose:

```bash
# Test if stdout is clean (should show ONLY JSON, no logs)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node src/agr-server-enhanced.js 2>/dev/null

# If you see ANY non-JSON output (logs, version info, etc), stdout is polluted
# Fix: Ensure LOG_LEVEL=error and check that logger writes to stderr

# Verify connection after fix
claude mcp list
```

MCP servers run via stdio and wait for input - they won't show output when run directly. To test:
```bash
# Check the command exists
which agr-mcp-server

# For local clone, test the file directly
node src/agr-server-simple.js  # Should print "Starting..." and wait

# If it hangs after "started", that's CORRECT - press Ctrl+C
# If you get errors, check dependencies:
npm install
```

**3. "No such tool available" errors in Claude Code**
- Completely quit and restart Claude Code (not just reload)
- Verify server is in the list: `claude mcp list`
- Check the command path is correct

**4. Path issues with local clone**
```bash
# Get the ABSOLUTE path (don't use ~ or relative paths)
cd /path/to/agr-mcp-server-js
pwd
# Copy the FULL output and use it in the claude mcp add command
```

**5. Server starts but queries fail**
```bash
# Check API connectivity
npm run health-check

# Check Node.js version (must be >= 18)
node --version

# Validate installation
npm run validate
```

### Debug Commands

**Test server directly:**
```bash
# For npm global install
agr-mcp-server

# For local clone
node src/agr-server-enhanced.js
```

**Check configuration:**
```bash
claude mcp list                  # List all MCP servers
claude mcp remove agr-genomics   # Remove if need to reconfigure
pwd                             # Get absolute path for local setup
```

## Performance Notes

- 25-40% faster than Python version (async I/O optimization)
- Memory efficient: ~28MB typical usage
- Cache hit rate: ~89% in production
- Response times: ~120ms average (vs ~200ms Python)
