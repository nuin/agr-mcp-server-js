# MCP Connection Failure Diagnosis & Fix

## Problem Summary

Fresh npm installation of `agr-mcp-server-enhanced@3.2.2` failed to connect with Claude Code, showing:
```
❯ 1. agr-genomics             ✘ failed · Enter to view details
```

## Root Cause

**Stdout pollution in MCP server binaries corrupting JSON-RPC protocol handshake**

The server binaries (`agr-server-simple.js` and `agr-server-simple-natural.js`) contained `console.log()` statements that wrote to stdout during initialization:

```javascript
// PROBLEMATIC CODE (in version 3.2.2):
async function main() {
  console.log('Starting Simple AGR MCP Server...');  // ❌ Writes to stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Simple AGR MCP Server started');      // ❌ Writes to stdout
}
```

**Why this breaks MCP:**
- The Model Context Protocol (MCP) uses stdin/stdout for JSON-RPC communication
- Stdout **must** contain ONLY valid JSON-RPC messages
- Any text (like `"Starting Simple AGR MCP Server..."`) corrupts the protocol
- Claude Code receives invalid JSON and rejects the connection

## The Fix (Version 3.2.3)

### Changes Made

1. **Removed console.log statements from server startup**
   ```javascript
   // FIXED CODE (in version 3.2.3):
   async function main() {
     // Silent startup - no stdout pollution for MCP protocol
     const transport = new StdioServerTransport();
     await server.connect(transport);
   }
   ```

2. **All logging redirected to stderr** (not stdout)
   - Errors still go to `console.error()` which writes to stderr
   - Stdout remains clean for JSON-RPC protocol

3. **Added MCP protocol compliance test**
   - Automated test in `test-mcp-protocol.js`
   - Verifies stdout contains only valid JSON-RPC messages
   - Prevents future regressions

### Files Modified

- `/src/agr-server-simple.js` - Main MCP server binary
- `/src/agr-server-simple-natural.js` - Natural language MCP server binary
- `/package.json` - Version bumped to 3.2.3
- `/CHANGELOG.md` - Documented the fix
- `/test-mcp-protocol.js` - New compliance test (added)

## Verification Steps for Test User

### Step 1: Verify Current Version

```bash
# Check installed version (should show OLD 3.2.2)
npm list -g agr-mcp-server-enhanced

# Check what binary outputs (should show pollution)
timeout 2s agr-mcp-server 2>/dev/null | head -5
# PROBLEM: You'll see "Starting Simple AGR MCP Server..." text
```

### Step 2: Install Fixed Version

```bash
# Clean cache and install v3.2.3
npm cache clean --force
npm uninstall -g agr-mcp-server-enhanced
npm install -g agr-mcp-server-enhanced@3.2.3

# Verify new version
npm list -g agr-mcp-server-enhanced
# Should show: agr-mcp-server-enhanced@3.2.3
```

### Step 3: Verify Fix

```bash
# Test binary produces clean output
timeout 2s agr-mcp-server 2>/dev/null | head -1
# SUCCESS: Should show JSON like {"jsonrpc":"2.0"...} or nothing
# NO "Starting..." text should appear

# Verify it's executable
which agr-mcp-server
ls -la $(which agr-mcp-server)
# Should show -rwxr-xr-x permissions
```

### Step 4: Restart Claude Code

**IMPORTANT**: Must completely restart Claude Code for changes to take effect

```bash
# Kill all Claude Code processes
pkill -f "claude"

# Restart Claude Code application
# (Method varies by OS)
```

### Step 5: Test Connection

In Claude Code:
```bash
# Check MCP server status
claude mcp list

# Should now show:
# ✓ agr-genomics             Connected
```

## Diagnostic Commands

If connection still fails, run these:

### Check Binary Resolution

```bash
# 1. Which binary is being used?
which agr-mcp-server

# 2. Is it the correct version?
head -5 $(which agr-mcp-server)
# Should NOT contain console.log statements

# 3. What does stdout show?
timeout 2s agr-mcp-server 2>/dev/null
# Should be empty or valid JSON only
```

### Check Node.js Version

```bash
node --version
# Must be >=18.0.0
```

### Check Claude Code Config

```bash
# View MCP configuration
cat ~/.config/claude/mcp_config.json

# Verify it references the correct command
# Should have: "command": "agr-mcp-server"
```

### Manual Test

```bash
# Test the binary directly
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | agr-mcp-server

# Should output valid JSON-RPC response
# Should NOT output any text like "Starting..."
```

## Common Issues & Solutions

### Issue 1: Still seeing "Starting..." text

**Cause**: npm cached old version or wrong binary

**Solution**:
```bash
npm cache clean --force
npm uninstall -g agr-mcp-server-enhanced
npm install -g agr-mcp-server-enhanced@3.2.3
which agr-mcp-server  # Verify path
```

### Issue 2: "Permission denied" error

**Cause**: Binary not executable

**Solution**:
```bash
chmod +x $(which agr-mcp-server)
chmod +x $(which agr-mcp-natural)
```

### Issue 3: Old version still appears

**Cause**: Multiple installations or wrong PATH

**Solution**:
```bash
# Find all installations
find /usr -name "agr-mcp-server" 2>/dev/null
npm root -g  # Show global node_modules location

# Uninstall from all locations
npm uninstall -g agr-mcp-server-enhanced

# Verify removal
which agr-mcp-server
# Should show: not found

# Fresh install
npm install -g agr-mcp-server-enhanced@3.2.3
```

### Issue 4: Claude Code doesn't reconnect

**Cause**: Claude Code caches MCP server state

**Solution**:
```bash
# Complete restart required
pkill -f claude

# Remove Claude Code cache (if needed)
rm -rf ~/.config/claude/mcp_cache  # Path may vary

# Restart Claude Code
```

## Technical Details

### MCP Protocol Requirements

The Model Context Protocol (MCP) has strict requirements:

1. **Stdout**: MUST contain ONLY JSON-RPC messages
   - Example valid output: `{"jsonrpc":"2.0","id":1,"result":...}`
   - Example invalid output: `Starting server...`

2. **Stderr**: CAN contain logs, errors, debugging output
   - Example: `[ERROR] Connection failed`

3. **Stdin**: Receives JSON-RPC requests from Claude Code

4. **Message Format**: Each message is one complete JSON object per line

### Why console.log() Breaks MCP

```javascript
// This writes to stdout (BAD for MCP):
console.log('Starting server...')

// This writes to stderr (OK for MCP):
console.error('Starting server...')

// This writes to stderr (OK for MCP):
logger.info('Starting server...')  // if logger uses stderr
```

### How to Verify Clean Stdout

```bash
# Test 1: No text pollution
timeout 2s agr-mcp-server 2>/dev/null | head -1
# Should be empty OR valid JSON only

# Test 2: Valid JSON-RPC
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | agr-mcp-server 2>/dev/null
# Should output only JSON response

# Test 3: Check for "Starting" or other text
agr-mcp-server 2>/dev/null | grep -i "starting"
# Should return nothing (no matches)
```

## Success Indicators

You'll know the fix worked when:

1. ✅ `npm list -g agr-mcp-server-enhanced` shows version 3.2.3
2. ✅ `timeout 2s agr-mcp-server 2>/dev/null | head -1` shows JSON or nothing
3. ✅ `claude mcp list` shows "✓ agr-genomics Connected"
4. ✅ You can query: "Search for BRCA1 genes" in Claude Code
5. ✅ No "failed" status in MCP server list

## Support

If issues persist after following these steps:

1. **Collect diagnostics**:
   ```bash
   # Save output to file
   {
     echo "=== Version ==="
     npm list -g agr-mcp-server-enhanced

     echo -e "\n=== Binary Location ==="
     which agr-mcp-server

     echo -e "\n=== Stdout Test ==="
     timeout 2s agr-mcp-server 2>/dev/null | head -5

     echo -e "\n=== Node Version ==="
     node --version

     echo -e "\n=== Binary Content (first 20 lines) ==="
     head -20 $(which agr-mcp-server)
   } > mcp-diagnostics.txt

   cat mcp-diagnostics.txt
   ```

2. **Create GitHub issue**: https://github.com/nuin/agr-mcp-server-js/issues

3. **Include**:
   - Output of diagnostics script above
   - Operating system and version
   - Claude Code version
   - Error message from Claude Code (press Enter on failed server)

## Summary

- **Problem**: console.log() in server startup corrupted MCP JSON-RPC protocol
- **Fix**: Removed all console.log statements from server initialization
- **Version**: 3.2.3 fixes the issue completely
- **Verification**: `timeout 2s agr-mcp-server 2>/dev/null` should show NO text or valid JSON only
- **Result**: Claude Code now connects successfully with ✓ Connected status
