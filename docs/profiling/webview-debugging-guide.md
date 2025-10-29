# Webview Memory Debugging Guide

## Quick Start

This guide helps you debug memory issues in the Kilo Code webview using Chrome DevTools.

---

## Prerequisites

- Kilo Code extension installed in VS Code
- Chrome/Chromium-based browser knowledge
- Basic understanding of JavaScript heap concepts

---

## Opening DevTools

### Method 1: VS Code Built-in DevTools
1. Open VS Code with Kilo Code extension
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Toggle Developer Tools" and select it
4. Or use menu: `Help > Toggle Developer Tools`

### Method 2: Remote Debugging (Development)
1. Start the dev server:
   ```bash
   cd webview-ui
   pnpm run dev
   ```
2. Open Chrome to `chrome://inspect`
3. Click "Configure" and add `localhost:5173` (or port from `.vite-port`)
4. Your webview should appear in the Remote Target list
5. Click "inspect"

---

## Taking Heap Snapshots

### Basic Workflow

1. **Open Memory Tab**
   - In DevTools, click the "Memory" tab
   - Select "Heap snapshot"

2. **Take Initial Snapshot**
   - Click "Take snapshot"
   - Wait for it to complete
   - Label it mentally as "Baseline"

3. **Perform Actions**
   - Use the extension normally
   - Example: Create a long conversation, add images, switch tabs

4. **Take Second Snapshot**
   - Click "Take snapshot" again
   - Label it mentally as "After Actions"

5. **Compare Snapshots**
   - Select the second snapshot
   - Change dropdown from "Summary" to "Comparison"
   - Select the first snapshot to compare against
   - Look for objects with increased count or size

### What to Look For

#### 🔴 Red Flags (Potential Leaks)

**Detached DOM Trees**
- Shows DOM nodes not attached to document
- Should not accumulate over time
- Filter by: `Detached DOM tree`

**Growing Arrays**
- Arrays that grow without bound
- Common culprits: `clineMessages`, `filePaths`
- Filter by: `Array`
- Check the `Shallow Size` and `Retained Size` columns

**Event Listeners**
- Should remain constant or decrease
- Filter by: `EventListener`
- Compare counts between snapshots

**Closures Retaining Data**
- Functions capturing large objects
- Filter by: `Closure`
- Expand to see what's captured

#### 🟡 Things to Monitor

**React Fiber Nodes**
- React's internal representation
- Some growth is normal
- Excessive growth indicates component leak

**Query Cache Entries**
- From React Query
- Filter by: `QueryCache` or `Query`
- Should eventually be garbage collected

**Audio Buffers**
- From sound playback
- Filter by: `AudioBuffer` or `Howl`
- Should be released after playback

#### 🟢 Normal Behavior

**Some Growth Expected**
- Message history increases during use
- Component state for visible UI
- Cached API responses (temporarily)

---

## Performance Recording

### Recording a Session

1. **Open Performance Tab**
   - In DevTools, click "Performance" tab

2. **Start Recording**
   - Click the record button (circle icon)
   - Or press `Ctrl+E` / `Cmd+E`

3. **Perform Actions**
   - Use the extension
   - Keep session under 30 seconds for easier analysis

4. **Stop Recording**
   - Click stop button (square icon)
   - Or press `Ctrl+E` / `Cmd+E` again

5. **Analyze Results**
   - Look at the Memory section (bottom timeline)
   - Check for:
     - Sawtooth pattern (normal - GC working)
     - Steadily increasing line (potential leak)
     - Sudden drops (GC events)

### Memory Timeline Analysis

**Healthy Pattern:**
```
Memory
  ^
  |    /\    /\    /\
  |   /  \  /  \  /  \
  |  /    \/    \/    \
  +--------------------> Time
```
Memory increases, GC collects, repeats.

**Leak Pattern:**
```
Memory
  ^
  |              ___---
  |         __---
  |    __---
  |---'
  +--------------------> Time
```
Memory steadily increases, GC cannot reclaim.

---

## Specific Test Scenarios

### Test 1: Long Conversation Memory

**Purpose:** Verify message history doesn't leak

**Steps:**
1. Take baseline snapshot
2. Create new chat
3. Send 100 messages (use copy-paste to speed up)
4. Take snapshot 2
5. Start new conversation
6. Take snapshot 3

**Expected:**
- Snapshot 2 should show increased messages
- Snapshot 3 should be similar to baseline
- Old messages should be garbage collected

**Red Flags:**
- Messages from old conversation still in memory
- Ever-growing `clineMessages` array

### Test 2: Image Memory

**Purpose:** Verify base64 images are released

**Steps:**
1. Take baseline snapshot
2. Add 5 large images (~5MB each)
3. Take snapshot 2
4. Send message (images should be cleared from input)
5. Take snapshot 3
6. Start new conversation
7. Take snapshot 4

**Expected:**
- Snapshot 2: ~25MB more memory (5 images)
- Snapshot 3: Images released from input state
- Snapshot 4: Images no longer in message history (if new conversation clears)

**Red Flags:**
- Base64 strings retained after sending
- Images accumulating in memory

### Test 3: Tab Switching

**Purpose:** Verify components don't leak on unmount

**Steps:**
1. Take baseline snapshot
2. Switch tabs: Chat → Settings → History → Marketplace → Chat
3. Repeat 10 times
4. Take snapshot 2

**Expected:**
- Similar component counts between snapshots
- No accumulation of unmounted components

**Red Flags:**
- Growing Fiber nodes for unmounted tabs
- Multiple instances of the same component
- Event listeners multiplying

### Test 4: Marketplace Filtering

**Purpose:** Verify state manager cleanup

**Steps:**
1. Open Marketplace tab
2. Take snapshot
3. Apply 10 different filter combinations
4. Take snapshot 2
5. Switch away and back
6. Take snapshot 3

**Expected:**
- Filtered results don't accumulate
- State resets properly on navigation

**Red Flags:**
- Old filtered arrays retained
- Multiple state copies

---

## Common Memory Leak Patterns

### Pattern 1: Event Listener Leak

**Symptoms:**
- EventListener count increases
- Multiple listeners for same event

**Example:**
```typescript
// BAD - no cleanup
useEffect(() => {
    window.addEventListener('message', handler)
    // Missing return cleanup!
}, [])

// GOOD - proper cleanup
useEffect(() => {
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
}, [])
```

### Pattern 2: Timer Leak

**Symptoms:**
- Multiple timers running
- Timers not cleared

**Example:**
```typescript
// BAD - timer keeps running
useEffect(() => {
    setInterval(() => { /* work */ }, 1000)
    // Missing cleanup!
}, [])

// GOOD - timer cleaned up
useEffect(() => {
    const id = setInterval(() => { /* work */ }, 1000)
    return () => clearInterval(id)
}, [])
```

### Pattern 3: Closure Capturing Large Data

**Symptoms:**
- Closures in heap snapshot
- Large objects unexpectedly retained

**Example:**
```typescript
// BAD - closure captures entire largeArray
const largeArray = [/* thousands of items */]
const handler = useCallback(() => {
    console.log(largeArray.length) // Captures entire array!
}, [largeArray])

// GOOD - only capture what's needed
const arrayLength = largeArray.length
const handler = useCallback(() => {
    console.log(arrayLength) // Only captures number
}, [arrayLength])
```

### Pattern 4: Cache Not Expiring

**Symptoms:**
- Query cache entries growing
- Old data never released

**Example:**
```typescript
// BAD - no cache limits
const queryClient = new QueryClient()

// GOOD - configured limits
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            cacheTime: 5 * 60 * 1000, // 5 minutes
            staleTime: 1 * 60 * 1000,  // 1 minute
        },
    },
})
```

---

## Analyzing Specific Objects

### Finding Retainers

**What are retainers?**
Objects that hold references preventing garbage collection.

**How to find them:**
1. In heap snapshot, find the object you suspect is leaking
2. Right-click → "Reveal in Summary view"
3. Expand the object
4. Look at the "Retainers" section at bottom
5. Follow the chain to see what's holding the reference

**Example Chain:**
```
Object → Array → Closure → React Component → Root
```
This tells you: A React Component has a closure capturing an array that contains your object.

### Checking Shallow vs Retained Size

**Shallow Size:**
- Memory used by object itself
- Doesn't include referenced objects

**Retained Size:**
- Memory that would be freed if object is deleted
- Includes all references

**High retained size = potential leak target**

---

## Automated Monitoring

### MemoryService Telemetry

The extension already monitors memory every 10 minutes:

**Metrics:**
- `heapUsedMb` - Current heap usage
- `heapTotalMb` - Total allocated heap

**How to access:**
1. Enable telemetry in settings
2. Check logs for `WEBVIEW_MEMORY_USAGE` events
3. Graph over time to spot trends

### Adding Custom Metrics

You can add tracking to specific components:

```typescript
// In your component
useEffect(() => {
    const memory = (performance as any).memory
    if (memory) {
        console.log('Component Memory:', {
            usedMb: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            totalMb: Math.round(memory.totalJSHeapSize / 1024 / 1024),
            component: 'ChatView'
        })
    }
}, [/* when to check */])
```

---

## Storing Profiling Results

### Naming Convention

Use descriptive names:
```
profiling/webview-baseline-2025-01-06.heapsnapshot
profiling/webview-after-100-messages-2025-01-06.heapsnapshot
profiling/webview-after-images-2025-01-06.heapsnapshot
```

### Saving Snapshots

**In Chrome DevTools:**
1. Right-click snapshot in sidebar
2. Select "Save..."
3. Save to `docs/profiling/` directory
4. Commit to Git if reproducible issue

**File Size Warning:**
Heap snapshots can be 50-200MB each. Don't commit unless necessary for bug report.

### Sharing Results

**For Bug Reports:**
1. Take before/after snapshots
2. Note specific steps to reproduce
3. Save snapshots externally (Google Drive, etc.)
4. Share link in issue

**For Documentation:**
1. Take screenshots of comparison view
2. Highlight specific leaked objects
3. Include in markdown with analysis

---

## Troubleshooting DevTools

### DevTools Won't Open

**Issue:** Toggle Developer Tools does nothing

**Solutions:**
1. Reload VS Code window: `Ctrl+R` / `Cmd+R`
2. Restart VS Code
3. Check if extension is active
4. Try `Help > Developer > Open Webview Developer Tools`

### Can't See Webview in Chrome Inspect

**Issue:** Remote target not appearing

**Solutions:**
1. Verify dev server is running (`pnpm run dev`)
2. Check `.vite-port` file for correct port
3. Add port manually in `chrome://inspect` → Configure
4. Check firewall isn't blocking localhost

### Snapshot Taking Forever

**Issue:** "Taking snapshot..." for 5+ minutes

**Solutions:**
1. Wait - large heaps take time
2. Reduce test scenario scope
3. Close other extensions/tabs
4. Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096`

### Out of Memory Taking Snapshot

**Issue:** DevTools crashes during snapshot

**Solutions:**
1. Enable memory profiling in VS Code:
   ```
   code --max-memory=4096
   ```
2. Use sampling profiler instead (Performance tab)
3. Restart VS Code to clear heap first
4. Take snapshot of smaller scenario

---

## Best Practices

### During Development

1. **Test regularly**
   - Take snapshots during feature development
   - Compare before/after adding features
   - Catch leaks early

2. **Profile long-running scenarios**
   - Test with hundreds of messages
   - Test with many images
   - Test switching tabs repeatedly

3. **Monitor production**
   - Check MemoryService telemetry
   - Watch for user reports of slowness
   - Correlate memory with grey screen issues

### Before Release

1. **Baseline testing**
   - Fresh install snapshot
   - After normal use (30 min)
   - After heavy use (2 hours)
   - After stress test (extreme usage)

2. **Regression testing**
   - Compare with previous version
   - Memory should be same or better
   - No new leak patterns

3. **Documentation**
   - Update this guide with findings
   - Document any known issues
   - Share workarounds with users

---

## Resources

### Documentation
- [Chrome DevTools Memory](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Finding Memory Leaks](https://developer.chrome.com/docs/devtools/memory-problems/memory-101/)
- [React DevTools Profiler](https://react.dev/reference/react/Profiler)

### Tools
- Chrome DevTools Memory tab
- Chrome DevTools Performance tab
- VS Code built-in DevTools
- React DevTools extension

### Internal Docs
- `docs/profiling/webview-memory.md` - Full audit report
- `MEMORY_LEAK_FIXES_README.md` - Extension-side fixes
- `docs/MEMORY_LEAK_FIXES.md` - Technical details

---

## Contact

If you discover memory issues:
1. Document the scenario
2. Save heap snapshots
3. Create issue with reproduction steps
4. Ping the platform team

---

**Last Updated:** 2025-01-06  
**Maintained By:** Platform Team
