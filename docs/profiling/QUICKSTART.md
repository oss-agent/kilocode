# Memory Profiling Quick Start

Get started with memory profiling and verification in under 5 minutes.

## For Developers

### Before Committing Changes

If your PR touches resource-heavy code, run these checks:

```bash
# 1. Run memory tests (should pass)
pnpm test

# 2. Quick memory profile (30 seconds)
pnpm memory:snapshot

# 3. Check for memory issues
# Look for: "⚠️ THRESHOLD EXCEEDED" or high growth rates
```

**Expected Results:**
- All tests pass ✅
- Memory growth < 50MB ✅
- Growth rate < 2 MB/min ✅

### Debugging Memory Issues

```bash
# 1. Run 5-minute profile
pnpm memory:profile

# 2. If issues found, run specific stress test
pnpm memory:stress:chat     # For chat/webview issues
pnpm memory:stress:tasks    # For task/automation issues

# 3. Check the output for warnings
```

**Warning Signs:**
- 🔴 Growth > 200MB
- 🔴 Growth rate > 5 MB/min
- 🔴 Final memory > 500MB

## For Reviewers

### Code Review Checklist

When reviewing PRs that affect:
- Task lifecycle
- Service managers
- Event listeners
- File operations
- MCP tools

**Ask:**
- [ ] Are resources disposed properly?
- [ ] Are event listeners removed?
- [ ] Are large objects nulled out when done?
- [ ] Do tests include memory verification?

### Running Verification

```bash
# Checkout the PR branch
git checkout pr-branch-name

# Run memory tests
pnpm test

# Run quick profile
pnpm memory:profile
```

## For QA/Manual Testing

### Quick Memory Check (5 min)

1. **Open VS Code with extension**
2. **Open DevTools**: `Help > Toggle Developer Tools`
3. **Go to Memory tab**
4. **Take initial snapshot**
5. **Use extension normally for 5 minutes**
   - Open chat
   - Send some messages
   - Run a task
6. **Take final snapshot**
7. **Compare heap sizes**

**Pass Criteria:**
- Heap growth < 100MB ✅
- No grey screen ✅
- No memory warnings ✅

### Extended Session Test (30 min)

1. **Start fresh VS Code instance**
2. **Open Process Explorer**: `Command Palette > Developer: Open Process Explorer`
3. **Note initial memory** for extension host
4. **Use extension continuously** for 30 minutes:
   - Long chat conversations
   - Multiple tasks
   - File operations
5. **Check final memory**

**Pass Criteria:**
- Memory < 500MB ✅
- No steady increase ✅
- Returns to baseline after operations ✅

## For CI/CD

Memory tests run automatically with:
```bash
pnpm test
```

To add memory profiling to CI:
```yaml
- name: Memory Profile
  run: pnpm memory:profile --threshold 400 --output profile.json
```

## Common Issues & Fixes

### Issue: "Memory exceeds threshold"

**Solution:**
1. Check recent changes for resource leaks
2. Verify disposal methods are called
3. Profile before/after your changes
4. Look for growing arrays or maps

### Issue: "High growth rate detected"

**Solution:**
1. Check for event listener accumulation
2. Verify timers are cleared
3. Look for closures holding references
4. Ensure GC can run (no circular refs)

### Issue: Tests timeout

**Solution:**
1. Check test timeout settings
2. Verify async operations complete
3. Ensure cleanup happens promptly

## Understanding Output

### Memory Profile Output

```
[0s] Initial snapshot: Heap 82MB/95MB, RSS 120MB
[30s] Periodic snapshot: Heap 88MB/102MB, RSS 128MB
[60s] Periodic snapshot: Heap 91MB/105MB, RSS 132MB

Memory Statistics:
  Initial: 82MB
  Final:   91MB
  Peak:    95MB
  Average: 87MB
  Growth:  9MB
  Rate:    9.00MB/min

✅ No warnings - memory stable
```

**What it means:**
- Heap growing slowly ✅
- Rate under threshold ✅
- Total growth acceptable ✅

### Stress Test Output

```
Test: Extended Chat Session (150 messages)
Duration: 38.2s

Memory:
  Initial: 85MB
  Final:   122MB
  Peak:    135MB
  Growth:  37MB
  Rate:    58.11MB/min

✅ No warnings - memory stable
```

**What it means:**
- Peak memory reasonable ✅
- Growth acceptable for load ✅
- No threshold exceeded ✅

## Need Help?

1. **Check Documentation**
   - [SUMMARY.md](./SUMMARY.md) - Full overview
   - [README.md](./README.md) - Detailed guide
   - [results.md](./results.md) - Metrics and analysis

2. **Run Diagnostics**
   ```bash
   pnpm memory:profile:extended
   ```

3. **Capture Evidence**
   - Heap snapshot (.heapsnapshot)
   - Profile output JSON
   - Console logs
   - DevTools timeline

4. **File an Issue**
   - Include: reproduction steps, profiling data, screenshots
   - Tag: `memory`, `performance`

---

**Remember**: Memory stability is everyone's responsibility! 🚀

When in doubt, profile it out. ⚡
