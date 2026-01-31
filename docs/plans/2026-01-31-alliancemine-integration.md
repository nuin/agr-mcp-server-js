# AllianceMine Integration Design

## Overview

Full integration with the new AllianceMine instance at `https://alliancemine.alliancegenome.org/alliancemine/service`.

## New Tools (12 total)

| Tool | Purpose | Auth Required |
|------|---------|---------------|
| `mine_search` | Keyword search across AllianceMine | No |
| `mine_query` | Run PathQuery XML directly | No |
| `mine_query_builder` | Simplified JSON-based queries | No |
| `mine_natural_query` | Natural language to PathQuery | No |
| `mine_list_templates` | Discover available query templates | No |
| `mine_run_template` | Execute a template with parameters | No |
| `mine_get_lists` | List available gene lists | No |
| `mine_get_list` | Get contents of a specific list | No |
| `mine_create_list` | Create a new list | Yes |
| `mine_delete_list` | Delete a list | Yes |
| `mine_add_to_list` | Add items to existing list | Yes |

## Query Builder DSL

```typescript
{
  from: string,           // Root class: "Gene", "Protein", "Disease", etc.
  select: string[],       // Fields to return
  where?: {               // Constraints (AND logic)
    [field: string]: string | { op: string, value: string }
  },
  joins?: string[],       // OUTER JOIN paths
  sort?: { field: string, direction: "ASC" | "DESC" },
  limit?: number          // Default 100
}
```

**Supported operators:** `=`, `!=`, `CONTAINS`, `LIKE`, `<`, `>`, `<=`, `>=`, `ONE OF`, `NONE OF`, `IS NULL`, `IS NOT NULL`

## Authentication

- Environment variable: `ALLIANCEMINE_TOKEN`
- Read-only tools work without auth
- Write tools require token, return clear error if missing

## Curated Templates

- Gene → Diseases
- Gene → Phenotypes
- Gene → Pathways
- Pathway → Genes
- Gene → Orthologs

## URL Change

```typescript
// Old
const ALLIANCEMINE_URL = "https://www.alliancegenome.org/alliancemine/service";

// New
const ALLIANCEMINE_URL = "https://alliancemine.alliancegenome.org/alliancemine/service";
```
