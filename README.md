# AGR MCP Server

MCP server for querying [Alliance of Genome Resources](https://www.alliancegenome.org) - genomics data across model organisms.

## Installation

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

### Claude Code (CLI)

Add to `~/.claude/settings.json`:

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

### Cursor

Add to Cursor settings (Settings > MCP Servers):

```json
{
  "agr-genomics": {
    "command": "npx",
    "args": ["-y", "agr-mcp-server"]
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

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

### From source

```bash
git clone https://github.com/nuin/agr-mcp-server-js.git
cd agr-mcp-server-js
npm install && npm run build
```

Then use the local path in your config:

```json
{
  "mcpServers": {
    "agr-genomics": {
      "command": "node",
      "args": ["/path/to/agr-mcp-server-js/dist/index.js"]
    }
  }
}
```

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

- **Search & gene data**: [Alliance of Genome Resources API](https://www.alliancegenome.org/api)
- **Advanced search**: [AllianceMine](https://www.alliancegenome.org/alliancemine)

## License

MIT
