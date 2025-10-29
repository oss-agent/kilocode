# Webview Memory Leak Audit Report

## Executive Summary

This document provides a comprehensive audit of the React-based webview for potential memory leaks. The audit was conducted to determine whether the webview contributes to memory leaks or grey screen issues through component retention, event listener accumulation, or large buffer leaks.

**Date:** 2025-01-06  
**Scope:** React webview (`/webview-ui/`) including components, context providers, and message passing bridge  
**Status:** ✅ Generally Healthy with Minor Concerns

---

## Methodology

1. Code review of all major React components focusing on:
   - useEffect cleanup patterns
   - Event listener registration/removal
   - Timer and interval management
   - Message passing handlers
   - Large data structure retention
   - React Query cache configuration

2. Analysis of ClineProvider bridge for proper disposal

3. Review of global state management patterns

---

## Key Findings

### ✅ Well-Implemented Patterns

#### 1. Event Listener Cleanup (LOW RISK)

**Component: `App.tsx`**
- Message listener properly cleaned up in `useEvent` hook
- MemoryService properly disposed on unmount

**Component: `ExtensionStateContext.tsx`**
- Window message listener has proper cleanup
```typescript
useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => {
        window.removeEventListener("message", handleMessage)
    }
}, [handleMessage])
```

**Component: `ChatTextArea.tsx`**
- ResizeObserver properly disconnected
- Click outside handlers properly removed
- Multiple message listeners cleaned up

**Component: `ChatView.tsx`**
- Keyboard event listeners cleaned up
- Wheel event listeners cleaned up
- useEvent hook handles cleanup automatically

#### 2. MemoryService Monitoring (LOW RISK)

**File: `webview-ui/src/services/MemoryService.ts`**

The MemoryService is well-implemented with:
- Proper interval cleanup in `stop()` method
- Called from App.tsx with cleanup in useEffect return
- 10-minute sampling interval with 1% sampling rate (minimal overhead)

```typescript
useEffect(() => {
    if (didHydrateState) {
        telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, telemetryDistinctId)
        
        const memoryService = new MemoryService()
        memoryService.start()
        return () => memoryService.stop()
    }
}, [telemetrySetting, telemetryKey, telemetryDistinctId, didHydrateState])
```

#### 3. LRU Cache with TTL (LOW RISK)

**Component: `ChatView.tsx`**

Uses LRU cache with time-to-live for visible messages:
```typescript
const everVisibleMessagesTsRef = useRef<LRUCache<number, boolean>>(
    new LRUCache({
        max: 100,
        ttl: 1000 * 60 * 5, // 5 minutes
    }),
)
```

Additional cleanup interval to prevent stale entries:
```typescript
useEffect(() => {
    const cleanupInterval = setInterval(() => {
        const cache = everVisibleMessagesTsRef.current
        const currentMessageIds = new Set(modifiedMessages.map((m) => m.ts))
        // ... cleanup logic
    }, 60000)
    
    return () => clearInterval(cleanupInterval)
}, [modifiedMessages, visibleMessages])
```

---

### ⚠️ Areas of Concern

#### 1. React Query Configuration (MEDIUM RISK)

**File: `App.tsx`**

The QueryClient is instantiated globally without configuration:

```typescript
const queryClient = new QueryClient()
```

**Issue:** No explicit cache time or garbage collection configuration. React Query defaults:
- `cacheTime`: 5 minutes (300,000ms)
- `staleTime`: 0ms
- No max query cache size

**Potential Impact:**
- Query results cached indefinitely until garbage collected
- Multiple components using queries could accumulate cache entries
- Large API responses retained in memory

**Recommendation:**
```typescript
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            cacheTime: 1000 * 60 * 5, // 5 minutes
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
            // Prevent retaining large result sets
            keepPreviousData: false,
        },
    },
})

// Add periodic cache cleanup
setInterval(() => {
    queryClient.clear()
}, 1000 * 60 * 10) // Clear cache every 10 minutes
```

#### 2. Virtuoso List State Retention (MEDIUM RISK)

**Component: `ChatView.tsx`**

Uses `react-virtuoso` for message list virtualization:

```typescript
<Virtuoso
    ref={virtuosoRef}
    data={visibleMessages}
    // ... other props
/>
```

**Concerns:**
- `visibleMessages` can grow unbounded (no hard limit enforced)
- Virtuoso maintains internal state for scroll position, item measurements
- Ref retained across unmount/remount cycles when tab switching

**Evidence of Mitigation:**
- Messages are filtered and cleaned up in `visibleMessages` useMemo
- LRU cache limits tracked messages
- Cleanup interval removes stale entries

**Recommendation:**
- Monitor message count in production telemetry
- Consider hard cap on message history (e.g., 1000 messages)
- Verify Virtuoso properly releases DOM nodes when switching tabs

#### 3. Sound Hooks Retention (LOW-MEDIUM RISK)

**Component: `ChatView.tsx`**

Uses `use-sound` library for audio playback:

```typescript
const [playNotification] = useSound(getAudioUrl("notification.wav"), soundConfig)
const [playCelebration] = useSound(getAudioUrl("celebration.wav"), soundConfig)
const [playProgressLoop] = useSound(getAudioUrl("progress_loop.wav"), soundConfig)
```

**Concerns:**
- `use-sound` creates Howler instances for each sound
- Audio buffers loaded into memory
- No explicit cleanup seen in code

**Investigation Needed:**
- Check if `use-sound` automatically cleans up when component unmounts
- Verify audio buffers are released
- Test memory usage when sounds play repeatedly

**Recommendation:**
- Review `use-sound` documentation for cleanup requirements
- Consider lazy loading audio files
- Add explicit cleanup if library doesn't handle it

#### 4. Large State Objects in Context (LOW-MEDIUM RISK)

**File: `ExtensionStateContext.tsx`**

Context holds large state objects that persist across the entire app lifecycle:

```typescript
const [state, setState] = useState<ExtensionState>({
    clineMessages: [],       // Can grow very large
    filePaths: [],          // Could be thousands of files
    openedTabs: [],
    customModes: [],
    routerModels: {},       // Large model metadata
    // ... many more fields
})
```

**Concerns:**
- `clineMessages` array can grow unbounded during long conversations
- `filePaths` could contain thousands of workspace file paths
- State updates trigger re-renders in all consumers
- No apparent pagination or windowing for large arrays

**Mitigation Observed:**
- Messages are filtered in `ChatView` to `visibleMessages`
- Not all messages retained in context permanently

**Recommendations:**
1. Implement message history limits (e.g., last 500 messages in context)
2. Use pagination for file paths if workspace is very large
3. Consider splitting context into multiple smaller contexts (messages, settings, files, etc.)

#### 5. MarketplaceViewStateManager Singleton (LOW RISK)

**File: `components/marketplace/MarketplaceViewStateManager.ts`**

A persistent state manager created once in `App.tsx`:

```typescript
const marketplaceStateManager = useMemo(() => new MarketplaceViewStateManager(), [])
```

**Good Practices Observed:**
- Has `cleanup()` method to clear handlers
- State change handlers properly managed with Set
- No auto-polling (removed in code comments)

**Concern:**
- `cleanup()` is never called in App.tsx
- State manager persists for entire app lifecycle
- Handlers could accumulate if components mount/unmount repeatedly

**Recommendation:**
```typescript
useEffect(() => {
    return () => {
        marketplaceStateManager.cleanup()
    }
}, [marketplaceStateManager])
```

#### 6. Image Data in Base64 (MEDIUM-HIGH RISK)

**Component: `ChatView.tsx` and `ChatTextArea.tsx`**

Selected images stored as base64 strings:

```typescript
const [selectedImages, setSelectedImages] = useState<string[]>([])
```

**Concerns:**
- Base64 encoding increases size by ~33%
- Multiple large images can consume significant memory
- Images retained in state until message sent
- Images also stored in message history

**Mitigation Observed:**
- `MAX_IMAGES_PER_MESSAGE = 20` limit enforced
- Images cleared after sending
- Image size limits enforced (5MB per image, 20MB total)

**Recommendations:**
1. Consider using Blob URLs instead of base64 for preview
2. Implement image compression before base64 conversion
3. Add warning when total image memory exceeds threshold
4. Monitor image-related memory usage in telemetry

---

### 🔍 Message Passing Bridge Analysis

#### ClineProvider to Webview Communication

**File: `src/core/webview/ClineProvider.ts`**

The extension-side provider manages webview lifecycle:

**Disposal Patterns:**
- Extension has `dispose()` method for cleanup
- `webviewDisposables` array tracks disposables
- Per previous MEMORY_LEAK_FIXES_README.md, disposal is called in extension.ts

**Message Handlers in Webview:**
All use proper cleanup patterns:

1. **App.tsx:** `useEvent("message", onMessage)` - auto cleanup
2. **ExtensionStateContext:** Manual `addEventListener` with cleanup
3. **ChatView:** `useEvent("message", handleMessage)` - auto cleanup
4. **ChatTextArea:** Multiple message listeners with cleanup

**Potential Issue:**
No evidence that webview explicitly clears its internal state when webview is hidden/destroyed by VSCode. If VSCode reuses the webview iframe without reload, state could accumulate.

**Recommendation:**
Add listener for webview visibility changes to reset state:
```typescript
useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            // Clear large state objects when hidden
            // Reload state when visible again
        }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

---

## Data Retention Analysis

### Components with Large Data Structures

#### 1. ChatView Component
**Retains:**
- `messages` - All conversation messages (no apparent limit)
- `modifiedMessages` - Processed/combined messages
- `visibleMessages` - Filtered messages for display
- `expandedRows` - UI state for collapsed/expanded rows
- `everVisibleMessagesTsRef` - LRU cache (capped at 100, 5min TTL)
- `selectedImages` - Base64 image strings (capped at 20)

**Memory Estimate (large conversation):**
- 500 messages @ ~2KB each = ~1MB
- 20 images @ 5MB each = ~100MB (worst case)
- Expanded rows tracking: minimal
- LRU cache: minimal (only message IDs)

**Total: 1-100MB** depending on image usage

#### 2. ExtensionStateContext
**Retains:**
- `clineMessages` - Duplicate of messages from extension
- `filePaths` - All workspace files (thousands in large repos)
- `openedTabs` - Current tabs
- `mcpServers` - MCP server configurations
- Various settings and configuration objects

**Memory Estimate:**
- Messages: ~1MB
- File paths: ~100KB-1MB for large workspace
- Settings: ~50KB

**Total: 1-2MB**

#### 3. MarketplaceViewStateManager
**Retains:**
- `allItems` - All marketplace items
- `organizationMcps` - Organization MCP items
- Filtered copies of above

**Memory Estimate:** ~500KB-1MB

---

## Remote Debugging Configuration

### Current Vite Configuration

**File: `webview-ui/vite.config.ts`**

The Vite dev server is already configured for remote debugging:

```typescript
server: {
    host: "0.0.0.0", // Allows external connections
    hmr: {
        protocol: "ws",
    },
    cors: {
        origin: "*",
        methods: "*",
        allowedHeaders: "*",
    },
},
```

**Source maps enabled:**
```typescript
build: {
    sourcemap: true,  // Complete source maps
    minify: mode === "production" ? "esbuild" : false,
}
```

### Enabling Remote Debugging

#### For Development Mode:

1. Start the Vite dev server:
```bash
cd webview-ui
pnpm run dev
```

2. The extension will automatically connect to the dev server (port written to `.vite-port`)

3. Open Chrome DevTools in VS Code:
   - `Help > Toggle Developer Tools`
   - Navigate to Memory tab for heap snapshots
   - Navigate to Performance tab for recordings

#### For Production Build:

1. Build with source maps:
```bash
cd webview-ui
pnpm run build
```

2. Source maps are included in build output (`src/webview-ui/build/`)

3. Debugging utilities exposed in production (via `exposeSourceMapsForDebugging()`)

#### Taking Heap Snapshots

**Via Chrome DevTools:**
1. Open DevTools (`Help > Toggle Developer Tools`)
2. Go to Memory tab
3. Select "Heap snapshot"
4. Click "Take snapshot"
5. Repeat after performing actions
6. Compare snapshots to find retained objects

**Look for these patterns in snapshots:**
- `Detached DOM tree` - DOM nodes not cleaned up
- Growing `Array` or `Object` counts - data structure leaks
- `closure` or `system / Context` - captured variables not released
- `EventListener` objects - listeners not removed

---

## Reproduction Test Plan

### Test 1: Message Accumulation
**Steps:**
1. Take initial heap snapshot
2. Create a long conversation (100+ messages)
3. Take second snapshot
4. Navigate away from chat tab
5. Take third snapshot
6. Navigate back to chat tab
7. Take fourth snapshot
8. Start new conversation
9. Take fifth snapshot

**Expected:** Memory should not grow significantly between snapshots 4-5 (new conversation should release old messages)

### Test 2: Image Loading
**Steps:**
1. Take initial heap snapshot
2. Add 20 images to chat input (max allowed)
3. Take second snapshot
4. Send message
5. Take third snapshot
6. Clear chat
7. Take fourth snapshot

**Expected:** Base64 strings should be released in snapshot 4

### Test 3: Tab Switching
**Steps:**
1. Take initial snapshot
2. Switch between all tabs 10 times (chat, settings, history, marketplace, etc.)
3. Take second snapshot
4. Compare retained objects

**Expected:** No accumulation of component instances or event listeners

### Test 4: Marketplace State
**Steps:**
1. Open marketplace tab
2. Take snapshot
3. Apply various filters
4. Take snapshot
5. Navigate away and back
6. Take snapshot

**Expected:** Marketplace state manager should not accumulate old filtered results

### Test 5: Long-Running Session
**Steps:**
1. Leave extension open for 2+ hours
2. Perform various tasks
3. Monitor memory usage via MemoryService telemetry
4. Take snapshots periodically

**Expected:** Memory should stabilize, not grow linearly

---

## Remediation Recommendations

### Priority 1 (Implement Soon)

#### 1.1 Configure React Query Properly
```typescript
// In App.tsx
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            cacheTime: 1000 * 60 * 5,
            staleTime: 1000 * 60,
            retry: 1,
            refetchOnWindowFocus: false,
            keepPreviousData: false,
        },
    },
})

// Add periodic cleanup
useEffect(() => {
    const interval = setInterval(() => {
        queryClient.clear()
    }, 1000 * 60 * 10)
    
    return () => clearInterval(interval)
}, [])
```

#### 1.2 Add MarketplaceViewStateManager Cleanup
```typescript
// In App.tsx
useEffect(() => {
    return () => {
        marketplaceStateManager.cleanup()
    }
}, [marketplaceStateManager])
```

#### 1.3 Enforce Message History Limit
```typescript
// In ExtensionStateContext or ChatView
const MAX_MESSAGE_HISTORY = 500

const trimmedMessages = useMemo(() => {
    if (clineMessages.length > MAX_MESSAGE_HISTORY) {
        return clineMessages.slice(-MAX_MESSAGE_HISTORY)
    }
    return clineMessages
}, [clineMessages])
```

### Priority 2 (Monitor and Investigate)

#### 2.1 Verify Sound Hook Cleanup
- Review `use-sound` library documentation
- Test audio buffer release
- Add explicit cleanup if needed

#### 2.2 Add Image Memory Monitoring
```typescript
// Calculate total image memory
const totalImageMemory = useMemo(() => {
    return selectedImages.reduce((acc, base64) => {
        // Rough estimate: base64 length * 0.75 (accounting for base64 overhead)
        return acc + (base64.length * 0.75)
    }, 0)
}, [selectedImages])

// Warn if over threshold
useEffect(() => {
    const thresholdMB = 50
    if (totalImageMemory > thresholdMB * 1024 * 1024) {
        console.warn(`Image memory usage high: ${(totalImageMemory / 1024 / 1024).toFixed(2)}MB`)
    }
}, [totalImageMemory])
```

#### 2.3 Add Webview Visibility State Management
```typescript
// In App.tsx
useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            // Notify extension that webview is hidden
            vscode.postMessage({ type: 'webviewHidden' })
        } else {
            // Request fresh state when visible again
            vscode.postMessage({ type: 'webviewDidBecomeVisible' })
        }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

### Priority 3 (Long-term Improvements)

#### 3.1 Split Large Context
Split `ExtensionStateContext` into smaller contexts:
- `MessagesContext` - Message data only
- `SettingsContext` - Configuration
- `WorkspaceContext` - Files and tabs
- `UIContext` - UI state

This prevents unnecessary re-renders and makes memory management clearer.

#### 3.2 Implement Message Pagination
Instead of loading all messages at once, paginate:
- Load last 100 messages initially
- Load more on scroll
- Unload old messages when scrolling forward

#### 3.3 Use Blob URLs for Images
Instead of base64:
```typescript
// Convert base64 to Blob URL
const blobUrl = URL.createObjectURL(base64ToBlob(base64String))

// Clean up when done
useEffect(() => {
    return () => {
        URL.revokeObjectURL(blobUrl)
    }
}, [blobUrl])
```

---

## Monitoring and Telemetry

### Current Monitoring

The `MemoryService` already captures:
- `heapUsedMb` - Current heap usage
- `heapTotalMb` - Total heap allocated

Sampled at 1% rate every 10 minutes.

### Recommended Additional Metrics

Add these to MemoryService:

```typescript
interface MemoryMetrics {
    heapUsedMb: number
    heapTotalMb: number
    messageCount: number           // NEW
    imageCount: number              // NEW
    imageMemoryMb: number          // NEW
    filePathCount: number          // NEW
    cacheSize: number              // NEW - React Query cache size
}
```

Track these events:
- `WEBVIEW_MESSAGE_HISTORY_TRIMMED` - When messages are trimmed
- `WEBVIEW_IMAGE_MEMORY_HIGH` - When image memory exceeds threshold
- `WEBVIEW_CACHE_CLEARED` - When React Query cache cleared
- `WEBVIEW_STATE_RESET` - When state is reset on visibility change

---

## Comparison with Extension-Side Fixes

The previous memory leak fixes (documented in MEMORY_LEAK_FIXES_README.md) addressed:
- ✅ ClineProvider disposal
- ✅ CodeIndexManager disposal
- ✅ Event subscription cleanup

This webview audit finds:
- ✅ Most event listeners properly cleaned up
- ⚠️ React Query cache not configured
- ⚠️ Some singleton managers not cleaned up
- ⚠️ Large data structures could accumulate

**Overall:** The webview is generally well-implemented with proper cleanup patterns, but would benefit from explicit cache management and data retention limits.

---

## Conclusion

### Summary

The React webview implementation demonstrates good memory management practices in most areas:
- Event listeners are properly cleaned up
- Timers and intervals are cleared
- LRU caches with TTL are used appropriately
- Message handlers have cleanup functions

**Primary concerns:**
1. React Query cache configuration missing
2. Large message history could accumulate
3. Base64 image data can consume significant memory
4. Some singleton state managers not explicitly cleaned up

**Likelihood of contributing to memory leaks:** **MEDIUM**

The webview is unlikely to be the *primary* cause of memory leaks, but could contribute under heavy usage scenarios:
- Very long conversations (hundreds of messages)
- Frequent image usage
- Long-running sessions
- Rapid tab switching

### Next Steps

1. **Immediate:** Implement Priority 1 recommendations
2. **Short-term:** Set up heap snapshot testing as part of QA
3. **Ongoing:** Monitor MemoryService telemetry in production
4. **Long-term:** Consider architectural improvements (context splitting, pagination)

### Testing Recommendations

Before deploying fixes:
1. Baseline heap snapshots with current code
2. Implement recommendations
3. Compare heap snapshots after fixes
4. Verify memory usage stabilizes over time
5. Test grey screen scenarios specifically

### Documentation

This document should be updated:
- After implementing each recommendation
- When new memory-related issues are discovered
- After performance testing reveals insights
- When telemetry data becomes available

---

## Appendix A: Heap Snapshot Checklist

When reviewing heap snapshots, look for:

### Detached DOM Trees
- ❌ Should not grow over time
- Location: Memory > Detached DOM tree

### Arrays
- ⚠️ Check `clineMessages`, `filePaths`, `queryClient._cache`
- Should not grow unbounded

### Event Listeners
- ❌ Should remain constant or decrease over time
- Location: Memory > Event listeners

### Closures
- ⚠️ Can retain references to large objects
- Review any growing closure objects

### Timers
- ✅ Should match expected count (MemoryService interval, cleanup intervals, etc.)

---

## Appendix B: Files Reviewed

### Core Files
- `webview-ui/src/App.tsx`
- `webview-ui/src/index.tsx`
- `webview-ui/src/context/ExtensionStateContext.tsx`
- `webview-ui/src/services/MemoryService.ts`
- `webview-ui/vite.config.ts`

### Component Files
- `webview-ui/src/components/chat/ChatView.tsx`
- `webview-ui/src/components/chat/ChatTextArea.tsx`
- `webview-ui/src/components/chat/ChatRow.tsx`
- `webview-ui/src/components/marketplace/MarketplaceView.tsx`
- `webview-ui/src/components/marketplace/MarketplaceViewStateManager.ts`
- `webview-ui/src/components/settings/SettingsView.tsx`
- `webview-ui/src/components/history/HistoryView.tsx`

### Bridge Files
- `src/core/webview/ClineProvider.ts`
- `src/shared/ExtensionMessage.ts`
- `src/shared/WebviewMessage.ts`

---

**Audit Completed By:** AI Code Analysis System  
**Review Date:** 2025-01-06  
**Next Review:** After implementing Priority 1 recommendations
