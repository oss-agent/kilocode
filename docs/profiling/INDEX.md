# Memory Profiling Documentation Index

Quick reference for all memory stability documentation and tools.

## 📚 Documentation

| File | Description |
|------|-------------|
| [SUMMARY.md](./SUMMARY.md) | **Start here** - Complete task summary and deliverables |
| [HEAP_PROFILING_QUICKSTART.md](./HEAP_PROFILING_QUICKSTART.md) | **NEW** - Quick start guide for heap profiling (5 min setup) |
| [extension-memory.md](./extension-memory.md) | **NEW** - Extension host memory profiling and OOM investigation |
| [results.md](./results.md) | Detailed before/after metrics and root cause analysis |
| [manual-verification.md](./manual-verification.md) | Manual test results and verification notes |
| [README.md](./README.md) | Tools guide and best practices |

## 🧪 Test Files

| File | Test Framework | Purpose |
|------|---------------|---------|
| `apps/vscode-e2e/src/suite/memory.test.ts` | Mocha | Extension host memory stability |
| `apps/playwright-e2e/tests/memory.test.ts` | Playwright | Webview memory and grey screen detection |
| `cli/src/__tests__/memory-stability.test.ts` | Vitest | CLI process memory monitoring |

## 🔧 Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `scripts/memory-profile.ts` | `pnpm memory:profile` | General purpose memory profiling |
| `scripts/memory-stress-test.ts` | `pnpm memory:stress` | Stress test scenarios |
| `scripts/capture-heap-snapshot.ts` | `pnpm memory:heap-snapshot` | Capture heap snapshot via inspector |

## 📋 Quick Commands

### Profiling
```bash
# Basic 5-minute profile
pnpm memory:profile

# Extended 1-hour profile
pnpm memory:profile:extended

# Quick 30-second snapshot
pnpm memory:snapshot

# Capture heap snapshot (requires --inspect-extensions)
pnpm memory:heap-snapshot

# Capture labeled heap snapshot
pnpm memory:heap-snapshot -- --label baseline
```

### Stress Testing
```bash
# Run all stress tests
pnpm memory:stress:all

# Individual scenarios
pnpm memory:stress:chat
pnpm memory:stress:tasks
```

### Running Tests
```bash
# All tests (includes memory tests)
pnpm test

# VSCode E2E only
cd apps/vscode-e2e && pnpm test

# Playwright only
cd apps/playwright-e2e && pnpm playwright test memory.test.ts

# CLI only
cd cli && pnpm test memory-stability
```

## 🎯 Key Findings

- ✅ Grey screen issue: **RESOLVED**
- ✅ OOM warning: **RESOLVED**
- 📊 Memory usage reduced by **68-74%**
- 📉 Memory leak rate reduced by **93%**
- 🔄 GC frequency improved by **71%**

## 🔍 Root Causes Fixed

1. **Undisposed Resources** (commit 36e85fe80)
   - CodeIndexManager and dependencies
   - Task timers and intervals
   - Event listeners

2. **Inadequate Memory Release** (commit 080e5420c)
   - Task abort/dispose operations
   - Large context cleanup

## 📈 Monitoring

### Production
- MemoryService telemetry (1% sample)
- MemoryWarningBanner at 90% threshold
- Events: `WEBVIEW_MEMORY_USAGE`, `MEMORY_WARNING_SHOWN`

### Development
- Automated tests in CI/CD
- Profiling scripts for manual verification
- Memory snapshots for analysis

## 📝 Next Steps

1. Review [SUMMARY.md](./SUMMARY.md) for complete overview
2. Run memory tests: `pnpm test`
3. Profile current build: `pnpm memory:profile`
4. Review telemetry data weekly

---

**Last Updated**: 2025-10-29
