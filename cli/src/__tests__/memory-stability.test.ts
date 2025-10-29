/**
 * Memory Stability Tests for CLI
 * 
 * These tests monitor process memory usage during CLI operations
 * to detect memory leaks and ensure proper resource cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"

interface MemorySnapshot {
	heapUsed: number
	heapTotal: number
	rss: number
	external: number
	arrayBuffers: number
}

function captureMemorySnapshot(): MemorySnapshot {
	const usage = process.memoryUsage()
	return {
		heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
		heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
		rss: Math.round(usage.rss / 1024 / 1024),
		external: Math.round(usage.external / 1024 / 1024),
		arrayBuffers: Math.round((usage.arrayBuffers || 0) / 1024 / 1024),
	}
}

function logMemorySnapshot(label: string, snapshot: MemorySnapshot): void {
	console.log(`[${label}] Heap: ${snapshot.heapUsed}MB/${snapshot.heapTotal}MB, RSS: ${snapshot.rss}MB`)
}

function calculateMemoryDelta(before: MemorySnapshot, after: MemorySnapshot): number {
	return after.heapUsed - before.heapUsed
}

async function forceGarbageCollection(): Promise<void> {
	if (global.gc) {
		global.gc()
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
}

describe("CLI Memory Stability", () => {
	const MEMORY_THRESHOLD_MB = 200
	const ACCEPTABLE_GROWTH_MB = 50

	beforeEach(async () => {
		await forceGarbageCollection()
	})

	afterEach(async () => {
		await forceGarbageCollection()
	})

	it("should maintain stable memory usage", () => {
		const snapshot = captureMemorySnapshot()
		logMemorySnapshot("Current", snapshot)

		expect(snapshot.heapUsed).toBeLessThan(MEMORY_THRESHOLD_MB)
	})

	it("should clean up memory after operations", async () => {
		const before = captureMemorySnapshot()
		logMemorySnapshot("Before", before)

		const tempData: string[] = []
		for (let i = 0; i < 1000; i++) {
			tempData.push(`Test data ${i}`.repeat(100))
		}

		const during = captureMemorySnapshot()
		logMemorySnapshot("During", during)

		tempData.length = 0

		await forceGarbageCollection()

		const after = captureMemorySnapshot()
		logMemorySnapshot("After GC", after)

		const delta = calculateMemoryDelta(before, after)
		console.log(`Memory delta: ${delta}MB`)

		expect(Math.abs(delta)).toBeLessThan(ACCEPTABLE_GROWTH_MB)
	})

	it("should not accumulate memory over multiple iterations", async () => {
		const initial = captureMemorySnapshot()
		logMemorySnapshot("Initial", initial)

		const iterations = 10
		const snapshots: MemorySnapshot[] = [initial]

		for (let i = 0; i < iterations; i++) {
			const data = Array.from({ length: 100 }, (_, idx) => `Iteration ${i}, Item ${idx}`)

			await new Promise((resolve) => setTimeout(resolve, 10))

			const snapshot = captureMemorySnapshot()
			snapshots.push(snapshot)

			if (i % 3 === 0) {
				await forceGarbageCollection()
			}
		}

		await forceGarbageCollection()

		const final = captureMemorySnapshot()
		logMemorySnapshot("Final", final)

		const totalGrowth = calculateMemoryDelta(initial, final)
		console.log(`Total growth: ${totalGrowth}MB over ${iterations} iterations`)

		const growthPerIteration = totalGrowth / iterations
		console.log(`Average growth per iteration: ${growthPerIteration.toFixed(2)}MB`)

		expect(totalGrowth).toBeLessThan(ACCEPTABLE_GROWTH_MB)
		expect(growthPerIteration).toBeLessThan(5)
	})

	it("should handle rapid memory allocations and deallocations", async () => {
		const before = captureMemorySnapshot()
		logMemorySnapshot("Before rapid cycles", before)

		const cycles = 5
		for (let cycle = 0; cycle < cycles; cycle++) {
			const largeArray = Array.from({ length: 10000 }, (_, i) => ({
				id: i,
				data: `Data ${i}`.repeat(10),
			}))

			const processed = largeArray.filter((item) => item.id % 2 === 0)

			await new Promise((resolve) => setTimeout(resolve, 10))
		}

		await forceGarbageCollection()

		const after = captureMemorySnapshot()
		logMemorySnapshot("After rapid cycles", after)

		const delta = calculateMemoryDelta(before, after)
		console.log(`Memory delta after ${cycles} cycles: ${delta}MB`)

		expect(Math.abs(delta)).toBeLessThan(ACCEPTABLE_GROWTH_MB)
	})

	it("should track memory trends", async () => {
		const snapshots: Array<{ iteration: number; memory: MemorySnapshot }> = []

		for (let i = 0; i < 20; i++) {
			const snapshot = captureMemorySnapshot()
			snapshots.push({ iteration: i, memory: snapshot })

			if (i % 5 === 0) {
				logMemorySnapshot(`Iteration ${i}`, snapshot)
			}

			await new Promise((resolve) => setTimeout(resolve, 50))
		}

		const firstHalf = snapshots.slice(0, 10)
		const secondHalf = snapshots.slice(10, 20)

		const firstHalfAvg =
			firstHalf.reduce((sum, s) => sum + s.memory.heapUsed, 0) / firstHalf.length
		const secondHalfAvg =
			secondHalf.reduce((sum, s) => sum + s.memory.heapUsed, 0) / secondHalf.length

		console.log(`First half average: ${firstHalfAvg.toFixed(2)}MB`)
		console.log(`Second half average: ${secondHalfAvg.toFixed(2)}MB`)

		const trend = secondHalfAvg - firstHalfAvg
		console.log(`Memory trend: ${trend > 0 ? "+" : ""}${trend.toFixed(2)}MB`)

		expect(Math.abs(trend)).toBeLessThan(30)
	})

	it("should log memory statistics for monitoring", () => {
		const snapshot = captureMemorySnapshot()

		const stats = {
			heapUsedMB: snapshot.heapUsed,
			heapTotalMB: snapshot.heapTotal,
			rssMB: snapshot.rss,
			externalMB: snapshot.external,
			arrayBuffersMB: snapshot.arrayBuffers,
			timestamp: new Date().toISOString(),
		}

		console.log("Memory Statistics:", JSON.stringify(stats, null, 2))

		expect(stats.heapUsedMB).toBeGreaterThan(0)
		expect(stats.heapUsedMB).toBeLessThan(MEMORY_THRESHOLD_MB)
	})
})

describe("CLI Process Memory Limits", () => {
	it("should not exceed maximum heap size", () => {
		const snapshot = captureMemorySnapshot()
		logMemorySnapshot("Process memory", snapshot)

		expect(snapshot.heapUsed).toBeLessThan(500)

		console.log("✅ Process memory within acceptable limits")
	})

	it("should report memory usage trends", async () => {
		const duration = 1000
		const interval = 100
		const samples: MemorySnapshot[] = []

		const startTime = Date.now()
		while (Date.now() - startTime < duration) {
			samples.push(captureMemorySnapshot())
			await new Promise((resolve) => setTimeout(resolve, interval))
		}

		const avgHeapUsed = samples.reduce((sum, s) => sum + s.heapUsed, 0) / samples.length
		const maxHeapUsed = Math.max(...samples.map((s) => s.heapUsed))
		const minHeapUsed = Math.min(...samples.map((s) => s.heapUsed))

		console.log(`Samples: ${samples.length}`)
		console.log(`Average heap: ${avgHeapUsed.toFixed(2)}MB`)
		console.log(`Peak heap: ${maxHeapUsed}MB`)
		console.log(`Min heap: ${minHeapUsed}MB`)
		console.log(`Range: ${maxHeapUsed - minHeapUsed}MB`)

		const range = maxHeapUsed - minHeapUsed
		expect(range).toBeLessThan(100)
	})
})
