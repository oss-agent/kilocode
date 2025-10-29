# Heap Profiling Quick Start Guide

## Quick Reference for Extension Host Memory Profiling

This guide helps you quickly set up and capture heap profiles for the extension host to investigate memory issues.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Enable Memory Diagnostics

Add to your VS Code settings:

```json
{
  "kilo-code.enableMemoryDiagnostics": true
}
```

**Where:** `.vscode/settings.json` or User Settings (`Cmd/Ctrl + ,`)

### Step 2: Launch Extension with Profiler

Use the built-in launch configuration:

1. Open VS Code Run panel (`Cmd/Ctrl + Shift + D`)
2. Select **"Profile Extension (Memory + CPU)"** from dropdown
3. Press `F5` or click green play button

This automatically launches with `--inspect-extensions=9229`.

### Step 3: Capture Baseline Snapshot

Once extension is running, in a new terminal:

```bash
pnpm memory:heap-snapshot -- --label baseline
```

**Output:** `profiling/extension-heap-baseline-YYYY-MM-DD-HH-MM.heapsnapshot`

### Step 4: Reproduce Issue

Follow the reproduction steps from [extension-memory.md](./extension-memory.md#reproduction-steps).

Example scenario:
- Create 3-5 tasks with significant file context
- Send 50+ messages
- Use code indexing heavily

### Step 5: Capture "After" Snapshot

```bash
pnpm memory:heap-snapshot -- --label after-tasks
```

### Step 6: Analyze in Chrome DevTools

1. Open **Chrome or Edge** browser
2. Navigate to: `chrome://inspect` or `edge://inspect`
3. Click **"Open dedicated DevTools for Node"**
4. Go to **Memory** tab
5. Click **"Load"** button
6. Load baseline snapshot
7. Click **"Load"** again and load after-tasks snapshot
8. Use **"Comparison"** view to see what grew

---

## 📊 Interpreting Results

### What to Look For

**In Comparison View:**
- Objects with large **Retained Size** increase
- High **Delta** (change between snapshots)
- Multiple instances of same constructor (e.g., `Task`, `Context`)

**Common Memory Hotspots:**
- `Array` - message history, file lists, contexts
- `Object` - task state, cached data
- `String` - file content, code blocks
- `Buffer` - binary data, images

### Red Flags

🚨 **Critical:**
- Total heap > 1 GB
- Growth rate > 10 MB/min
- Detached DOM trees (indicates leaks)
- Many duplicate objects

⚠️ **Warning:**
- Total heap > 500 MB
- Growth rate > 5 MB/min
- Large arrays (>1000 elements)
- Many event listeners

✅ **Healthy:**
- Total heap < 300 MB
- Growth rate < 2 MB/min
- Stable after GC
- Few detached objects

---

## 🛠️ Advanced Usage

### Capture at Specific Times

```bash
# Before CloudService initialization
pnpm memory:heap-snapshot -- --label before-cloud

# After 10 minutes of use
# (just wait, then run)
pnpm memory:heap-snapshot -- --label 10min-uptime

# Right before OOM
# (when memory warning appears)
pnpm memory:heap-snapshot -- --label pre-oom
```

### View Memory Diagnostics Output

Memory diagnostics log to the "Kilo-Code" output channel:

1. **View** → **Output** (`Cmd/Ctrl + Shift + U`)
2. Select **"Kilo-Code"** from dropdown
3. Look for `[MemoryDiagnostics]` and `[MemorySnapshot]` entries

Example output:
```
[MemorySnapshot 2025-01-29T10:00:00.000Z] Extension activation started {"heapUsed":"52MB","heapTotal":"80MB","external":"15MB","rss":"120MB"}
[MemorySnapshot 2025-01-29T10:00:30.000Z] Periodic snapshot (uptime: 0m) {"heapUsed":"78MB","heapTotal":"110MB","external":"18MB","rss":"150MB"}
```

### Compare Multiple Snapshots

Chrome DevTools allows comparing more than 2 snapshots:

1. Load baseline snapshot
2. Load snapshot at 5 minutes
3. Load snapshot at 10 minutes
4. Select any two from dropdown to compare
5. Track growth over time

---

## 🎯 Profiling Workflows

### Workflow 1: Feature Development

**Goal:** Ensure new feature doesn't leak memory

1. Take baseline before implementing feature
2. Implement feature
3. Use feature extensively (50+ operations)
4. Take snapshot after use
5. Compare - **should be < 50 MB growth**

### Workflow 2: Bug Investigation

**Goal:** Identify source of memory leak

1. Take baseline after activation
2. Reproduce bug steps exactly
3. Take snapshot after bug manifests
4. Compare and identify growing objects
5. Search codebase for constructors of growing objects
6. Review disposal/cleanup code

### Workflow 3: Regression Testing

**Goal:** Verify fix doesn't regress

1. Take baseline on branch with fix
2. Run stress test (see below)
3. Take snapshot after stress test
4. Compare to historical snapshots
5. **Growth should be < previous version**

---

## 🔥 Stress Testing

Run automated stress tests to accelerate memory growth:

```bash
# Stress test all scenarios
pnpm memory:stress:all

# While stress test runs, capture snapshots:
pnpm memory:heap-snapshot -- --label stress-start
# ... wait 2 minutes ...
pnpm memory:heap-snapshot -- --label stress-mid
# ... wait 2 more minutes ...
pnpm memory:heap-snapshot -- --label stress-end
```

---

## 📝 Recording Findings

Document your findings in [extension-memory.md](./extension-memory.md):

### Update the Profile Inventory Table

```markdown
| Timestamp | Type | Size | Scenario | Heap Used | Notes |
|-----------|------|------|----------|-----------|-------|
| 2025-01-29-10-00 | Heap Snapshot | 45 MB | Baseline | 52 MB | Clean state |
| 2025-01-29-10-10 | Heap Snapshot | 180 MB | After 5 tasks | 210 MB | High growth |
```

### Add to Analysis Section

```markdown
#### Observed Hotspot: Task Context Retention

**Evidence:**
- Snapshot comparison shows 500+ Task objects retained
- Each task holds ~5 MB of context
- Total: ~2.5 GB leaked

**Root Cause:**
- Tasks not disposed after completion
- Event listeners prevent GC
- Circular reference: Task → Context → Task

**Fix:**
- Add explicit disposal in task completion handler
- Unregister event listeners
- Break circular references with WeakMap
```

---

## 🐛 Troubleshooting

### "Failed to connect to inspector"

**Solution:**
- Ensure extension is running with `--inspect-extensions=9229`
- Use the "Profile Extension (Memory + CPU)" launch config
- Check no other process is using port 9229

### Snapshot file is empty or corrupted

**Solution:**
- Wait for snapshot to fully write (watch for "✅ Heap snapshot captured")
- Ensure enough disk space (snapshots can be 200+ MB)
- Try reducing memory usage before snapshot

### Chrome DevTools won't load snapshot

**Solution:**
- Use latest Chrome/Edge version
- Snapshot file must have `.heapsnapshot` extension
- Try opening in regular Chrome DevTools (F12) → Memory → Load

### Memory diagnostics not logging

**Solution:**
- Verify setting: `"kilo-code.enableMemoryDiagnostics": true`
- Reload VS Code window after changing setting
- Check "Kilo-Code" output channel (not Debug Console)

---

## 📚 Related Documentation

- **[extension-memory.md](./extension-memory.md)** - Full profiling report and findings
- **[INDEX.md](./INDEX.md)** - All profiling documentation
- **[webview-memory.md](./webview-memory.md)** - Webview-specific profiling
- **[MEMORY_LEAK_FIXES_README.md](../../MEMORY_LEAK_FIXES_README.md)** - Previous memory fixes

---

## 🎓 Learning Resources

### Chrome DevTools Memory Profiling
- [Official Guide](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Memory Terminology](https://developer.chrome.com/docs/devtools/memory-problems/memory-101/)
- [Finding Memory Leaks](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots/)

### VS Code Extension Profiling
- [Official Docs](https://code.visualstudio.com/api/advanced-topics/extension-host#profiling-extensions)
- [Performance Best Practices](https://code.visualstudio.com/api/advanced-topics/extension-host#performance-best-practices)

### Node.js Memory Management
- [Inspector API](https://nodejs.org/api/inspector.html)
- [Memory Usage](https://nodejs.org/api/process.html#processmemoryusage)
- [Garbage Collection](https://nodejs.org/en/docs/guides/diagnostics/memory/)

---

**Created:** 2025-01-29  
**Last Updated:** 2025-01-29  
**Maintained By:** Platform Team
