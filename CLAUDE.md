# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript to dist/
npm start         # Run compiled server
npm run dev       # Run with tsx (no compile needed)
```

## Architecture

TypeScript MCP server for Alliance of Genome Resources (AGR) genomics data. Follows the minimal 3-file pattern:

```
src/
├── types.ts    # Entity types, interfaces, constants, species mappings
├── client.ts   # AllianceClient - AGR API wrapper with all fetch logic
└── index.ts    # MCP server: tool definitions, resources, server startup
```

### Data Flow

1. `index.ts` defines MCP tools with Zod schemas for input validation
2. Each tool calls methods on `AllianceClient` singleton
3. `client.ts` makes HTTP requests to AGR APIs, returns typed responses
4. Results serialized as JSON text content back to MCP client

### API Endpoints

- **AGR REST API**: `https://www.alliancegenome.org/api` - Gene info, diseases, expression, orthologs
- **AllianceMine**: `https://www.alliancegenome.org/alliancemine/service` - Advanced search (available via `searchMine()` but not exposed as tool)

### MCP Tools (11)

| Tool | Purpose |
|------|---------|
| `search_genes` | Search genes with optional species filter |
| `get_gene_info` | Detailed gene information |
| `get_gene_diseases` | Disease associations for a gene |
| `search_diseases` | Search diseases |
| `get_gene_expression` | Expression data |
| `find_orthologs` | Cross-species homologs |
| `get_gene_phenotypes` | Phenotype annotations |
| `get_gene_interactions` | Molecular/genetic interactions |
| `get_gene_alleles` | Alleles for a gene |
| `search_alleles` | Search alleles |
| `get_species_list` | List supported model organisms |

### MCP Resources

- `agr://entity-types` - List of searchable entity types
- `agr://species` - Live species list from API

### Supported Species

Human, mouse, rat, zebrafish, fly, worm, yeast, frog (Xenopus laevis & tropicalis)

### Gene ID Formats

| Species | Prefix | Example |
|---------|--------|---------|
| Human | `HGNC:` | `HGNC:1100` |
| Mouse | `MGI:` | `MGI:95892` |
| Rat | `RGD:` | `RGD:3889` |
| Zebrafish | `ZFIN:ZDB-GENE-` | `ZFIN:ZDB-GENE-990415-72` |
| Fly | `FB:FBgn` | `FB:FBgn0000017` |
| Worm | `WB:WBGene` | `WB:WBGene00000898` |
| Yeast | `SGD:S` | `SGD:S000002536` |
| Xenopus | `Xenbase:XB-GENE-` | `Xenbase:XB-GENE-485905` |

## Development

- ESM modules (`"type": "module"`)
- TypeScript strict mode, target ES2022
- Native fetch (no axios)
- Zod for input validation
- Stateless - no caching layer
- Requires Node.js >= 18.0.0
- No test framework configured

### Tool Pattern

All MCP tools follow the same structure:
1. Zod schema for input validation
2. Call to `AllianceClient` method
3. Return `{content: [{type: "text", text: JSON.stringify(data, null, 2)}]}`
4. On error: return with `isError: true`

### AllianceClient

The client accepts optional custom API URLs in the constructor for testing or alternative endpoints:
```typescript
new AllianceClient(agrApiUrl?, allianceMineUrl?)
```
