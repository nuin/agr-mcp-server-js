# Claude Desktop Installation Guide

This document explains how to configure the AGR MCP Server with Claude Desktop.

## Prerequisites

- Node.js 18 or higher
- Claude Desktop application installed
- This AGR MCP Server project cloned locally

## Installation Options

### Option 1: Global NPM Installation (Recommended)

```bash
# Install globally via npm
npm install -g agr-mcp-server-enhanced

# Or run directly with npx (no installation)
npx agr-mcp-server-enhanced
```

### Option 2: Local Development Installation

```bash
cd /path/to/agr-mcp-server-js
npm install
npm run setup
```

## Configure Claude Desktop

### For Global Installation (Option 1)

**Configuration File Locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Configuration Content:**

```json
{
  "mcpServers": {
    "agr-genomics-enhanced-js": {
      "command": "agr-mcp-server",
      "args": [],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### For Local Installation (Option 2)

```json
{
  "mcpServers": {
    "agr-genomics-enhanced-js": {
      "command": "node",
      "args": ["/path/to/agr-mcp-server-js/src/agr-server-enhanced.js"],
      "cwd": "/path/to/agr-mcp-server-js",
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Important:** Replace `/path/to/agr-mcp-server-js` with the absolute path to your cloned repository.

### 4. Restart Claude Desktop

Close and reopen Claude Desktop for the configuration to take effect.

## Verification

Once configured, you should have access to these genomics tools in Claude Desktop:

- `search_genes` - Gene search with species filtering
- `get_gene_info` - Detailed gene information
- `get_gene_diseases` - Disease associations
- `search_diseases` - Disease search functionality
- `get_gene_expression` - Expression data across tissues
- `find_orthologs` - Cross-species orthology analysis
- `blast_sequence` - BLAST search with auto-detection
- `get_species_list` - Supported model organisms
- `get_cache_stats` - Performance monitoring
- `clear_cache` - Cache management

## Testing

You can test the server independently using these CLI commands:

```bash
# Test basic functionality
npm run query genes BRCA1

# Test disease search
npm run query diseases "breast cancer"

# Get gene information
npm run query info HGNC:1100

# Check server health
npm run health-check
```

## Troubleshooting

1. **Server not appearing in Claude Desktop:**
   - Verify the absolute path in the configuration
   - Check that Node.js is in your system PATH
   - Restart Claude Desktop completely

2. **Permission errors:**
   - Ensure the server files are readable
   - Check Node.js execution permissions

3. **Connection issues:**
   - Test the server with `npm start`
   - Check logs with `LOG_LEVEL=debug npm start`

## Optional Configuration

You can customize the server behavior with these environment variables in the config:

```json
{
  "mcpServers": {
    "agr-genomics-enhanced-js": {
      "command": "node",
      "args": ["/path/to/agr-mcp-server-js/src/agr-server-enhanced.js"],
      "cwd": "/path/to/agr-mcp-server-js",
      "env": {
        "LOG_LEVEL": "info",
        "API_TIMEOUT": "30000",
        "CACHE_TTL": "300",
        "CACHE_MAX_KEYS": "1000"
      }
    }
  }
}
```