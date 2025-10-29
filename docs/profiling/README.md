# Memory Profiling Guide

This directory contains documentation and tools for monitoring memory stability in Kilo Code.

## Documents

- **[results.md](./results.md)** - Detailed analysis of memory fixes, before/after metrics, and verification results

## Memory Profiling Tools

### 1. Memory Profile Script

A command-line utility for capturing memory snapshots over time.

**Usage:**

```bash
# Basic 5-minute profile
pnpm memory:profile

# Extended 1-hour profile with less frequent samples
pnpm memory:profile:extended

# Quick 30-second snapshot
pnpm memory:snapshot
```

**Custom Options:**

```bash
# Custom duration and interval
pnpm tsx scripts/memory-profile.ts --duration 600 --interval 30

# Set custom threshold (in MB)
pnpm tsx scripts/memory-profile.ts --threshold 400

# Save results to file
pnpm tsx scripts/memory-profile.ts --output profiling-results.json

# Run with garbage collection exposed (recommended)
node --expose-gc node_modules/.bin/tsx scripts/memory-profile.ts
```

**Output:**

The script provides:
- Real-time memory snapshots during execution
- Summary statistics (initial, final, peak, average heap usage)
- Memory growth rate (MB/min)
- Warnings if thresholds are exceeded
- Optional JSON export for detailed analysis

### 2. VSCode E2E Memory Tests

Automated tests that run within the VSCode extension host to verify memory stability.

**Location:** `apps/vscode-e2e/src/suite/memory.test.ts`

**Run Tests:**

```bash
cd apps/vscode-e2e
pnpm test
```

**Test Coverage:**
- Extension host memory limits
- Task memory cleanup
- Extended session stability
- Multiple file operations
- Resource disposal verification

### 3. Playwright Memory Tests

End-to-end tests that monitor webview memory usage through browser automation.

**Location:** `apps/playwright-e2e/tests/memory.test.ts`

**Run Tests:**

```bash
cd apps/playwright-e2e
pnpm playwright test memory.test.ts
```

**Test Coverage:**
- Grey screen detection
- Memory warning banner verification
- Webview memory bounds
- Extended chat session stability
- OOM error detection
- Memory snapshot comparisons

## Interpreting Results

### Healthy Memory Profile

A healthy memory profile should show:
- **Initial heap:** 50-100 MB
- **Peak heap:** < 500 MB during normal usage
- **Growth rate:** < 2 MB/min sustained
- **No warnings:** Grey screen or OOM warnings should never appear

### Warning Signs

Watch for these indicators of memory issues:
- **Linear growth:** Memory continuously increasing without plateaus
- **High growth rate:** > 5 MB/min sustained growth
- **Threshold breaches:** Exceeding 500 MB during typical operations
- **No cleanup:** Memory not returning to baseline after operations complete
- **GC frequency:** Excessive garbage collection (more than every few minutes)

## Continuous Monitoring

### In Development

1. Run memory profile script periodically during development
2. Check memory tests pass before committing
3. Monitor DevTools memory tab during manual testing

### In Production

The extension includes built-in telemetry:
- **MemoryService** samples webview memory every 10 minutes (1% of users)
- **MemoryWarningBanner** alerts users if memory exceeds 90% threshold
- Events tracked: `WEBVIEW_MEMORY_USAGE`, `MEMORY_WARNING_SHOWN`

### In CI/CD

Memory tests run automatically:
- VSCode E2E suite includes memory stability tests
- Playwright suite includes memory regression tests
- Tests fail if memory exceeds defined thresholds

## Debugging Memory Issues

### Capture Heap Snapshot

For detailed analysis, capture a heap snapshot:

```javascript
// In VSCode extension context
const v8 = require('v8');
const fs = require('fs');
const snapshot = v8.writeHeapSnapshot();
fs.copyFileSync(snapshot, './heap-snapshot.heapsnapshot');
```

### Analyze with Chrome DevTools

1. Open Chrome DevTools
2. Go to Memory tab
3. Load heap snapshot (.heapsnapshot file)
4. Look for:
   - Large retained objects
   - Unexpected object counts
   - Detached DOM trees (in webview)
   - Event listener accumulation

### Enable GC Logging

Run extension with GC logging:

```bash
code --inspect-extensions=9229 --trace-gc
```

### Manual Verification Checklist

When investigating memory issues:

- [ ] Monitor memory in VSCode Task Manager (`Developer: Open Process Explorer`)
- [ ] Check browser DevTools memory profiler for webview
- [ ] Run extended chat session (100+ messages)
- [ ] Perform multiple task automations (10+ tasks)
- [ ] Verify memory returns to baseline after operations
- [ ] Check for grey screen appearance
- [ ] Monitor console for OOM warnings
- [ ] Test extension reload cycle (10+ reloads)

## Best Practices

### For Contributors

When working on code that might affect memory:

1. **Profile Before and After:** Run memory profile script before and after changes
2. **Test Disposal:** Ensure all resources have proper cleanup/disposal methods
3. **Check Event Listeners:** Always remove event listeners when no longer needed
4. **Release References:** Null out large objects when done with them
5. **Test Extended Usage:** Simulate long-running scenarios
6. **Review Memory Tests:** Run `pnpm test` and verify memory tests pass

### Code Review

Memory impact should be considered for:
- Task lifecycle and disposal
- Service manager initialization/cleanup  
- Event listener registration/removal
- Large data structure manipulation
- MCP tool operations
- Webview message passing
- File system operations

## Troubleshooting

### Memory Profile Script Issues

**Problem:** "global.gc is not a function"
**Solution:** Run with `node --expose-gc` or `NODE_OPTIONS=--expose-gc`

**Problem:** Script exits before completion
**Solution:** Check for uncaught exceptions, increase timeout

### Test Failures

**Problem:** Memory tests fail with threshold exceeded
**Solution:** 
1. Check if legitimate regression or overly strict threshold
2. Profile the specific operation to identify leak source
3. Review recent changes affecting memory management

**Problem:** "Grey screen" test false positives
**Solution:** Verify webview is fully loaded before checking, increase wait timeout

## Resources

- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Chrome DevTools Memory Profiler](https://developer.chrome.com/docs/devtools/memory-problems/)
- [VSCode Extension Memory Best Practices](https://code.visualstudio.com/api/advanced-topics/extension-host)
- [V8 Heap Profiling](https://v8.dev/docs/profile)

## Support

For memory-related issues or questions:
1. Check [results.md](./results.md) for known issues and resolutions
2. Run memory profile script to gather data
3. Review console logs and heap snapshots
4. File an issue with reproduction steps and profiling data

---

**Last Updated:** 2025-10-29
