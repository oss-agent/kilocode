# Extension Host Memory Profiling Report

## Overview

This document captures memory profiling data and analysis for the VS Code extension host to investigate and localize the source of grey screen/OOM (Out of Memory) issues.

**Status:** Active Investigation  
**Created:** 2025-01-29  
**Last Updated:** 2025-01-29

---

## Table of Contents

1. [Reproduction Steps](#reproduction-steps)
2. [Instrumentation](#instrumentation)
3. [Profiling Setup](#profiling-setup)
4. [Collected Profiles](#collected-profiles)
5. [Analysis & Findings](#analysis--findings)
6. [Candidate Subsystems](#candidate-subsystems)
7. [Recommendations](#recommendations)

---

## Reproduction Steps

### Grey Screen / OOM Scenario

The grey screen issue typically manifests after extended use of the extension with certain patterns:

#### Step-by-Step Reproduction

1. **Initial Setup**
   - Install the Kilo Code extension in VS Code
   - Open a medium to large workspace (500+ files)
   - Enable memory diagnostics: `"kilo-code.enableMemoryDiagnostics": true`

2. **Activate Extension**
   - Open Command Palette: `Cmd/Ctrl + Shift + P`
   - Run: `Kilo-Code: Focus on Sidebar View`
   - Verify extension activates and sidebar opens

3. **Trigger CloudService Sessions**
   - Configure API provider (e.g., Anthropic, OpenAI)
   - Create a new task with significant context:
     - Request code generation across multiple files
     - Include file tree context
     - Enable code index for semantic search
   - Execute 3-5 tasks in sequence

4. **Open and Use Webview Heavily**
   - Send 50+ chat messages
   - Include file attachments (5-10 files)
   - Request code diffs and edits
   - Switch between multiple tasks
   - Use search functionality repeatedly

5. **Monitor for Warning Signs**
   - Extension becomes sluggish
   - VS Code shows "Extension Host Unresponsive" warning
   - Console shows: "Pause before potential out-of-memory crash"
   - Grey screen appears (webview fails to render)
   - VS Code may prompt to reload window

#### Expected Memory Growth Pattern

- **Baseline (activation):** 50-100 MB heap
- **After first task:** 150-250 MB heap
- **After 3-5 tasks:** 400-700 MB heap
- **Critical threshold:** >1 GB heap (OOM warning likely)

#### Factors That Accelerate Issue

- Large workspace with many files
- Code indexing enabled for large codebases
- Multiple MCP server connections
- Long-running tasks with extensive tool use
- Large file attachments in chat
- Frequent context switches between tasks

---

## Instrumentation

### Memory Diagnostics System

The extension includes built-in memory instrumentation that can be enabled for debugging.

#### Enabling Instrumentation

Add to VS Code settings (`.vscode/settings.json` or User Settings):

```json
{
  "kilo-code.enableMemoryDiagnostics": true
}
```

#### What Gets Logged

When enabled, the extension automatically logs:

1. **Periodic Memory Snapshots** (every 30 seconds)
   - Heap used (MB)
   - Heap total (MB)
   - External memory (MB)
   - Resident Set Size (MB)
   - Uptime since activation

2. **Lifecycle Events**
   - Extension activation started
   - ClineProvider creation
   - CloudService initialization
   - Webview provider registration
   - Extension activation completed
   - Extension deactivation started/completed

3. **Resource Creation/Disposal**
   - Major component instantiation
   - Resource cleanup operations

#### Output Location

All diagnostics output to:
- **Console:** Debug Console in VS Code
- **Output Channel:** "Kilo-Code" output panel
  - View → Output → Select "Kilo-Code" from dropdown

#### Sample Output

```
[MemoryDiagnostics 2025-01-29T10:00:00.000Z] Extension activation started {"heapUsed":"52MB","heapTotal":"80MB","external":"15MB","rss":"120MB"}
[MemorySnapshot 2025-01-29T10:00:30.000Z] Periodic snapshot (uptime: 0m) {"heapUsed":"78MB","heapTotal":"110MB","external":"18MB","rss":"150MB"}
[MemoryDiagnostics 2025-01-29T10:00:05.000Z] Created ClineProvider {"viewType":"sidebar"}
[MemorySnapshot 2025-01-29T10:01:00.000Z] Periodic snapshot (uptime: 1m) {"heapUsed":"102MB","heapTotal":"140MB","external":"22MB","rss":"180MB"}
```

#### Disabling Instrumentation

To disable logging (no performance impact when disabled):

```json
{
  "kilo-code.enableMemoryDiagnostics": false
}
```

Or remove the setting entirely (defaults to `false`).

---

## Profiling Setup

### Using VS Code's Built-in Profiler

#### 1. Launch Extension Host with Inspector

**Option A: Using Launch Configuration**

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Extension + Inspector",
      "type": "extensionHost",
      "request": "launch",
      "runtimeArgs": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--inspect-extensions=9229"
      ],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

**Option B: Command Line**

```bash
code --extensionDevelopmentPath=/path/to/extension --inspect-extensions=9229
```

#### 2. Connect Chrome DevTools

1. Open Chrome/Edge browser
2. Navigate to: `chrome://inspect` or `edge://inspect`
3. Click "Configure" and add `localhost:9229`
4. Wait for extension host to appear in "Remote Target" list
5. Click "inspect" to open DevTools

#### 3. Capture Heap Snapshot

**In Chrome DevTools:**
1. Go to **Memory** tab
2. Select **Heap snapshot**
3. Click **Take snapshot**
4. Save with naming: `extension-heap-YYYY-MM-DD-HH-MM.heapsnapshot`
5. Store in `/profiling/` directory

**Timing:**
- **Baseline:** Immediately after activation
- **During load:** After completing reproduction steps
- **Before crash:** When memory grows above 800 MB

#### 4. Capture CPU Profile

**In Chrome DevTools:**
1. Go to **Profiler** tab
2. Click **Start**
3. Perform reproduction steps (2-5 minutes)
4. Click **Stop**
5. Save with naming: `extension-heap-YYYY-MM-DD-HH-MM.cpuprofile`
6. Store in `/profiling/` directory

#### 5. Using Node.js Inspector API

For automated profiling:

```typescript
import * as inspector from 'inspector'
import * as fs from 'fs'

// Start profiling
const session = new inspector.Session()
session.connect()

// Heap snapshot
session.post('HeapProfiler.takeHeapSnapshot', null, (err, data) => {
  // Stream to file
})

// CPU profile
session.post('Profiler.enable')
session.post('Profiler.start')
// ... perform operations ...
session.post('Profiler.stop', (err, { profile }) => {
  fs.writeFileSync('profile.cpuprofile', JSON.stringify(profile))
})
```

---

## Collected Profiles

### Profile Inventory

Store all captured profiles in the `/profiling/` directory at the repository root.

| Timestamp | Type | Size | Scenario | Heap Used | Notes |
|-----------|------|------|----------|-----------|-------|
| _TBD_ | Heap Snapshot | - | Baseline after activation | - | Clean state |
| _TBD_ | Heap Snapshot | - | After 3 tasks | - | Moderate use |
| _TBD_ | Heap Snapshot | - | Before OOM | - | Critical state |
| _TBD_ | CPU Profile | - | Task execution | - | 5-min sample |

### Naming Convention

Use consistent naming for easy identification:

- **Heap Snapshots:** `extension-heap-YYYY-MM-DD-HH-MM.heapsnapshot`
- **CPU Profiles:** `extension-heap-YYYY-MM-DD-HH-MM.cpuprofile`
- **Performance Traces:** `extension-trace-YYYY-MM-DD-HH-MM.json`

### Profile Analysis Workflow

1. **Take Baseline** - Clean state after activation
2. **Take Mid-Point** - After moderate use (3-5 tasks)
3. **Take Critical** - Right before OOM warning
4. **Compare in DevTools:**
   - Load baseline snapshot
   - Load critical snapshot
   - Use "Comparison" view to see retained objects
   - Focus on objects that grew significantly

---

## Analysis & Findings

### Memory Growth Patterns

_This section will be populated with findings from collected profiles._

#### Heap Allocation Breakdown

**Expected Breakdown (Baseline):**
- Code and metadata: ~30-40%
- Task contexts: ~10-20%
- File content caches: ~15-25%
- Message history: ~5-10%
- Other: ~20-30%

**Observed Breakdown (Critical State):**
- _To be documented after profiling_

#### Suspected Memory Hotspots

**Potential Problem Areas (Pre-Investigation):**

1. **Task Context Accumulation**
   - Each task retains large context (files, history, state)
   - Old tasks may not be garbage collected
   - Context may include duplicate file content

2. **Code Index Manager**
   - Indexes entire workspace in memory
   - May retain old indexes after workspace changes
   - Dependency analysis graphs can be large

3. **Message History**
   - Chat messages retained indefinitely
   - Image data embedded in messages
   - Large code blocks in messages

4. **Webview Bridge**
   - Serialized state held on both sides
   - Message queue may accumulate
   - Listeners not cleaned up

5. **MCP Server Connections**
   - Each server connection has overhead
   - Tool result caching
   - State synchronization

#### Allocation Hotspots

_To be identified from CPU profile:_
- Functions that allocate most frequently
- Call stacks leading to large allocations
- Allocation patterns over time

---

## Candidate Subsystems

### High Priority Suspects

Based on architecture and previous memory fixes, these subsystems warrant investigation:

#### 1. ClineProvider & Task Management

**Location:** `src/core/webview/ClineProvider.ts`

**Concerns:**
- Multiple task instances retained
- Task abort/cleanup may be incomplete
- Large context objects in task state
- Event listeners per task

**Profiling Focus:**
- Count of active task instances
- Memory per task instance
- Retained size of task contexts
- Event listener accumulation

**Investigation Steps:**
- [ ] Take snapshot before creating task
- [ ] Take snapshot after task completion
- [ ] Take snapshot after task deletion
- [ ] Compare: verify task is fully released
- [ ] Check for detached task objects

#### 2. CodeIndexManager

**Location:** `src/services/code-index/manager.ts`

**Concerns:**
- Indexes full workspace file tree
- Dependency graphs can be large
- Cache managers may retain old data
- File watchers accumulate

**Profiling Focus:**
- Size of index data structures
- Cache retention policies
- Memory after workspace changes
- Number of active file watchers

**Investigation Steps:**
- [ ] Profile with code index disabled (baseline)
- [ ] Profile with code index enabled
- [ ] Compare memory difference
- [ ] Check index growth over time
- [ ] Verify disposal clears index

#### 3. Webview Message Bridge

**Location:** `src/core/webview/ClineProvider.ts`, webview-ui components

**Concerns:**
- Message queue accumulation
- Serialized state retained on both sides
- Image/file data in messages
- Event listener leaks

**Profiling Focus:**
- Message queue size
- Serialized data retention
- Image data retention
- Listener count over time

**Investigation Steps:**
- [ ] Profile webview separately (see webview-memory.md)
- [ ] Monitor message queue length
- [ ] Check for message duplicates
- [ ] Verify cleanup on view hide/show

#### 4. CloudService & Bridge

**Location:** `@roo-code/cloud` package

**Concerns:**
- WebSocket connections
- Sync state retention
- Event handlers accumulation
- Response caching

**Profiling Focus:**
- Connection count
- Cached response data
- Event handler count
- Sync state size

**Investigation Steps:**
- [ ] Profile with cloud features disabled
- [ ] Profile with cloud features enabled
- [ ] Monitor connection lifecycle
- [ ] Verify cleanup on disconnect

#### 5. Terminal & Process Management

**Location:** `src/integrations/terminal/`

**Concerns:**
- Terminal instances retained
- Process output buffering
- Command history retention

**Profiling Focus:**
- Number of terminal instances
- Buffer sizes
- Retained command output

**Investigation Steps:**
- [ ] Check terminal instance disposal
- [ ] Monitor buffer growth
- [ ] Verify cleanup after task completion

---

## Recommendations

### Immediate Actions

1. **Enable Diagnostics in Test Environments**
   - Set `"kilo-code.enableMemoryDiagnostics": true`
   - Monitor memory patterns during testing
   - Share output logs when reporting issues

2. **Capture Baseline Profiles**
   - Take heap snapshot immediately after activation
   - Take CPU profile during typical usage
   - Store in `/profiling/` with clear labels

3. **Document Reproduction Path**
   - Record exact steps that trigger OOM
   - Note workspace size and configuration
   - Track which features were active

### Investigation Priorities

**Priority 1: Task Context Management**
- Verify tasks are fully disposed after completion
- Check for circular references in task objects
- Implement context size limits

**Priority 2: Code Index Optimization**
- Review index data structure sizes
- Implement incremental indexing
- Add cache eviction policies

**Priority 3: Message History Management**
- Implement message pagination/windowing
- Move old messages to persistent storage
- Limit image data retention

### Long-term Mitigations

1. **Memory Budgets**
   - Set memory limits per subsystem
   - Implement eviction policies
   - Add telemetry for budget violations

2. **Aggressive Garbage Collection**
   - Manual GC triggers after large operations
   - Explicit cleanup in lifecycle hooks
   - WeakMap/WeakSet for loose references

3. **Monitoring & Alerts**
   - Production telemetry for memory trends
   - User-facing warnings at 80% threshold
   - Automatic snapshot capture before crash

4. **Architecture Improvements**
   - Move heavy processing to worker threads
   - Stream large data instead of buffering
   - Use external storage for large contexts

---

## Profiling Checklist

Use this checklist when conducting profiling sessions:

- [ ] Memory diagnostics enabled in settings
- [ ] Extension launched with `--inspect-extensions`
- [ ] Chrome DevTools connected to extension host
- [ ] Baseline heap snapshot captured
- [ ] Reproduction steps documented
- [ ] Reproduction steps executed
- [ ] Mid-point heap snapshot captured
- [ ] CPU profile captured during execution
- [ ] Critical state heap snapshot captured (if possible)
- [ ] Profiles saved to `/profiling/` with timestamps
- [ ] Memory output logs saved
- [ ] Findings documented in this report
- [ ] Comparison analysis completed
- [ ] Hotspots identified
- [ ] Candidate fixes proposed

---

## References

### Related Documentation

- [Profiling Index](./INDEX.md) - All profiling documentation
- [Memory Leak Fixes](../../MEMORY_LEAK_FIXES_README.md) - Previous memory work
- [Webview Memory Report](./webview-memory.md) - Webview-specific profiling
- [Debugging Guide](./webview-debugging-guide.md) - General debugging techniques

### External Resources

- [VS Code Extension Host Profiling](https://code.visualstudio.com/api/advanced-topics/extension-host#profiling-extensions)
- [Chrome DevTools Memory Profiling](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Node.js Inspector API](https://nodejs.org/api/inspector.html)
- [V8 Heap Snapshot Format](https://github.com/v8/v8/wiki/Heap-Snapshot-Format)

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-01-29 | System | Initial report created with reproduction steps and instrumentation |

---

**Status:** 🔄 Active Investigation  
**Next Review:** After first profiling session
