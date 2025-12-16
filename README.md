# AGR MCP Server

MCP server for querying [Alliance of Genome Resources](https://www.alliancegenome.org) - genomics data across model organisms.

## Installation

### Option 1: npx (Recommended)

No installation required. Add to your MCP client config:

```json
{
  "mcpServers": {
    "agr-genomics": {
      "command": "npx",
      "args": ["-y", "agr-mcp-server"]
    }
  }
}
```

### Option 2: Global install

```bash
npm install -g agr-mcp-server
```

Then use in your config:

```json
{
  "mcpServers": {
    "agr-genomics": {
      "command": "agr-mcp-server"
    }
  }
}
```

### Config file locations

| Client | Config path |
|--------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | `~/.claude/settings.json` |
| Cursor | Settings > MCP Servers |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

## Usage

Ask questions naturally:

- "Search for BRCA1 genes in human"
- "What genes are involved in DNA repair?"
- "Get information about HGNC:1100"
- "Find orthologs of insulin gene"
- "What diseases are associated with TP53?"
- "Show me expression data for daf-2 in worm"

### Supported Species

Human, mouse, rat, zebrafish, fly, worm, yeast, xenopus

## Tools

| Tool | Description |
|------|-------------|
| `search_genes` | Search genes with optional species filter |
| `get_gene_info` | Detailed gene information (symbol, location, synonyms) |
| `get_gene_diseases` | Disease associations for a gene |
| `search_diseases` | Search diseases by name |
| `get_gene_expression` | Expression data across tissues/stages |
| `find_orthologs` | Cross-species homologs |
| `get_gene_phenotypes` | Phenotype annotations |
| `get_gene_interactions` | Molecular and genetic interactions |
| `get_gene_alleles` | Alleles/variants for a gene |
| `search_alleles` | Search alleles by name |
| `get_species_list` | List supported model organisms |

## Gene ID Formats

| Species | Format | Example |
|---------|--------|---------|
| Human | `HGNC:*` | `HGNC:1100` |
| Mouse | `MGI:*` | `MGI:95892` |
| Rat | `RGD:*` | `RGD:3889` |
| Zebrafish | `ZFIN:ZDB-GENE-*` | `ZFIN:ZDB-GENE-990415-72` |
| Fly | `FB:FBgn*` | `FB:FBgn0000017` |
| Worm | `WB:WBGene*` | `WB:WBGene00000898` |
| Yeast | `SGD:S*` | `SGD:S000002536` |
| Xenopus | `Xenbase:XB-GENE-*` | `Xenbase:XB-GENE-485905` |

## Data Sources

- [Alliance of Genome Resources API](https://www.alliancegenome.org/api)
- [AllianceMine](https://www.alliancegenome.org/alliancemine)

## License

MIT
