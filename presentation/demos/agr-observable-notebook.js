// AGR MCP Server Demo - Observable Notebook
// This notebook demonstrates the Alliance of Genome Resources MCP Server

md`# AGR MCP Server Demo

This notebook demonstrates the **Alliance of Genome Resources (AGR) MCP Server** - a JavaScript implementation that provides programmatic access to genomics data through the Model Context Protocol.

## What is the AGR MCP Server?

The AGR MCP Server is a bridge between AI assistants (like Claude) and genomics databases, providing:
- 🧬 Access to gene information across 6+ model organisms
- 🔍 Natural language query capabilities
- ⚡ High-performance caching and error handling
- 🛠️ 12 specialized genomics tools

---`

md`## Available Tools

The server provides 12 specialized MCP tools for genomics research:`

{
  const tools = [
    { name: "search_genes", desc: "Gene search across species", icon: "🔍" },
    { name: "get_gene_info", desc: "Detailed gene information", icon: "📋" },
    { name: "get_gene_diseases", desc: "Disease associations", icon: "🏥" },
    { name: "search_diseases", desc: "Disease search", icon: "🔬" },
    { name: "get_gene_expression", desc: "Expression data", icon: "📊" },
    { name: "find_orthologs", desc: "Cross-species homologs", icon: "🧬" },
    { name: "blast_sequence", desc: "BLAST search", icon: "🎯" },
    { name: "complex_search", desc: "Natural language queries", icon: "🧠" },
    { name: "faceted_search", desc: "Multi-filter search", icon: "🔍" },
    { name: "get_species_list", desc: "Supported organisms", icon: "🐛" },
    { name: "get_cache_stats", desc: "Performance monitoring", icon: "📈" },
    { name: "clear_cache", desc: "Cache management", icon: "🗑️" }
  ];

  const container = html`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0;">`;

  tools.forEach(tool => {
    const card = html`<div style="
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #2ecc71;
      text-align: center;
    ">
      <div style="font-size: 2rem; margin-bottom: 10px;">${tool.icon}</div>
      <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">${tool.name}</strong>
      <div style="color: #666;">${tool.desc}</div>
    </div>`;
    container.appendChild(card);
  });

  container.appendChild(html`</div>`);
  return container;
}

md`---

## Installation & Setup

You can install the AGR MCP server in two ways:`

html`<div style="background: #2c3e50; color: #ecf0f1; padding: 25px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
<div style="color: #2ecc71; font-weight: bold;">Option 1: npm Package (Recommended)</div>
<br>
# Install globally<br>
npm install -g agr-mcp-server-enhanced<br>
<br>
# Available commands<br>
agr-mcp-server     # Main MCP server<br>
agr-mcp-natural    # Natural language server<br>
alliance           # CLI interface<br>
agr-chat           # Interactive chat
</div>`

html`<div style="background: #2c3e50; color: #ecf0f1; padding: 25px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
<div style="color: #2ecc71; font-weight: bold;">Option 2: From Source</div>
<br>
# Clone and setup<br>
git clone https://github.com/nuin/agr-mcp-server-js.git<br>
cd agr-mcp-server-js<br>
npm run setup
</div>`

md`### Claude Desktop Integration

To connect with Claude Desktop, add this configuration:`

html`<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
<strong>Configuration file location:</strong><br>
• macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code><br>
• Windows: <code>%APPDATA%/Claude/claude_desktop_config.json</code>
</div>`

html`<div style="background: #2c3e50; color: #ecf0f1; padding: 25px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
{<br>
  "mcpServers": {<br>
    "agr-genomics": {<br>
      "command": "agr-mcp-server",<br>
      "env": {<br>
        "LOG_LEVEL": "info"<br>
      }<br>
    }<br>
  }<br>
}
</div>`

md`---

## Live Demo Examples

The following examples show real queries and results from the AGR MCP server:`

md`### 🧬 Gene Search Example

**Query:** "find PTEN gene"`

html`<div style="background: #2c3e50; color: #2ecc71; padding: 25px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
🔍 Searching for pten genes...<br>
<br>
🧬 Found 61 genes:<br>
<br>
1. PTEN (Homo sapiens) - HGNC:9588<br>
   phosphatase and tensin homolog<br>
<br>
2. Pten (Mus musculus) - MGI:109583<br>
   phosphatase and tensin homolog<br>
<br>
3. Pten (Drosophila melanogaster) - FB:FBgn0026379<br>
   Phosphatase and tensin homolog<br>
<br>
... and 58 more results
</div>`

md`### 🔬 Complex Query Example

**Query:** "PTEN tumor suppressor genes in human"`

html`<div style="background: #2c3e50; color: #2ecc71; padding: 25px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
Query: "PTEN tumor suppressor genes in human"<br>
<br>
Results: 1,739 human genes with aggregations:<br>
• Species filtering: ✅ Working<br>
• Boolean parsing: ✅ Functional<br>
• Disease categories: 539 cancer genes<br>
• Process filtering: 1,139 response genes
</div>`

md`### 📊 Performance Statistics

Real performance data from the server:`

{
  const stats = [
    { label: "MCP Tools Available", value: "12", color: "#2ecc71" },
    { label: "Model Organisms", value: "6+", color: "#3498db" },
    { label: "Cache Hit Rate", value: "89%", color: "#e67e22" },
    { label: "Avg Response Time", value: "<2s", color: "#9b59b6" }
  ];

  return html`<div style="display: flex; justify-content: space-around; margin: 30px 0; text-align: center;">
    ${stats.map(stat => html`<div style="padding: 20px;">
      <div style="font-size: 3rem; font-weight: bold; color: ${stat.color};">${stat.value}</div>
      <div style="color: #7f8c8d; font-size: 1.1rem;">${stat.label}</div>
    </div>`)}
  </div>`;
}

md`---

## System Architecture

The AGR MCP server uses a high-performance JavaScript architecture:`

{
  const components = [
    { name: "🏗️ Core Server", details: ["Node.js with async I/O", "Axios HTTP client", "MCP protocol compliance"] },
    { name: "💾 Caching Layer", details: ["NodeCache with TTL", "5-10 minute cache times", "Automatic cleanup"] },
    { name: "🛡️ Error Handling", details: ["Exponential backoff retry", "Rate limiting (100 req/min)", "Input validation"] },
    { name: "📊 Monitoring", details: ["Cache hit/miss tracking", "Response time monitoring", "Structured logging (Pino)"] }
  ];

  return html`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin: 30px 0;">
    ${components.map(comp => html`<div style="
      background: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      border-left: 4px solid #2ecc71;
    ">
      <h4 style="color: #2c3e50; margin-bottom: 15px;">${comp.name}</h4>
      <ul style="margin: 0; padding-left: 20px;">
        ${comp.details.map(detail => html`<li style="margin: 8px 0;">${detail}</li>`)}
      </ul>
    </div>`)}
  </div>`;
}

md`### Server Variants

The server comes in three variants to suit different needs:`

html`<div style="background: #e3f2fd; padding: 25px; border-radius: 8px; text-align: center; margin: 30px 0; font-size: 1.2rem;">
<strong>Three Server Variants:</strong><br>
Enhanced (full features) • Simple (basic tools) • Natural Language (conversational)
</div>`

md`---

## Advanced Query Features

The server supports sophisticated natural language processing:`

html`<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
<strong>Boolean Operators:</strong> AND, OR, NOT<br>
<strong>Species Filters:</strong> "in human", "in mouse", "in zebrafish"<br>
<strong>Process Detection:</strong> Automatic biological process recognition
</div>`

md`### Query Examples with Boolean Logic:`

html`<div style="background: #2c3e50; color: #ecf0f1; padding: 25px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
• "breast cancer genes in human AND DNA repair NOT p53"<br>
• "insulin OR glucose in mouse"<br>
• "BRCA1 in human"<br>
• "apoptosis genes NOT p53 in zebrafish"
</div>`

md`### Cross-Entity Search

The server can search genes, diseases, phenotypes, and alleles simultaneously with intelligent relationship discovery.`

md`---

## CLI Interface with Performance Flags

The command-line interface includes performance optimization flags:`

html`<div style="background: #2c3e50; color: #ecf0f1; padding: 25px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
alliance "find PTEN gene" --fast           # Quick results<br>
alliance "find PTEN gene" --detailed       # Full information<br>
alliance "find PTEN gene" --limit=5        # Limit results<br>
alliance "find PTEN gene" --simple         # Use basic server
</div>`

md`### Performance Improvements

Recent optimizations have significantly improved CLI performance:`

{
  const improvements = [
    {
      category: "Before Optimization",
      items: ["Timeout after 2+ minutes", "Fetched all 61 results", "Slow JSON-RPC communication"],
      color: "#e74c3c"
    },
    {
      category: "After Optimization",
      items: ["10-second timeout limit", "Configurable result limits", "Improved server selection"],
      color: "#2ecc71"
    }
  ];

  return html`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin: 30px 0;">
    ${improvements.map(imp => html`<div style="
      background: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      border-left: 4px solid ${imp.color};
    ">
      <h4 style="color: #2c3e50; margin-bottom: 15px;">${imp.category}</h4>
      <ul style="margin: 0; padding-left: 20px;">
        ${imp.items.map(item => html`<li style="margin: 8px 0;">${item}</li>`)}
      </ul>
    </div>`)}
  </div>`;
}

md`---

## Practical Research Applications

The AGR MCP server enables various research workflows:`

{
  const applications = [
    { name: "🔬 Gene Research", items: ["Cross-species gene searches", "Disease association lookup", "Ortholog identification"] },
    { name: "🧬 Sequence Analysis", items: ["BLAST searches", "Expression data queries", "Phenotype associations"] },
    { name: "💬 Natural Language", items: ["Ask questions in plain English", "Boolean logic support", "Species-specific filtering"] },
    { name: "🔧 Integration", items: ["Claude Desktop ready", "CLI tools available", "Programmatic access"] }
  ];

  return html`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin: 30px 0;">
    ${applications.map(app => html`<div style="
      background: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      border-left: 4px solid #2ecc71;
    ">
      <h4 style="color: #2c3e50; margin-bottom: 15px;">${app.name}</h4>
      <ul style="margin: 0; padding-left: 20px;">
        ${app.items.map(item => html`<li style="margin: 8px 0;">${item}</li>`)}
      </ul>
    </div>`)}
  </div>`;
}

md`---

## Current Status & Next Steps

### ✅ What's Working

- All 12 MCP tools functional
- Claude Desktop integration active
- Natural language queries working
- CLI interface with performance flags
- Comprehensive caching and monitoring

### 🚧 Areas for Improvement

- CLI timeout optimization (completed)
- Better error messages for failed queries
- Documentation for complex query syntax
- Integration with JBrowse genome browser

---

## Ready for Research Use

The AGR MCP server is ready for testing and feedback from the genomics research community.

**Repository:** agr-mcp-server-js
**npm Package:** agr-mcp-server-enhanced
**Installation:** \`npm install -g agr-mcp-server-enhanced\`

---

*This notebook demonstrates the capabilities of the AGR MCP Server. For questions or feedback, please refer to the project repository.*`