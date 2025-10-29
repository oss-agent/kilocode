# Memory Leak Fixes

This document describes the memory leak fixes implemented in the Kilo Code extension.

## Overview

Memory leaks can cause the extension to consume increasing amounts of memory over time, leading to performance degradation and potential crashes. This document outlines the identified leak sources and their fixes.

## Fixed Memory Leak Sources

### 1. ClineProvider Not Disposed on Deactivation

**Issue**: The `ClineProvider` instances were not being disposed when the extension deactivated, leading to retained references and memory leaks.

**Fix**: Modified `src/extension.ts` to dispose all `ClineProvider` instances in the `deactivate()` function.

```typescript
// Dispose all ClineProvider instances to prevent memory leaks
for (const instance of ClineProvider.activeInstances) {
	await instance.dispose()
}
```

**Impact**: This ensures all webview resources, event listeners, and task stacks are properly cleaned up when the extension is deactivated or reloaded.

### 2. CodeIndexManager Not Disposed on Deactivation

**Issue**: The `CodeIndexManager` singleton instances were not being disposed, leaving file watchers, cache managers, and orchestrators in memory.

**Fix**: Added call to `CodeIndexManager.disposeAll()` in the `deactivate()` function.

```typescript
// Dispose all CodeIndexManager instances to free memory
CodeIndexManager.disposeAll()
```

**Impact**: Properly releases file system watchers, state managers, and other resources used by the code indexing system.

### 3. Code Index Status Subscription Leak

**Issue**: The `codeIndexStatusSubscription` in `ClineProvider` was not being disposed, leaving event subscriptions active.

**Fix**: Added disposal of the subscription in the `ClineProvider.dispose()` method.

```typescript
// Dispose code index status subscription
if (this.codeIndexStatusSubscription) {
	this.codeIndexStatusSubscription.dispose()
	this.codeIndexStatusSubscription = undefined
}
```

**Impact**: Prevents accumulation of event subscriptions over multiple provider lifecycles.

### 4. React Effect Cleanup

**Issue**: Some React components were missing cleanup functions in their `useEffect` hooks, particularly for event listeners.

**Fix**: Verified that critical components like `ExtensionStateContext` and `App` properly return cleanup functions from their effects.

Example:
```typescript
useEffect(() => {
	window.addEventListener("message", handleMessage)
	return () => {
		window.removeEventListener("message", handleMessage)
	}
}, [handleMessage])
```

**Impact**: Prevents event listener accumulation in the webview.

### 5. MemoryService Proper Cleanup

**Issue**: The `MemoryService` was being instantiated but cleanup could be improved.

**Fix**: The existing implementation already has proper cleanup with `stop()` being called in the cleanup function.

```typescript
useEffect(() => {
	if (didHydrateState) {
		const memoryService = new MemoryService()
		memoryService.start()
		return () => memoryService.stop() // ✓ Properly cleans up interval
	}
}, [didHydrateState])
```

**Impact**: Ensures memory monitoring intervals are cleared.

## Diagnostic Features

### Memory Diagnostics Setting

A new setting `kilo-code.enableMemoryDiagnostics` has been added to enable detailed memory logging when investigating memory issues.

**Usage**:
1. Open VS Code settings
2. Search for "Kilo Code: Enable Memory Diagnostics"
3. Enable the setting
4. Reload the extension
5. Check the Developer Tools console for memory diagnostic logs

**Location**: `src/utils/memoryDiagnostics.ts`

**API**:
```typescript
import { MemoryDiagnostics } from "../utils/memoryDiagnostics"

// Log memory usage with a message
MemoryDiagnostics.log("Operation completed")

// Take a memory snapshot
MemoryDiagnostics.snapshot("Before heavy operation")

// Log resource disposal
MemoryDiagnostics.disposed("TaskInstance", { taskId })

// Log resource creation
MemoryDiagnostics.created("WebviewPanel", { viewId })
```

## Testing

Memory leak fixes are validated through:

1. **Unit Tests**: `src/__tests__/memoryLeaks.spec.ts` contains tests that verify:
   - ClineProvider has and properly calls dispose method
   - CodeIndexManager has disposeAll static method
   - Pending operations are cleared on disposal
   - Event listeners are cleaned up

2. **Manual Testing**: Run the extension through a typical usage flow:
   - Create multiple tasks
   - Switch between webview panels
   - Reload the extension window
   - Monitor memory usage in Chrome DevTools

3. **Memory Profiling**: Use VS Code's built-in memory profiler:
   ```bash
   code --inspect-extensions=9333
   ```
   Then connect Chrome DevTools and take heap snapshots.

## Best Practices

To prevent future memory leaks:

1. **Always implement disposal**: Any class that manages resources should implement a `dispose()` method
2. **Return cleanup functions**: All React `useEffect` hooks should return cleanup functions
3. **Track subscriptions**: Keep references to event subscriptions and dispose them
4. **Clear intervals/timeouts**: Always clear timers in cleanup functions
5. **Weak references**: Use `WeakMap` for auxiliary data tied to object lifecycles
6. **Test disposal**: Add unit tests that verify disposal methods work correctly

## Monitoring

### Extension Host Memory

Monitor extension host memory using:
```typescript
const memUsage = process.memoryUsage()
console.log({
	heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
	heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
})
```

### Webview Memory

The webview has built-in memory monitoring via `MemoryService` that reports usage every 10 minutes (at 1% sample rate for telemetry).

The `MemoryWarningBanner` component displays a warning when memory usage exceeds 90% of the heap limit.

## Related Files

- `src/extension.ts` - Main extension activation/deactivation
- `src/core/webview/ClineProvider.ts` - Webview provider with disposal logic
- `src/services/code-index/manager.ts` - Code index manager with disposeAll
- `src/core/task/Task.ts` - Task disposal implementation
- `webview-ui/src/services/MemoryService.ts` - Webview memory monitoring
- `webview-ui/src/kilocode/MemoryWarningBanner.tsx` - Memory warning UI
- `src/utils/memoryDiagnostics.ts` - Diagnostic logging utility

## Changelog Entry

See `CHANGELOG.md` for the version-specific entry about these fixes.

## Future Improvements

Potential areas for additional memory optimization:

1. Implement bounded caches with LRU eviction
2. Add telemetry for tracking memory patterns
3. Periodic garbage collection hints for long-running tasks
4. Memory budget limits for large file operations
5. Streaming responses to avoid buffering large payloads
