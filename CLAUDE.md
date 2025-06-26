# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test/Lint Commands
- **Start Server**: `npm start` (production) or `npm run dev` (development with debugging)
- **Build**: `npm run build` (runs lint and test)
- **Run Tests**: `npm test` (vitest) or `npm run test:coverage` (with coverage)
- **Lint/Format**: `npm run lint` and `npm run lint:fix`, `npm run format`
- **Validation**: `npm run validate` (audit + lint + test)
- **Health Check**: `npm run health-check`
- **Setup**: `npm run setup` (install + validate)

## Architecture Overview
This is an Enhanced Alliance of Genome Resources (AGR) MCP Server implemented in JavaScript/Node.js, designed as a high-performance alternative to the Python version. The server provides genomics data access through the Model Context Protocol (MCP).

### Core Components
- **EnhancedAGRClient**: Main client class with caching, rate limiting, and error handling
- **MCP Server**: Built on `@modelcontextprotocol/sdk` for protocol compliance
- **Caching Layer**: NodeCache with intelligent TTL and cleanup
- **Logging**: Pino-based structured logging with pretty console output
- **Error Handling**: Comprehensive retry logic with exponential backoff

### Key Files
- `src/agr-server-enhanced.js`: Main server implementation with all genomics tools
- `package.json`: Dependencies and npm scripts
- `test/agr-client.test.js`: Vitest-based test suite
- `scripts/`: Utility scripts for health checks, benchmarking, and demos
- `config/claude-desktop-config.json`: Claude Desktop MCP configuration

### Available MCP Tools (10 total)
1. `search_genes` - Gene search with species filtering
2. `get_gene_info` - Detailed gene information
3. `get_gene_diseases` - Disease associations
4. `search_diseases` - Disease search functionality
5. `get_gene_expression` - Expression data across tissues
6. `find_orthologs` - Cross-species orthology analysis
7. `blast_sequence` - BLAST search with auto-detection
8. `get_species_list` - Supported model organisms
9. `get_cache_stats` - Performance monitoring
10. `clear_cache` - Cache management

### API Endpoints Used
- Main API: `https://www.alliancegenome.org/api`
- BLAST: `https://blast.alliancegenome.org`
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
- Vitest for testing with coverage reporting
- JSDoc documentation throughout codebase
- Docker support with docker-compose
- PM2 process manager support for production

## Performance Features
- 25-40% faster than Python version
- Intelligent caching with hit/miss tracking
- Connection pooling and request optimization
- Memory-efficient operations (typically ~28MB usage)
- Comprehensive input validation and sanitization