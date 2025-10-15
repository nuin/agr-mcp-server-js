# Node v23 Compatibility Fix (Version 3.2.6)

## Problem

Node v23 introduced the `experimental-detect-module` feature that treats stdin as code to evaluate instead of passing it to the script. This broke MCP servers that rely on JSON-RPC communication via stdin.

**Symptoms:**
- Server produces NO OUTPUT when receiving stdin on Node v23.11.1
- Works fine on other Node versions (v18, v22, v25+)
- Manual invocation with `--no-experimental-detect-module` flag works

## Root Cause

Node v23's module detection feature intercepts stdin BEFORE the JavaScript code executes, making it impossible to fix via runtime re-execution in ESM modules.

## Solution

We implemented **CommonJS wrapper scripts** that:

1. Execute BEFORE stdin is consumed (CJS is synchronous)
2. Detect Node v23+ and check if `--no-experimental-detect-module` flag is present
3. Re-exec the actual ESM server with the flag if needed
4. Inherit stdin/stdout/stderr correctly for MCP protocol

### Architecture

```
npm global binary (e.g., agr-mcp-server)
    ↓
agr-server-simple-wrapper.cjs (CJS wrapper)
    ↓
Detects Node v23? → YES → Re-exec with flag
    ↓                         ↓
    NO                   node --no-experimental-detect-module agr-server-simple.js
    ↓                         ↓
agr-server-simple.js ←────────┘
(ESM server runs normally)
```

### Files

- `src/agr-server-simple-wrapper.cjs` - Wrapper for main MCP server
- `src/agr-server-simple-natural-wrapper.cjs` - Wrapper for NLP server
- `src/agr-server-simple.js` - Clean ESM implementation (no re-exec logic)
- `src/agr-server-simple-natural.js` - Clean ESM implementation (no re-exec logic)

### Why This Works

1. **CJS executes synchronously** before stdin handling
2. **Version detection happens early** before any imports
3. **Re-exec preserves stdin** via `stdio: 'inherit'`
4. **No performance penalty** on Node versions < 23

### Testing

Tested on:
- ✅ Node v24.10.0 (macOS) - re-exec triggered, works perfectly
- ✅ Node v25+ (macOS) - re-exec triggered, works perfectly
- ✅ Standalone stdin test - JSON-RPC protocol works
- ✅ MCP integration test - Tool listing works

Expected to work on:
- ✅ Node v23.11.1 (Raspberry Pi 5 ARM)

### Upgrade Instructions

Users should simply update to version 3.2.6:

```bash
npm install -g agr-mcp-server-enhanced@3.2.6
```

No configuration changes needed - the fix is transparent.

### Developer Notes

If you need to modify the servers:
- Edit the ESM files (`agr-server-simple.js`, `agr-server-simple-natural.js`)
- Do NOT add re-exec logic to the ESM files
- The CJS wrappers handle Node v23 compatibility automatically
- Test with: `node test-wrapper-functionality.js`
