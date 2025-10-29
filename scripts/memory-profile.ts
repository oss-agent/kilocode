#!/usr/bin/env node

/**
 * Memory Profiling Script
 * 
 * This script monitors memory usage of the extension and can be used
 * for manual verification, CI/CD checks, or long-running stress tests.
 * 
 * Usage:
 *   pnpm tsx scripts/memory-profile.ts [options]
 * 
 * Options:
 *   --duration <seconds>   How long to run the profiler (default: 300)
 *   --interval <seconds>   How often to capture snapshots (default: 10)
 *   --threshold <mb>       Memory threshold in MB to warn about (default: 500)
 *   --output <path>        Write results to JSON file
 */

import * as fs from "fs"
import * as path from "path"

interface MemorySnapshot {
	timestamp: number
	heapUsed: number
	heapTotal: number
	external: number
	rss: number
	arrayBuffers: number
}

interface ProfilingResult {
	startTime: number
	endTime: number
	duration: number
	snapshots: MemorySnapshot[]
	stats: {
		initialHeapUsed: number
		finalHeapUsed: number
		peakHeapUsed: number
		averageHeapUsed: number
		totalGrowth: number
		growthRate: number
		gcCount: number
	}
	warnings: string[]
}

class MemoryProfiler {
	private snapshots: MemorySnapshot[] = []
	private startTime: number = 0
	private intervalId: NodeJS.Timeout | null = null
	private gcCount: number = 0

	constructor(
		private duration: number,
		private interval: number,
		private threshold: number,
	) {}

	start(): Promise<ProfilingResult> {
		return new Promise((resolve) => {
			console.log("🔍 Starting memory profiling...")
			console.log(`Duration: ${this.duration}s, Interval: ${this.interval}s, Threshold: ${this.threshold}MB\n`)

			this.startTime = Date.now()

			if (global.gc) {
				console.log("✅ Garbage collection exposed (--expose-gc)")
			} else {
				console.log("⚠️  Garbage collection not exposed. Run with --expose-gc for better results")
			}

			this.captureSnapshot("Initial snapshot")

			this.intervalId = setInterval(() => {
				this.captureSnapshot("Periodic snapshot")

				const elapsed = (Date.now() - this.startTime) / 1000
				if (elapsed >= this.duration) {
					this.stop(resolve)
				}
			}, this.interval * 1000)
		})
	}

	private captureSnapshot(label: string): void {
		const usage = process.memoryUsage()
		const snapshot: MemorySnapshot = {
			timestamp: Date.now(),
			heapUsed: usage.heapUsed,
			heapTotal: usage.heapTotal,
			external: usage.external,
			rss: usage.rss,
			arrayBuffers: usage.arrayBuffers || 0,
		}

		this.snapshots.push(snapshot)

		const heapUsedMB = Math.round(snapshot.heapUsed / 1024 / 1024)
		const heapTotalMB = Math.round(snapshot.heapTotal / 1024 / 1024)
		const rssMB = Math.round(snapshot.rss / 1024 / 1024)

		const elapsed = Math.round((Date.now() - this.startTime) / 1000)

		console.log(
			`[${elapsed}s] Heap: ${heapUsedMB}MB / ${heapTotalMB}MB | RSS: ${rssMB}MB ${heapUsedMB > this.threshold ? "⚠️  THRESHOLD EXCEEDED" : ""}`,
		)

		if (heapUsedMB > this.threshold) {
			console.log(`   🔴 Memory usage (${heapUsedMB}MB) exceeds threshold (${this.threshold}MB)`)
		}
	}

	private stop(resolve: (result: ProfilingResult) => void): void {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}

		this.captureSnapshot("Final snapshot")

		const endTime = Date.now()
		const result = this.generateResult(endTime)

		console.log("\n📊 Profiling Complete\n")
		this.printSummary(result)

		resolve(result)
	}

	private generateResult(endTime: number): ProfilingResult {
		const heapUsedValues = this.snapshots.map((s) => s.heapUsed)
		const initialHeapUsed = heapUsedValues[0] || 0
		const finalHeapUsed = heapUsedValues[heapUsedValues.length - 1] || 0
		const peakHeapUsed = Math.max(...heapUsedValues)
		const averageHeapUsed = heapUsedValues.reduce((sum, val) => sum + val, 0) / heapUsedValues.length
		const totalGrowth = finalHeapUsed - initialHeapUsed
		const durationSeconds = (endTime - this.startTime) / 1000
		const growthRate = totalGrowth / durationSeconds

		const warnings: string[] = []

		if (finalHeapUsed > this.threshold * 1024 * 1024) {
			warnings.push(`Final heap usage (${Math.round(finalHeapUsed / 1024 / 1024)}MB) exceeds threshold`)
		}

		if (totalGrowth > 200 * 1024 * 1024) {
			warnings.push(
				`Significant memory growth detected: ${Math.round(totalGrowth / 1024 / 1024)}MB over ${Math.round(durationSeconds)}s`,
			)
		}

		const growthRateMBPerMin = (growthRate / 1024 / 1024) * 60
		if (growthRateMBPerMin > 5) {
			warnings.push(`High growth rate: ${growthRateMBPerMin.toFixed(2)}MB/min suggests potential memory leak`)
		}

		return {
			startTime: this.startTime,
			endTime,
			duration: durationSeconds,
			snapshots: this.snapshots,
			stats: {
				initialHeapUsed: Math.round(initialHeapUsed / 1024 / 1024),
				finalHeapUsed: Math.round(finalHeapUsed / 1024 / 1024),
				peakHeapUsed: Math.round(peakHeapUsed / 1024 / 1024),
				averageHeapUsed: Math.round(averageHeapUsed / 1024 / 1024),
				totalGrowth: Math.round(totalGrowth / 1024 / 1024),
				growthRate: (growthRate / 1024 / 1024) * 60,
				gcCount: this.gcCount,
			},
			warnings,
		}
	}

	private printSummary(result: ProfilingResult): void {
		console.log("=== Memory Profiling Summary ===\n")
		console.log(`Duration: ${result.duration.toFixed(1)}s`)
		console.log(`Snapshots captured: ${result.snapshots.length}\n`)

		console.log("Memory Statistics:")
		console.log(`  Initial heap: ${result.stats.initialHeapUsed}MB`)
		console.log(`  Final heap:   ${result.stats.finalHeapUsed}MB`)
		console.log(`  Peak heap:    ${result.stats.peakHeapUsed}MB`)
		console.log(`  Average heap: ${result.stats.averageHeapUsed}MB`)
		console.log(`  Total growth: ${result.stats.totalGrowth}MB`)
		console.log(`  Growth rate:  ${result.stats.growthRate.toFixed(2)}MB/min\n`)

		if (result.warnings.length > 0) {
			console.log("⚠️  Warnings:")
			result.warnings.forEach((warning) => console.log(`  - ${warning}`))
			console.log()
		} else {
			console.log("✅ No memory warnings detected\n")
		}

		const status = result.warnings.length === 0 ? "PASS" : "FAIL"
		const statusIcon = status === "PASS" ? "✅" : "❌"
		console.log(`${statusIcon} Status: ${status}\n`)
	}

	async saveResults(outputPath: string, result: ProfilingResult): Promise<void> {
		const dir = path.dirname(outputPath)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}

		fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
		console.log(`💾 Results saved to: ${outputPath}`)
	}
}

function parseArgs(): {
	duration: number
	interval: number
	threshold: number
	output?: string
} {
	const args = process.argv.slice(2)
	let duration = 300
	let interval = 10
	let threshold = 500
	let output: string | undefined

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--duration":
				duration = parseInt(args[++i], 10)
				break
			case "--interval":
				interval = parseInt(args[++i], 10)
				break
			case "--threshold":
				threshold = parseInt(args[++i], 10)
				break
			case "--output":
				output = args[++i]
				break
			case "--help":
			case "-h":
				console.log(`
Memory Profiling Script

Usage: pnpm tsx scripts/memory-profile.ts [options]

Options:
  --duration <seconds>   How long to run the profiler (default: 300)
  --interval <seconds>   How often to capture snapshots (default: 10)
  --threshold <mb>       Memory threshold in MB to warn about (default: 500)
  --output <path>        Write results to JSON file
  --help, -h             Show this help message

Example:
  pnpm tsx scripts/memory-profile.ts --duration 600 --interval 30 --threshold 400
				`)
				process.exit(0)
		}
	}

	return { duration, interval, threshold, output }
}

async function main() {
	const { duration, interval, threshold, output } = parseArgs()

	const profiler = new MemoryProfiler(duration, interval, threshold)

	const result = await profiler.start()

	if (output) {
		await profiler.saveResults(output, result)
	}

	if (result.warnings.length > 0) {
		process.exit(1)
	}
}

main().catch((error) => {
	console.error("Error during profiling:", error)
	process.exit(1)
})
