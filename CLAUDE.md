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

- **AGR REST API**: `https://www.alliancegenome.org/api` - Gene info, diseases, expression, orthologs (overridable via `AGR_API_URL`)
- **AllianceMine**: `https://alliancemine.alliancegenome.org/alliancemine/service` - Advanced search (overridable via `ALLIANCEMINE_URL`)

The AGR API runs on Quarkus; its machine-readable spec lives at `https://www.alliancegenome.org/openapi`. Current per-gene routes the client relies on:

| Client method | AGR route |
|---|---|
| `search` / `searchDiseases` / `searchAlleles` | `GET /search` (category keys use a `_search_result` suffix, e.g. `gene_search_result`) |
| `getGene` | `GET /gene/{id}` (returns a `{category, gene:{…}}` wrapper) |
| `getGeneDiseases` | `POST /disease` with body `["{id}"]` |
| `getGeneExpression` | `POST /expression` with body `["{id}"]` |
| `getOrthologs` / `getParalogs` | `GET /gene/{id}/orthologs` (was `/homologs`) / `/paralogs` |
| `getGeneInteractions` | merges `GET /gene/{id}/molecular-interactions` + `/genetic-interactions`, tagging each row with `interactionCategory` |
| `getGenePhenotypes` / `getGeneAlleles` / `getGeneModels` | `GET /gene/{id}/phenotypes` / `/alleles` / `/models` |
| `getDisease` | `GET /disease/{id}` (returns disease object, `null` if missing) |
| `getDiseaseGenes` / `getDiseaseModels` / `getDiseaseAlleles` | `GET /disease/{id}/genes` / `/models` / `/alleles` |
| `getAllele` | `GET /allele/{id}` (returns allele object, `null` if missing) |
| `getAlleleDiseases` / `getAllelePhenotypes` / `getAlleleVariants` | `GET /allele/{id}/diseases` / `/phenotypes` / `/variants` |

Changed AGR responses are passed through as raw JSON (typed `unknown`) rather than remapped to fixed interfaces, so endpoint drift doesn't silently drop fields.

### MCP Tools (21)

| Tool | Purpose |
|------|---------|
| `search_genes` | Search genes with optional species filter |
| `get_gene_info` | Detailed gene information |
| `get_gene_diseases` | Disease associations for a gene |
| `search_diseases` | Search diseases |
| `get_gene_expression` | Expression data |
| `find_orthologs` | Cross-species homologs |
| `find_paralogs` | Within-species paralogs (gene duplications) |
| `get_gene_phenotypes` | Phenotype annotations |
| `get_gene_interactions` | Molecular/genetic interactions |
| `get_gene_alleles` | Alleles for a gene |
| `get_gene_models` | Affected genomic models for a gene |
| `search_alleles` | Search alleles |
| `get_allele_info` | Allele details by ID |
| `get_allele_diseases` | Disease associations for an allele |
| `get_allele_phenotypes` | Phenotype annotations for an allele |
| `get_allele_variants` | Sequence variants for an allele |
| `get_disease_info` | Disease details by DOID |
| `get_disease_genes` | Genes associated with a disease (reverse of `get_gene_diseases`) |
| `get_disease_models` | Model organisms for a disease |
| `get_disease_alleles` | Alleles associated with a disease |
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
