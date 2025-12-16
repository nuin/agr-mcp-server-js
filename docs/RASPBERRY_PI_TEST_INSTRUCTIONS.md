# Raspberry Pi Node v23 Testing Instructions

## What Was Fixed

Version **3.2.6** includes a critical fix for Node v23 stdin handling. The MCP servers now use CommonJS wrapper scripts that correctly handle the `--no-experimental-detect-module` flag **before** stdin is consumed.

## Testing on Raspberry Pi 5 (Node v23.11.1)

### Step 1: Update the Package

```bash
npm install -g agr-mcp-server-enhanced@3.2.6
```

### Step 2: Verify Installation

```bash
which agr-mcp-server
which agr-mcp-natural
```

You should see paths like:
- `/usr/local/bin/agr-mcp-server`
- `/usr/local/bin/agr-mcp-natural`

### Step 3: Test stdin Handling

Create a test file `test-stdin.json`:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

Test the main server:
```bash
agr-mcp-server < test-stdin.json
```

Expected output: JSON response with 7 tools listed

Test the NLP server:
```bash
agr-mcp-natural < test-stdin.json
```

Expected output: JSON response with 1 tool ("ask")

### Step 4: Test MCP Integration

If you're using Claude Code or another MCP client, update your configuration to use the global binaries:

```json
{
  "mcpServers": {
    "agr-genomics": {
      "command": "agr-mcp-server",
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Step 5: Verify Node Version Detection

Check that the wrapper is working:
```bash
node --version
# Should show v23.11.1

agr-mcp-server --version
# Should work without errors (exits with code 0)
```

## What to Look For

### ✅ Success Indicators:
- JSON-RPC responses appear on stdout
- No "experimental-detect-module" errors
- Tool listing works correctly
- MCP client can communicate with the server

### ❌ Failure Indicators:
- No output at all when piping JSON to stdin
- Errors about "experimental-detect-module"
- Timeout or hang when MCP client tries to connect

## Technical Details

The fix works by:
1. Using CJS wrapper scripts that execute synchronously
2. Detecting Node v23+ before any ESM imports
3. Re-executing with `--no-experimental-detect-module` if needed
4. Inheriting stdin/stdout/stderr correctly

## Troubleshooting

### If you still get no output:

1. Check Node version:
   ```bash
   node --version
   ```

2. Test wrapper directly:
   ```bash
   node /path/to/node_modules/agr-mcp-server-enhanced/src/agr-server-simple-wrapper.cjs < test-stdin.json
   ```

3. Check for errors:
   ```bash
   agr-mcp-server < test-stdin.json 2>&1
   ```

4. Test with explicit flag (should also work):
   ```bash
   node --no-experimental-detect-module \
     /path/to/node_modules/agr-mcp-server-enhanced/src/agr-server-simple.js < test-stdin.json
   ```

### Still having issues?

Please report with:
- Node version: `node --version`
- Platform: `uname -a`
- Output of: `npm list -g agr-mcp-server-enhanced`
- Full error messages (if any)

## Expected Behavior Change

**Before (v3.2.5):**
```bash
$ agr-mcp-server < test-stdin.json
(no output, hangs forever)
```

**After (v3.2.6):**
```bash
$ agr-mcp-server < test-stdin.json
{"result":{"tools":[...]},"jsonrpc":"2.0","id":1}
```

## Contact

If the fix works, great! If not, please open an issue at:
https://github.com/nuin/agr-mcp-server-js/issues

Include all the troubleshooting information above.
