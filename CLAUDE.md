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
├── types.ts    # Entity types, interfaces, constants
├── client.ts   # AllianceClient - AGR API wrapper
└── index.ts    # MCP server with tool definitions
```

### API Endpoints

- **AGR REST API**: `https://www.alliancegenome.org/api` - Gene info, diseases, expression, orthologs
- **AllianceMine**: `https://www.alliancegenome.org/alliancemine/service` - Advanced search

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

### Supported Species

Human, mouse, rat, zebrafish, fly, worm, yeast, frog (Xenopus)

### Gene ID Formats

- `HGNC:1100` (human)
- `MGI:95892` (mouse)
- `RGD:3889` (rat)
- `ZFIN:ZDB-GENE-*` (zebrafish)
- `FB:FBgn*` (fly)
- `WB:WBGene*` (worm)
- `SGD:S*` (yeast)
- `Xenbase:XB-GENE-*` (xenopus)

## Development

- ESM modules (`"type": "module"`)
- TypeScript strict mode
- Native fetch (no axios)
- Zod for input validation
- No caching layer (stateless)
