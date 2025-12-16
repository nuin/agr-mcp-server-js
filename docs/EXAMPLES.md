# AGR MCP Server Query Examples

Easy ways to query the Enhanced AGR MCP Server without writing complex JSON-RPC.

## 🚀 Quick Start with Query Helper

### Interactive Mode
```bash
node scripts/query-helper.js
```

Then use simple commands:
```
🧬 AGR Query> genes BRCA1
🧬 AGR Query> diseases "breast cancer"  
🧬 AGR Query> info HGNC:1100
🧬 AGR Query> cache
🧬 AGR Query> quit
```

### Command Line Mode
```bash
# Search for genes
node scripts/query-helper.js genes BRCA1

# Search for diseases
node scripts/query-helper.js diseases "breast cancer"

# Get gene information
node scripts/query-helper.js info HGNC:1100

# Check cache stats
node scripts/query-helper.js cache
```

## 📖 Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `genes <query>` | Search for genes by name/symbol | `genes BRCA1` |
| `diseases <query>` | Search for diseases | `diseases "breast cancer"` |
| `info <gene_id>` | Get detailed gene information | `info HGNC:1100` |
| `gene-diseases <gene_id>` | Get diseases for a gene | `gene-diseases HGNC:1100` |
| `orthologs <gene_id>` | Find orthologous genes | `orthologs HGNC:1100` |
| `blast <sequence>` | BLAST sequence search | `blast ATCGATCGATCG` |
| `cache` | Show performance statistics | `cache` |
| `species` | List available organisms | `species` |

## 🧪 Example Queries

### Gene Research
```bash
# Find BRCA1 gene variants
genes BRCA1

# Get detailed information for human BRCA1
info HGNC:1100

# Find BRCA1 orthologs in other species  
orthologs HGNC:1100

# What diseases are associated with BRCA1?
gene-diseases HGNC:1100
```

### Disease Research
```bash
# Search for cancer types
diseases cancer

# Find breast cancer variants
diseases "breast cancer"

# Search for genetic diseases
diseases "genetic disorder"
```

### Sequence Analysis
```bash
# BLAST a DNA sequence
blast ATGCCGAAATACGGGAAAGCTGTTGAGAGTGCAGCTGAG

# BLAST a protein sequence  
blast MKTVRQERLKSIVRILERSKEPVSGAQLAEELSVSRQVIVQDIAYLRSLGYNIVATPRGYVLAGG
```

### Performance Monitoring
```bash
# Check cache hit rates and performance
cache

# List all supported model organisms
species
```

## 🔧 Advanced Usage

### Gene ID Formats
The server accepts standard gene identifiers:
- Human: `HGNC:1100` (BRCA1)
- Mouse: `MGI:104537` (Brca1)
- Rat: `RGD:2218` (Brca1)
- Zebrafish: `ZFIN:ZDB-GENE-030131-1`
- Fly: `FB...`
- Worm: `WB...`
- Yeast: `SGD:S000000001`

### Search Tips
- Use quotes for multi-word queries: `diseases "breast cancer"`
- Gene symbols are case-sensitive: `BRCA1` vs `brca1`
- Partial matches work: `genes BRC` will find BRCA1, BRCA2, etc.
- Species names: `Homo sapiens`, `Mus musculus`, etc.

### Response Formats
All responses are formatted JSON with:
- Search results include relevance scores
- Gene info includes cross-references  
- Disease data includes associated genes
- Performance data shows cache statistics

## 🎯 Real-World Examples

### Cancer Research Workflow
```bash
# 1. Find cancer-related genes
genes "tumor suppressor"

# 2. Get details on TP53
info HGNC:11998

# 3. Find TP53 orthologs
orthologs HGNC:11998

# 4. What cancers involve TP53?
gene-diseases HGNC:11998
```

### Comparative Genomics
```bash
# 1. Search for developmental genes
genes "homeobox"

# 2. Pick a specific gene (e.g., HOXA1)
info HGNC:5100

# 3. Find orthologs across species
orthologs HGNC:5100

# 4. Check expression patterns
# (Note: expression data requires gene_id)
```

### Sequence Analysis Pipeline
```bash
# 1. BLAST unknown sequence
blast ATGAAGTCGAAAGGTCTGCTGAAGGCCTTCAGCAAGGCCGAC

# 2. Identify best matches
# (Review BLAST results)

# 3. Get gene information for matches
info <gene_id_from_blast>

# 4. Check disease associations
gene-diseases <gene_id_from_blast>
```

## 🔍 Troubleshooting

### Common Issues
- **Gene not found**: Check gene ID format (e.g., `HGNC:1100` not `hgnc:1100`)
- **Slow responses**: Check cache stats with `cache` command
- **API errors**: Some endpoints may be temporarily unavailable
- **Invalid sequence**: BLAST requires 10+ character DNA/protein sequences

### Performance Tips
- Results are cached for 5-10 minutes for faster repeat queries
- Use specific gene IDs when possible instead of searching
- Limit search results with smaller numbers for faster responses
- Check `cache` periodically to monitor hit rates

## 📊 Understanding Results

### Gene Search Results
- `total`: Total number of matches found
- `results`: Array of matching genes
- `score`: Relevance score (higher = better match)
- `species`: Organism the gene is from
- `synonyms`: Alternative names/symbols

### Disease Results  
- `definition`: Official disease description
- `synonyms`: Alternative disease names
- `crossReferences`: Links to external databases
- `relatedData`: Associated genes, alleles, models

### Cache Statistics
- `keys`: Number of cached items
- `hits`/`misses`: Cache performance metrics
- `uptime`: Server runtime in seconds
- `rateLimits`: API usage tracking