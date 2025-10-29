# Memory Leak Test Scenarios

This document provides specific test scenarios to reproduce and verify memory leak fixes in the Kilo Code webview.

---

## Overview

Each scenario includes:
- **Objective** - What we're testing
- **Prerequisites** - What you need before starting
- **Steps** - Exact steps to reproduce
- **Expected Behavior** - What should happen
- **Red Flags** - What indicates a leak
- **Metrics to Track** - What to measure

---

## General Setup

### Before Each Test

1. Close all unnecessary VS Code windows
2. Disable other extensions (test in isolation)
3. Clear browser cache if using remote debugging
4. Restart VS Code for clean state
5. Open Chrome DevTools: `Help > Toggle Developer Tools`
6. Navigate to Memory tab

### Taking Snapshots

1. Click "Take snapshot" button
2. Wait for completion (can take 30-60 seconds)
3. Label with scenario name
4. Export for later comparison

---

## Scenario 1: Message Accumulation

### Objective
Verify that old messages are properly garbage collected when starting a new conversation.

### Prerequisites
- Fresh VS Code window
- No active conversations

### Steps

1. **Take Baseline Snapshot**
   ```
   Label: "S1-Baseline"
   ```

2. **Create Long Conversation**
   - Start new chat
   - Copy-paste this prompt 50 times:
     ```
     Explain what this number means: [1, 2, 3, ... 50]
     ```
   - Let all responses complete
   - Wait 30 seconds

3. **Take After-Messages Snapshot**
   ```
   Label: "S1-After-50-Messages"
   ```

4. **Start New Conversation**
   - Click "New Chat" or equivalent
   - Wait for conversation to clear
   - Wait 60 seconds (allow GC to run)

5. **Take After-Clear Snapshot**
   ```
   Label: "S1-After-Clear"
   ```

### Expected Behavior

**Comparing S1-After-50-Messages to S1-Baseline:**
- Array objects should increase (messages stored)
- String objects should increase (message content)
- Heap size increase: ~1-5 MB

**Comparing S1-After-Clear to S1-Baseline:**
- Should be similar in size
- Old message strings should be gone
- Array count should return to baseline
- Heap size should be within 1-2 MB of baseline

### Red Flags

- ❌ Old messages still in heap after clearing
- ❌ `clineMessages` array still populated
- ❌ Memory does not decrease after clear
- ❌ Detached DOM trees accumulating

### Metrics to Track

```javascript
// In DevTools Console after each snapshot:
const memory = performance.memory
console.log({
    scenario: 'S1-After-Clear',
    heapUsedMb: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
    heapTotalMb: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2)
})
```

Expected values:
- Baseline: 20-40 MB
- After messages: 25-50 MB
- After clear: 20-40 MB (similar to baseline)

---

## Scenario 2: Image Memory Management

### Objective
Verify that base64-encoded images are released from memory after being sent.

### Prerequisites
- Fresh VS Code window
- Test images available (5 images, ~2-3 MB each)

### Steps

1. **Take Baseline Snapshot**
   ```
   Label: "S2-Baseline"
   ```

2. **Add Images to Chat Input**
   - Click image/attachment button
   - Select 5 images
   - Do NOT send yet
   - Wait 10 seconds

3. **Take After-Images-Added Snapshot**
   ```
   Label: "S2-After-Images-Added"
   ```

4. **Send Message**
   - Type: "Analyze these images"
   - Send message
   - Wait for response to complete

5. **Take After-Message-Sent Snapshot**
   ```
   Label: "S2-After-Message-Sent"
   ```

6. **Start New Conversation**
   - Clear the chat
   - Wait 60 seconds (GC)

7. **Take After-Clear Snapshot**
   ```
   Label: "S2-After-Clear"
   ```

### Expected Behavior

**S2-After-Images-Added vs S2-Baseline:**
- String objects increase significantly
- Heap increase: ~10-15 MB (images as base64)

**S2-After-Message-Sent vs S2-After-Images-Added:**
- Input state cleared (images moved to messages)
- Similar or slightly lower heap (images moved, not duplicated)

**S2-After-Clear vs S2-Baseline:**
- Should be similar
- Base64 strings released
- Heap returns to baseline (+/- 2 MB)

### Red Flags

- ❌ Base64 strings remain after clear
- ❌ Multiple copies of same image data
- ❌ Heap does not decrease after clear
- ❌ Memory leak warning in MemoryService

### Metrics to Track

```javascript
// Check for base64 image strings in snapshot
// Filter by: String
// Look for very long strings starting with "data:image/"
// These should disappear after clearing
```

Expected heap growth:
- Baseline: 20-40 MB
- After images: 30-55 MB
- After sent: 30-55 MB
- After clear: 20-40 MB

---

## Scenario 3: Tab Switching Components

### Objective
Verify that component cleanup works when switching between tabs.

### Prerequisites
- Fresh VS Code window

### Steps

1. **Take Baseline Snapshot**
   ```
   Label: "S3-Baseline"
   Note: Currently on Chat tab
   ```

2. **Switch Through All Tabs (10 Cycles)**
   - Cycle through: Chat → Settings → History → Marketplace → Modes → Chat
   - Complete this cycle 10 times
   - Pause 2 seconds between each switch
   - Total time: ~2 minutes

3. **Take After-Switching Snapshot**
   ```
   Label: "S3-After-10-Cycles"
   Note: Currently on Chat tab
   ```

4. **Wait for Garbage Collection**
   - Stay on Chat tab
   - Wait 60 seconds
   - Don't interact with anything

5. **Take After-GC Snapshot**
   ```
   Label: "S3-After-GC"
   ```

### Expected Behavior

**S3-After-10-Cycles vs S3-Baseline:**
- Component count should be similar
- No accumulation of unmounted components
- EventListener count should be stable
- Heap increase: < 5 MB

**S3-After-GC vs S3-Baseline:**
- Should be nearly identical
- Any temporary allocations collected

### Red Flags

- ❌ Multiple instances of same component (e.g., 10x SettingsView)
- ❌ Growing Fiber node count
- ❌ Detached DOM trees
- ❌ EventListener count multiplying
- ❌ Closures retaining old component state

### Metrics to Track

In heap snapshot, check:
- Fiber nodes (React internals)
- EventListener count
- Detached DOM tree count

```javascript
// Count React Fiber nodes
// In DevTools Console:
const fibers = document.querySelectorAll('[data-reactroot]')
console.log('React roots:', fibers.length)
```

Expected:
- Baseline: 1-2 React roots
- After switching: 1-2 React roots (same)
- EventListeners: Should remain constant

---

## Scenario 4: Marketplace Filter Memory

### Objective
Verify that marketplace filtering doesn't accumulate filtered result arrays.

### Prerequisites
- Fresh VS Code window

### Steps

1. **Open Marketplace Tab**
   - Navigate to Marketplace

2. **Take Baseline Snapshot**
   ```
   Label: "S4-Marketplace-Baseline"
   ```

3. **Apply Many Filters (20 Combinations)**
   - Filter by type: "mcp"
   - Add search term: "test"
   - Add tag filter: "ai"
   - Clear filters
   - Repeat with different combinations 20 times
   - Time: ~3 minutes

4. **Take After-Filtering Snapshot**
   ```
   Label: "S4-After-Filters"
   ```

5. **Navigate Away and Back**
   - Go to Chat tab
   - Wait 30 seconds
   - Go back to Marketplace
   - Wait 30 seconds

6. **Take After-Navigation Snapshot**
   ```
   Label: "S4-After-Navigation"
   ```

### Expected Behavior

**S4-After-Filters vs S4-Marketplace-Baseline:**
- Small increase for current filter state
- No accumulation of old filtered arrays
- Heap increase: < 2 MB

**S4-After-Navigation vs S4-Marketplace-Baseline:**
- Should be very similar
- State properly reset
- No stale data

### Red Flags

- ❌ Multiple `displayItems` arrays
- ❌ Old filtered results retained
- ❌ Growing `MarketplaceViewStateManager` state
- ❌ Handler functions accumulating

### Metrics to Track

In heap snapshot, search for:
- `MarketplaceViewStateManager`
- `displayItems`
- `allItems`
- State change handlers

Expected: Only 1-2 instances of filtered data

---

## Scenario 5: Long-Running Session

### Objective
Verify that memory stabilizes over a long session and doesn't grow linearly.

### Prerequisites
- Fresh VS Code window
- Prepare various tasks (messages, images, tab switches, etc.)
- Plan for 2-hour session

### Steps

1. **Initial Snapshot**
   ```
   Label: "S5-Hour-0"
   Time: 0:00
   ```

2. **Normal Usage for 30 Minutes**
   - Create 2-3 conversations (10-20 messages each)
   - Switch tabs occasionally
   - Use different features
   - Add a few images

3. **30-Minute Snapshot**
   ```
   Label: "S5-Hour-0.5"
   Time: 0:30
   ```

4. **Continue Usage for 30 Minutes**
   - Similar to step 2
   - Mix of activities

5. **1-Hour Snapshot**
   ```
   Label: "S5-Hour-1"
   Time: 1:00
   ```

6. **Continue Usage for 1 Hour**
   - Keep using normally
   - More conversations
   - Test all major features

7. **2-Hour Snapshot**
   ```
   Label: "S5-Hour-2"
   Time: 2:00
   ```

8. **Idle for 10 Minutes**
   - Don't interact
   - Let GC run

9. **After-Idle Snapshot**
   ```
   Label: "S5-Hour-2-After-GC"
   Time: 2:10
   ```

### Expected Behavior

**Memory Growth Pattern:**
```
Hour 0:   20-40 MB  (baseline)
Hour 0.5: 40-80 MB  (active usage)
Hour 1:   50-100 MB (more usage)
Hour 2:   50-120 MB (stabilizing)
After GC: 40-100 MB (GC working)
```

Memory should plateau, not grow linearly:
```
Healthy:           Unhealthy:
    /---           
   /              /
  /              /
 /              /
---------------  --------------->
```

### Red Flags

- ❌ Linear growth (10+ MB per 30 min)
- ❌ No GC effect after idle period
- ❌ Memory > 500 MB
- ❌ Grey screen appears

### Metrics to Track

Record every 30 minutes:
```javascript
{
    time: '0:30',
    heapUsedMb: 45.2,
    heapTotalMb: 89.5,
    messageCount: 35,
    imageCount: 3,
    tabSwitches: 15
}
```

Plot over time to visualize trend.

---

## Scenario 6: React Query Cache Growth

### Objective
Verify that React Query cache doesn't grow unbounded.

### Prerequisites
- React Query DevTools installed (optional but helpful)
- Fresh VS Code window

### Steps

1. **Take Baseline Snapshot**
   ```
   Label: "S6-Baseline"
   ```

2. **Trigger Multiple Query Operations**
   - Open Settings (may use queries)
   - Change API configuration (queries)
   - Open Marketplace (queries)
   - Search for items (queries)
   - Repeat 20 times

3. **Take After-Queries Snapshot**
   ```
   Label: "S6-After-Queries"
   ```

4. **Wait for Cache Expiration**
   - Wait 10 minutes (default cacheTime is 5 min)
   - Don't interact with anything

5. **Take After-Expiration Snapshot**
   ```
   Label: "S6-After-Cache-Expiry"
   ```

### Expected Behavior

**S6-After-Queries vs S6-Baseline:**
- Query cache entries present
- Small heap increase: < 5 MB

**S6-After-Expiration vs S6-After-Queries:**
- Expired entries should be GC'd
- Heap should decrease
- Back near baseline

### Red Flags

- ❌ Query cache growing unbounded
- ❌ Stale queries not expiring
- ❌ QueryClient retaining all historical queries
- ❌ No decrease after expiration time

### Metrics to Track

If React Query DevTools available:
```javascript
// Check query cache size
queryClient.getQueryCache().getAll().length
```

In heap snapshot, search for:
- `QueryCache`
- `Query` objects
- `queryClient`

Expected: < 50 cached queries at any time

---

## Scenario 7: Sound Playback Memory

### Objective
Verify that audio buffers are released after sound playback.

### Prerequisites
- Sound enabled in settings
- Fresh VS Code window

### Steps

1. **Take Baseline Snapshot**
   ```
   Label: "S7-Baseline"
   ```

2. **Trigger Sounds 50 Times**
   - Complete tasks that trigger celebration sound
   - Or use notification sounds
   - Total: 50 sound plays
   - Time: ~5 minutes

3. **Take After-Sounds Snapshot**
   ```
   Label: "S7-After-Sounds"
   ```

4. **Idle Period**
   - Wait 2 minutes
   - Let audio system clean up

5. **Take After-Idle Snapshot**
   ```
   Label: "S7-After-Idle"
   ```

### Expected Behavior

**S7-After-Sounds vs S7-Baseline:**
- Small increase for loaded audio files
- Heap increase: < 5 MB (audio buffers ~100KB each)

**S7-After-Idle vs S7-Baseline:**
- Should be similar
- Audio buffers may persist (this is normal)
- No large accumulation

### Red Flags

- ❌ Multiple copies of same audio buffer
- ❌ Very large audio buffer retention (> 50 MB)
- ❌ `Howl` instances accumulating
- ❌ `AudioContext` not being reused

### Metrics to Track

In heap snapshot, search for:
- `AudioBuffer`
- `Howl` (from use-sound/howler.js)
- `AudioContext`

Expected: 3-5 AudioBuffer objects (one per sound file)

---

## Automated Testing Script

For CI/CD integration, here's a script to automate some checks:

```javascript
// run-memory-tests.js
const { chromium } = require('playwright')

async function runMemoryTest() {
    const browser = await chromium.launch({ devtools: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Connect to VS Code webview
    // (Implementation depends on how you expose webview)
    
    // Test Scenario 1: Message Accumulation
    console.log('Running Scenario 1...')
    const baseline = await page.evaluate(() => performance.memory.usedJSHeapSize)
    
    // Send 50 messages
    for (let i = 0; i < 50; i++) {
        await page.fill('textarea', `Test message ${i}`)
        await page.click('[data-testid="send-button"]')
        await page.waitForTimeout(1000)
    }
    
    const afterMessages = await page.evaluate(() => performance.memory.usedJSHeapSize)
    
    // Clear conversation
    await page.click('[data-testid="new-chat-button"]')
    await page.waitForTimeout(5000) // Wait for GC
    
    const afterClear = await page.evaluate(() => performance.memory.usedJSHeapSize)
    
    // Verify memory was reclaimed
    const memoryGrowth = afterClear - baseline
    console.log(`Memory growth after clear: ${memoryGrowth / 1024 / 1024} MB`)
    
    if (memoryGrowth > 10 * 1024 * 1024) { // 10 MB threshold
        throw new Error('Memory leak detected: messages not cleared')
    }
    
    console.log('✅ Scenario 1 passed')
    
    await browser.close()
}

runMemoryTest().catch(console.error)
```

---

## Reporting Results

### For Each Scenario

Document:
1. Date and time of test
2. VS Code version
3. Extension version
4. Operating system
5. Heap snapshot file names
6. Memory metrics at each step
7. Pass/Fail status
8. Any anomalies observed

### Template

```markdown
## Test Results: Scenario 1

**Date:** 2025-01-06 14:30 UTC
**VS Code:** 1.85.0
**Extension:** 2.5.0
**OS:** macOS 14.1

### Snapshots
- Baseline: `s1-baseline-2025-01-06.heapsnapshot` (28.5 MB heap)
- After Messages: `s1-after-messages-2025-01-06.heapsnapshot` (35.2 MB heap)
- After Clear: `s1-after-clear-2025-01-06.heapsnapshot` (29.1 MB heap)

### Metrics
| Step | Heap Used | Heap Total | Delta from Baseline |
|------|-----------|------------|---------------------|
| Baseline | 28.5 MB | 58.2 MB | 0 MB |
| After Messages | 35.2 MB | 68.5 MB | +6.7 MB |
| After Clear | 29.1 MB | 59.0 MB | +0.6 MB |

### Result: ✅ PASS

Memory was reclaimed after clearing conversation. Delta of 0.6 MB is within acceptable range.

### Notes
- GC ran automatically after ~45 seconds
- No detached DOM trees observed
- EventListener count remained constant
```

---

## Troubleshooting

### High Baseline Memory

If baseline is > 50 MB:
1. Restart VS Code
2. Disable other extensions
3. Clear browser cache
4. Check for background tasks

### Snapshots Too Large

If snapshots > 200 MB:
1. Memory may already be leaking
2. Clear cache and restart
3. Take snapshot sooner in test
4. Check for large retained objects

### GC Not Running

To force GC (for testing only):
1. Open DevTools Console
2. Click trash icon (Collect Garbage)
3. Wait 10 seconds
4. Take snapshot

---

## Next Steps

After completing these scenarios:

1. **Analyze Results**
   - Compare against baselines in `docs/profiling/README.md`
   - Document any failures
   - Identify leak sources

2. **Fix Issues**
   - Refer to `docs/profiling/webview-memory.md` for recommendations
   - Implement fixes
   - Re-run scenarios to verify

3. **Update Documentation**
   - Add new scenarios as needed
   - Update expected metrics
   - Document any new leak patterns found

---

**Last Updated:** 2025-01-06  
**Maintained By:** QA Team + Platform Team
