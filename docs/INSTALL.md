# Global Installation Guide

## 🚀 Install the Alliance CLI Globally

### Option 1: Install from npm (when published)
```bash
npm install -g agr-mcp-server-enhanced
```

### Option 2: Install from local directory
```bash
# In the project directory
npm install -g .

# Or link for development
npm link
```

### Option 3: Direct installation from GitHub
```bash
npm install -g https://github.com/nuin/agr-mcp-server-js.git
```

## 🧬 Usage with Natural Language

Once installed globally, you can use the `alliance` command from anywhere:

### Your Example:
```bash
alliance "find BRCA1 genes in xenopus in the Alliance"
```

### More Examples:
```bash
# Gene searches
alliance "find TP53 genes in human"
alliance "search for insulin genes in mouse" 
alliance "BRCA1 genes in zebrafish"

# Disease searches  
alliance "find breast cancer diseases"
alliance "search for diabetes diseases"
alliance "cancer diseases"

# Gene information
alliance "get information about HGNC:1100"
alliance "info about MGI:104537" 
alliance "details for RGD:2218"

# BLAST searches
alliance "blast sequence ATCGATCGATCGATCG"
alliance "search sequence MKTVRQERLKSIVRIL"

# Performance stats
alliance "cache statistics"
alliance "server performance"
```

## 🎯 Natural Language Patterns

The CLI understands these patterns:

### Gene Searches
- `"find [GENE] genes"`
- `"find [GENE] genes in [SPECIES]"`
- `"search for [GENE] genes"`
- `"[GENE] genes in [SPECIES]"`

### Disease Searches  
- `"find [DISEASE] diseases"`
- `"search for [DISEASE] diseases"`
- `"[DISEASE] diseases"`

### Gene Information
- `"get info about [GENE:ID]"`
- `"information for [GENE:ID]"`
- `"details about [GENE:ID]"`

### Species Shortcuts
- `human` → Homo sapiens
- `mouse` → Mus musculus  
- `rat` → Rattus norvegicus
- `zebrafish` → Danio rerio
- `xenopus` → Xenopus
- `fly` → Drosophila melanogaster
- `worm` → Caenorhabditis elegans
- `yeast` → Saccharomyces cerevisiae

## 🔧 Troubleshooting

### Command not found
```bash
# Check if globally installed
npm list -g agr-mcp-server-enhanced

# Reinstall if needed
npm install -g .
```

### Permission errors
```bash
# Use sudo on Unix/Mac
sudo npm install -g .

# Or configure npm to use different directory
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Query timeout
```bash
# Some queries take longer, the CLI will wait up to 15 seconds
# If it times out, try a simpler query first to warm up the server
alliance "cache statistics"
```

## 📖 Help
```bash
# Show help
alliance --help
alliance -h

# Or just run without arguments
alliance
```

## 🎉 Ready to Use!

After installation, you can query the Alliance of Genome Resources from anywhere using natural language!