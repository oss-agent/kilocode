# Webview Memory Leak - Quick Reference Card

**Last Updated:** 2025-01-06

---

## 🚨 Suspected Memory Leak? Start Here

1. **Open DevTools:** `Help > Toggle Developer Tools`
2. **Go to Memory tab**
3. **Take 2 snapshots** (before and after the issue)
4. **Compare them** (dropdown → Comparison)
5. **Look for** growing arrays, detached DOM, event listeners

---

## 📊 Quick Heap Snapshot

```javascript
// In DevTools Console
const m = performance.memory
console.log({
  used: (m.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB',
  total: (m.totalJSHeapSize / 1024 / 1024).toFixed(1) + ' MB'
})
```

**Healthy:** 20-100 MB  
**Warning:** 100-500 MB  
**Critical:** > 500 MB

---

## 🔍 What to Look For

### ❌ Red Flags (Leaks)

- **Detached DOM trees** - Should be 0 or very few
- **Growing arrays** - Check `clineMessages`, `filePaths`
- **Multiple components** - Same component multiple times
- **EventListener count** - Should stay constant
- **Old data retained** - After clearing chat

### ✅ Normal Behavior

- Message history grows during use
- Small GC sawtooth pattern
- Component count for visible UI
- Some cached API responses

---

## 🧪 Quick Tests

### Test 1: Message Memory (5 min)
1. New chat
2. Send 50 messages
3. Clear chat
4. Check heap - should return to baseline

### Test 2: Image Memory (5 min)
1. Add 5 images
2. Send message
3. Clear chat
4. Check heap - images should be gone

### Test 3: Tab Switching (5 min)
1. Switch tabs 10 times
2. Check heap - should stay stable

---

## 🛠️ Common Fixes

### Missing Cleanup
```typescript
// ❌ BAD
useEffect(() => {
  window.addEventListener('event', handler)
}, [])

// ✅ GOOD
useEffect(() => {
  window.addEventListener('event', handler)
  return () => window.removeEventListener('event', handler)
}, [])
```

### Timer Leak
```typescript
// ❌ BAD
useEffect(() => {
  setInterval(() => {}, 1000)
}, [])

// ✅ GOOD
useEffect(() => {
  const id = setInterval(() => {}, 1000)
  return () => clearInterval(id)
}, [])
```

### Closure Capturing Large Data
```typescript
// ❌ BAD - captures entire array
const handler = useCallback(() => {
  console.log(largeArray.length)
}, [largeArray])

// ✅ GOOD - only captures length
const len = largeArray.length
const handler = useCallback(() => {
  console.log(len)
}, [len])
```

---

## 📁 Documentation

- **Full Audit:** `docs/profiling/webview-memory.md`
- **Debug Guide:** `docs/profiling/webview-debugging-guide.md`
- **Test Scenarios:** `docs/profiling/test-scenarios.md`
- **Summary:** `docs/profiling/webview-audit-summary.md`

---

## 🎯 Priority Fixes Needed

### Must Fix (Priority 1)
1. Configure React Query cache limits
2. Add MarketplaceViewStateManager cleanup
3. Enforce message history limit

### Should Fix (Priority 2)
4. Add image memory monitoring
5. Verify sound hook cleanup

### Nice to Have (Priority 3)
6. Split large context
7. Implement message pagination
8. Use Blob URLs for images

---

## 💡 Tips

**Before taking snapshot:**
- Close other apps
- Wait 30 seconds (let GC run)
- Reload VS Code for clean state

**When comparing snapshots:**
- Filter by "Constructor"
- Sort by "Size Delta"
- Look at "Retainers" to find leak source

**Force garbage collection:**
- DevTools Console → Click trash icon 🗑️
- Or run: `node --expose-gc` and call `global.gc()`

---

## 🚀 Remote Debugging

### Development Mode
```bash
cd webview-ui
pnpm run dev
# Open chrome://inspect
# Add localhost:5173
# Click "inspect"
```

### Production Build
- Already has source maps
- Use VS Code DevTools: `Help > Toggle Developer Tools`
- All debugging utilities available

---

## 📞 Getting Help

1. Check documentation first
2. Search closed issues
3. Run test scenarios
4. Create issue with:
   - Heap snapshots (external link)
   - Reproduction steps
   - Memory metrics

---

## 🎓 Learning Resources

- [Chrome DevTools Memory](https://developer.chrome.com/docs/devtools/memory-problems/)
- [React Memory Leaks](https://react.dev/learn/you-might-not-need-an-effect)
- [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)

---

**Print this card** | **Pin to Slack** | **Share with team**
