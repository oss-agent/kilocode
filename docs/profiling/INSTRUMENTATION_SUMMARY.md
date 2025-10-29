# Memory Profiling Instrumentation Summary

## Overview

This document summarizes the memory profiling instrumentation added to the Kilo Code extension to investigate and resolve grey screen/OOM issues.

**Date:** 2025-01-29  
**Status:** ✅ Complete - Ready for profiling sessions

---

## Changes Made

### 1. Enhanced Memory Diagnostics Utility

**File:** `src/utils/memoryDiagnostics.ts`

**Enhancements:**
- Added output channel support for logging to "Kilo-Code" output panel
- Implemented periodic memory monitoring with configurable intervals (default: 30s)
- Added uptime tracking in periodic snapshots
- All logs now go to both console and output channel

**New Methods:**
- `setOutputChannel(channel)` - Configure output channel for logging
- `startMonitoring(intervalMs)` - Start periodic memory snapshots
- `stopMonitoring()` - Stop periodic monitoring

**Usage:**
```typescript
MemoryDiagnostics.setOutputChannel(outputChannel)
MemoryDiagnostics.startMonitoring() // 30s intervals
MemoryDiagnostics.snapshot("Some event")
MemoryDiagnostics.stopMonitoring()
```

### 2. Extension Lifecycle Instrumentation

**File:** `src/extension.ts`

**Instrumentation Points Added:**

#### Activation Phase
- Extension activation started
- Before ClineProvider creation
- After ClineProvider creation
- Before CloudService creation
- After CloudService creation
- After webview provider registration
- Extension activation completed

#### Deactivation Phase
- Extension deactivation started
- Extension deactivation completed

**Code Locations:**
```typescript
// Line ~75: Start monitoring on activation
MemoryDiagnostics.setOutputChannel(outputChannel)
MemoryDiagnostics.snapshot("Extension activation started")
MemoryDiagnostics.startMonitoring()

// Line ~163-165: ClineProvider creation
MemoryDiagnostics.snapshot("Before ClineProvider creation")
const provider = new ClineProvider(...)
MemoryDiagnostics.created("ClineProvider", { viewType: "sidebar" })

// Line ~217-223: CloudService creation
MemoryDiagnostics.snapshot("Before CloudService creation")
cloudService = await CloudService.createInstance(...)
MemoryDiagnostics.created("CloudService")

// Line ~255: Webview registration
MemoryDiagnostics.snapshot("After webview provider registration")

// Line ~406: Activation complete
MemoryDiagnostics.snapshot("Extension activation completed")

// Line ~414: Deactivation started
MemoryDiagnostics.snapshot("Extension deactivation started")

// Line ~479-480: Deactivation complete
MemoryDiagnostics.snapshot("Extension deactivation completed")
MemoryDiagnostics.stopMonitoring()
```

### 3. Heap Snapshot Capture Script

**File:** `scripts/capture-heap-snapshot.ts`

**Purpose:** Programmatically capture heap snapshots from running extension host via inspector protocol.

**Features:**
- Connects to extension host inspector (default port 9229)
- Streams heap snapshot to file
- Supports custom labels for snapshots
- Provides usage instructions after capture

**Usage:**
```bash
# Basic capture
pnpm memory:heap-snapshot

# Labeled capture
pnpm memory:heap-snapshot -- --label baseline

# Custom port
pnpm memory:heap-snapshot -- --port 9230 --label my-snapshot
```

**Output:** `profiling/extension-heap-{label}-{timestamp}.heapsnapshot`

### 4. VS Code Launch Configuration

**File:** `.vscode/launch.json`

**Added Configuration:**
```json
{
  "name": "Profile Extension (Memory + CPU)",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}/src",
    "--disable-extensions",
    "--inspect-extensions=9229"
  ]
}
```

**Benefits:**
- One-click profiling setup
- Automatically enables inspector
- Isolated environment (other extensions disabled)

### 5. Profiling Directory Structure

**Created:**
- `/profiling/` - Root directory for profile data
- `/profiling/README.md` - Directory documentation
- `/profiling/.gitkeep` - Ensure directory tracked
- `/profiling/PROFILING_LOG.md` - Activity log template

**Updated `.gitignore`:**
```gitignore
profiling/*.heapsnapshot
profiling/*.cpuprofile
profiling/*.json
!profiling/README.md
```

### 6. Documentation

**Created Files:**

1. **`docs/profiling/extension-memory.md`** (Major)
   - Comprehensive profiling report template
   - Detailed reproduction steps
   - Instrumentation documentation
   - Analysis framework
   - Candidate subsystems for investigation
   - ~600 lines

2. **`docs/profiling/HEAP_PROFILING_QUICKSTART.md`** (Medium)
   - 5-minute setup guide
   - Quick reference commands
   - Interpretation guidelines
   - Troubleshooting tips
   - ~350 lines

3. **`docs/profiling/INSTRUMENTATION_SUMMARY.md`** (This file)
   - Summary of all changes
   - Configuration reference
   - Testing procedures

**Updated Files:**
- `docs/profiling/INDEX.md` - Added new docs and scripts

### 7. NPM Scripts

**File:** `package.json`

**Added Scripts:**
```json
{
  "memory:heap-snapshot": "tsx scripts/capture-heap-snapshot.ts",
  "memory:heap-snapshot:labeled": "tsx scripts/capture-heap-snapshot.ts --label"
}
```

**Existing Scripts (for reference):**
- `memory:profile` - 5-minute memory monitoring
- `memory:profile:extended` - 1-hour monitoring
- `memory:snapshot` - 30-second quick snapshot
- `memory:stress` - Stress test scenarios

---

## Configuration

### Enable Memory Diagnostics

Add to VS Code settings (required to see logging):

```json
{
  "kilo-code.enableMemoryDiagnostics": true
}
```

**Where:**
- `.vscode/settings.json` in workspace
- Or User Settings (`Cmd/Ctrl + ,` → search "memory diagnostics")

**Default:** `false` (no performance impact when disabled)

### Monitoring Interval

Currently hardcoded to 30 seconds. To change:

```typescript
// In src/extension.ts, line ~77
MemoryDiagnostics.startMonitoring(60000) // 60 seconds
```

**Options:**
- 10000 ms (10s) - High frequency (lots of logs)
- 30000 ms (30s) - **Default** - Good balance
- 60000 ms (60s) - Low frequency (less noise)

---

## How to Use

### Quick Start

1. Enable diagnostics in settings
2. Launch with "Profile Extension (Memory + CPU)"
3. Capture baseline: `pnpm memory:heap-snapshot -- --label baseline`
4. Use extension normally or follow repro steps
5. Capture after: `pnpm memory:heap-snapshot -- --label after-use`
6. Analyze in Chrome DevTools

### Viewing Logs

**Output Channel:**
1. View → Output (`Cmd/Ctrl + Shift + U`)
2. Select "Kilo-Code" from dropdown
3. Look for `[MemoryDiagnostics]` and `[MemorySnapshot]` lines

**Example Output:**
```
[MemoryDiagnostics 2025-01-29T10:00:00.000Z] Extension activation started {"heapUsed":"52MB","heapTotal":"80MB","external":"15MB","rss":"120MB"}
[MemorySnapshot 2025-01-29T10:00:30.000Z] Periodic snapshot (uptime: 0m) {"heapUsed":"78MB","heapTotal":"110MB","external":"18MB","rss":"150MB"}
[MemoryDiagnostics 2025-01-29T10:00:05.000Z] Created ClineProvider {"viewType":"sidebar"}
[MemorySnapshot 2025-01-29T10:01:00.000Z] Periodic snapshot (uptime: 1m) {"heapUsed":"102MB","heapTotal":"140MB","external":"22MB","rss":"180MB"}
```

### Analyzing Snapshots

1. Open Chrome/Edge browser
2. Navigate to `chrome://inspect`
3. Click "Open dedicated DevTools for Node"
4. Memory tab → Load button
5. Select snapshot file
6. Use "Comparison" view for before/after analysis

---

## Testing Procedures

### Verify Instrumentation

1. Enable `kilo-code.enableMemoryDiagnostics`
2. Reload VS Code window
3. Open "Kilo-Code" output channel
4. Should see activation logs immediately
5. Should see periodic snapshots every 30s
6. Create a task - should see additional logs

### Verify Heap Snapshot Capture

1. Launch with "Profile Extension (Memory + CPU)"
2. Run: `pnpm memory:heap-snapshot -- --label test`
3. Check `profiling/` directory for new `.heapsnapshot` file
4. File should be 50-200 MB
5. Load in Chrome DevTools to verify integrity

### Verify Disposal Cleanup

1. Enable diagnostics
2. Launch extension
3. Wait for activation logs
4. Reload VS Code window (triggers deactivation)
5. Should see "Extension deactivation started" log
6. Should see "Memory monitoring stopped" log
7. Should see "Extension deactivation completed" log

---

## Performance Impact

### When Disabled (Default)

- **Zero overhead** - All `MemoryDiagnostics` calls return immediately
- No performance impact on production use
- No logs generated

### When Enabled

- **Minimal overhead** - Memory snapshots every 30s
- ~1-2ms per snapshot (negligible)
- Logs to output channel (async, non-blocking)
- Recommended only for debugging/profiling sessions

---

## Troubleshooting

### No logs appearing

**Check:**
- Setting is enabled: `"kilo-code.enableMemoryDiagnostics": true`
- VS Code window reloaded after changing setting
- Looking at correct output channel: "Kilo-Code"

### Heap snapshot fails to capture

**Check:**
- Extension launched with `--inspect-extensions=9229`
- No other process using port 9229
- Use the "Profile Extension (Memory + CPU)" launch config

### Snapshot file corrupted

**Check:**
- Wait for capture to complete (watch console)
- Ensure enough disk space (200+ MB free)
- Chrome/Edge version is recent

---

## Known Limitations

1. **Periodic monitoring interval** - Currently hardcoded, requires code change to adjust
2. **Inspector port** - Fixed at 9229, may conflict with other debuggers
3. **Snapshot size** - Large snapshots (>500 MB) may be slow to capture and load
4. **Browser requirement** - Chrome DevTools needed for snapshot analysis

---

## Future Enhancements

### Potential Improvements

1. **Configurable monitoring interval**
   - Add setting: `kilo-code.memoryDiagnosticsInterval`
   - Range: 10-300 seconds

2. **Automatic snapshot capture**
   - Capture on memory threshold (e.g., >800 MB)
   - Capture before OOM crash
   - Capture on extension activation/deactivation

3. **Memory warnings in UI**
   - Show notification when heap > 500 MB
   - Prompt user to save snapshot
   - Suggest cleanup actions

4. **Historical tracking**
   - Store memory metrics over time
   - Graph memory trends
   - Detect gradual leaks

5. **Integration with telemetry**
   - Report high memory usage to analytics
   - Correlate with user actions
   - Aggregate across users

---

## Related Documentation

- [extension-memory.md](./extension-memory.md) - Full profiling report
- [HEAP_PROFILING_QUICKSTART.md](./HEAP_PROFILING_QUICKSTART.md) - Quick start guide
- [INDEX.md](./INDEX.md) - All profiling documentation
- [MEMORY_LEAK_FIXES_README.md](../../MEMORY_LEAK_FIXES_README.md) - Previous memory work

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-01-29 | System | Initial instrumentation implementation |

---

**Status:** ✅ Complete and Ready for Use  
**Next Step:** Conduct profiling sessions and populate findings in extension-memory.md
