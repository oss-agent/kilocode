# Profiling Data Storage

This directory stores CPU profiles, heap snapshots, and other profiling artifacts captured during memory investigation and performance analysis.

**Quick Start:** See [HEAP_PROFILING_QUICKSTART.md](../docs/profiling/HEAP_PROFILING_QUICKSTART.md) for a 5-minute setup guide.

## Getting Started

### 1. Enable Memory Diagnostics

```json
{
  "kilo-code.enableMemoryDiagnostics": true
}
```

### 2. Launch with Profiler

Use the **"Profile Extension (Memory + CPU)"** launch configuration from VS Code Run panel.

### 3. Capture Snapshot

```bash
pnpm memory:heap-snapshot -- --label baseline
```

### 4. Analyze

Open in Chrome DevTools: `chrome://inspect` → Memory tab → Load snapshot

---

## Contents

Store profiling data with timestamps for tracking:

### Heap Snapshots
- `extension-heap-YYYY-MM-DD-HH-MM.heapsnapshot` - V8 heap snapshots from extension host

### CPU Profiles
- `extension-heap-YYYY-MM-DD-HH-MM.cpuprofile` - CPU profiles from extension host

### Performance Traces
- `extension-trace-YYYY-MM-DD-HH-MM.json` - Performance trace data

## Usage

### Capturing Profiles

See `docs/profiling/extension-memory.md` for detailed instructions on:
- How to launch extension host with --inspect flag
- How to capture heap snapshots
- How to capture CPU profiles
- How to analyze the results

### Git Considerations

⚠️ **Large Files**: Profiling files can be 50-500MB. 

**Best Practices:**
- ✅ Commit representative samples for bug documentation
- ✅ Link to external storage for large collections
- ✅ Use Git LFS if committing many large files
- ❌ Don't commit every profile from routine testing

## Analyzing Profiles

### Heap Snapshots (.heapsnapshot)
Open in Chrome DevTools Memory tab:
1. Open `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Go to Memory tab
4. Load snapshot file
5. Analyze retained objects and memory paths

### CPU Profiles (.cpuprofile)
Open in Chrome DevTools Performance tab:
1. Open `chrome://inspect`
2. Click "Open dedicated DevTools for Node"  
3. Go to Performance tab
4. Load profile file
5. Analyze hot functions and call trees

## Related Documentation

- [Extension Memory Report](../docs/profiling/extension-memory.md) - Memory profiling findings
- [Profiling Index](../docs/profiling/INDEX.md) - All profiling documentation
- [Memory Debugging Guide](../docs/profiling/webview-debugging-guide.md) - Debugging techniques

---

**Directory Created:** 2025-01-29
