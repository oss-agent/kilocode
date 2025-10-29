# Profiling Documentation

This directory contains documentation and resources for profiling and debugging memory issues in the Kilo Code extension.

## Documents

### 📊 [webview-memory.md](./webview-memory.md)
**Comprehensive Webview Memory Audit Report**

A detailed technical audit of the React-based webview, covering:
- Event listener cleanup patterns
- React Query cache configuration
- Large data structure retention
- Message passing bridge analysis
- Specific remediation recommendations
- Test scenarios for reproduction

**Audience:** Developers, QA engineers  
**Status:** Initial audit completed 2025-01-06

### 🔧 [webview-debugging-guide.md](./webview-debugging-guide.md)
**Practical Debugging Guide**

Step-by-step instructions for debugging memory issues:
- How to take heap snapshots
- How to interpret DevTools output
- Common leak patterns and solutions
- Specific test scenarios
- Troubleshooting tips

**Audience:** All developers, QA testers  
**Status:** Living document - update with new findings

## Heap Snapshots

Store heap snapshots here for:
- Reproducible memory leaks
- Before/after comparisons
- Bug investigations

**Naming Convention:**
```
webview-<scenario>-<date>.heapsnapshot
```

**Examples:**
- `webview-baseline-2025-01-06.heapsnapshot`
- `webview-after-100-messages-2025-01-06.heapsnapshot`
- `webview-grey-screen-bug-123.heapsnapshot`

**⚠️ Important:** Heap snapshots are large (50-200MB). Don't commit to Git unless necessary for bug documentation. Instead:
1. Save to external storage (Google Drive, S3, etc.)
2. Link to them in issues or documentation
3. Keep local copies for active investigations

## Performance Recordings

Store Performance tab recordings here:

**Naming Convention:**
```
webview-<scenario>-<date>.json
```

These are usually smaller than heap snapshots and can be committed if they demonstrate specific issues.

## How to Use This Directory

### For Developers

**Adding a New Feature:**
1. Take baseline snapshot before starting
2. Implement feature
3. Take snapshot after feature complete
4. Compare snapshots - memory should not increase significantly
5. Document any expected memory changes

**Fixing a Memory Leak:**
1. Review `webview-memory.md` for known issues
2. Follow `webview-debugging-guide.md` to reproduce
3. Take "before fix" snapshot
4. Implement fix
5. Take "after fix" snapshot
6. Verify leak is resolved
7. Update documentation

### For QA

**Testing for Memory Leaks:**
1. Follow test scenarios in `webview-debugging-guide.md`
2. Take snapshots at key points
3. Compare results against baselines
4. Report any unexpected growth
5. Save snapshots for developer review

### For Troubleshooting Grey Screen Issues

The "grey screen" bug may be related to memory exhaustion:

1. Reproduce grey screen
2. Check MemoryService telemetry leading up to issue
3. Take heap snapshot if possible (before crash)
4. Check for:
   - Very high heap usage (>1GB)
   - Large arrays (messages, images)
   - Many detached DOM trees
5. Compare with baseline to identify growth

## Memory Leak Checklist

Use this checklist when reviewing code changes:

- [ ] All `addEventListener` have corresponding `removeEventListener`
- [ ] All `setInterval`/`setTimeout` are cleared
- [ ] All `useEffect` hooks with side effects have cleanup returns
- [ ] Large data structures have size limits or pagination
- [ ] React Query cache configured with time limits
- [ ] Images are released after use
- [ ] Component state is cleared on unmount
- [ ] No global variables growing unbounded

## Related Documentation

### Extension-Side Memory
- `/MEMORY_LEAK_FIXES_README.md` - Extension host memory fixes
- `/docs/MEMORY_LEAK_FIXES.md` - Detailed technical docs
- `/docs/MEMORY_LEAK_SUMMARY.md` - Quick summary

### Webview-Side Memory
- `./webview-memory.md` - This directory
- `./webview-debugging-guide.md` - This directory

## Tools

### Required
- Chrome/VS Code DevTools
- Node.js with memory profiling enabled

### Optional
- React DevTools extension
- Chrome Memory Profiler
- Node.js `--inspect` flag for server-side debugging

## Baseline Metrics

**Clean Installation (No Messages):**
- Heap Used: ~15-30 MB
- Heap Total: ~30-50 MB
- Component Count: ~200-300 React components

**After Typical Usage (50 messages, no images):**
- Heap Used: ~30-50 MB
- Heap Total: ~50-100 MB
- Message Count: 50
- File Paths: Varies by workspace

**High Usage (500 messages, 10 images):**
- Heap Used: ~100-200 MB
- Heap Total: ~200-300 MB
- Message Count: 500
- Image Memory: ~50 MB

**⚠️ Warning Thresholds:**
- Heap Used > 500 MB - Investigate
- Heap Used > 1 GB - Critical issue
- Message Count > 1000 - Should be paginated
- Image Memory > 100 MB - Too many images

## Monitoring in Production

### MemoryService Telemetry

The extension reports memory every 10 minutes (1% sample rate):

**Event:** `WEBVIEW_MEMORY_USAGE`

**Properties:**
- `heapUsedMb` - Current heap usage in MB
- `heapTotalMb` - Total allocated heap in MB

**Query in analytics:**
```sql
SELECT AVG(heapUsedMb), MAX(heapUsedMb), COUNT(*)
FROM telemetry_events
WHERE event_name = 'WEBVIEW_MEMORY_USAGE'
  AND timestamp > NOW() - INTERVAL '7 days'
```

### Setting Up Alerts

Configure alerts for:
- Average heap usage > 300 MB
- Max heap usage > 700 MB
- Heap growth rate > 10 MB/hour

## Contributing

When adding documentation to this directory:

1. **Update this README** with new documents
2. **Use consistent formatting** - follow existing style
3. **Include examples** - code snippets, screenshots
4. **Date your changes** - track when information was added
5. **Link related docs** - connect to other relevant files

## Questions?

- Check existing documentation first
- Search closed issues for similar problems
- Ask in team chat
- Create issue if it's a new problem

---

**Directory Created:** 2025-01-06  
**Last Updated:** 2025-01-06  
**Maintained By:** Platform Team
