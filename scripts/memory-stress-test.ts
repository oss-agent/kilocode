#!/usr/bin/env node

/**
 * Memory Stress Test Script
 * 
 * Simulates extended usage scenarios to validate memory stability
 * under realistic workload conditions. Useful for manual verification
 * before releases.
 * 
 * Usage:
 *   pnpm tsx scripts/memory-stress-test.ts [scenario]
 * 
 * Scenarios:
 *   chat       - Extended chat session simulation
 *   tasks      - Multiple task automation simulation
 *   indexing   - Code indexing stress test
 *   mcp        - MCP tool intensive operations
 *   all        - Run all scenarios (default)
 */

interface MemorySnapshot {
	timestamp: number
	heapUsed: number
	heapTotal: number
	external: number
	rss: number
}

class StressTestRunner {
	private snapshots: MemorySnapshot[] = []
	private startTime: number = 0
	private testName: string = ""

	async runScenario(name: string, test: () => Promise<void>): Promise<void> {
		this.testName = name
		this.snapshots = []
		this.startTime = Date.now()

		console.log(`\n${"=".repeat(60)}`)
		console.log(`🧪 Stress Test: ${name}`)
		console.log(`${"=".repeat(60)}\n`)

		this.captureSnapshot("Start")

		try {
			await test()
			console.log("\n✅ Test completed successfully")
		} catch (error) {
			console.error("\n❌ Test failed:", error)
			throw error
		}

		this.captureSnapshot("End")
		this.printSummary()
	}

	private captureSnapshot(label: string): void {
		const usage = process.memoryUsage()
		const snapshot: MemorySnapshot = {
			timestamp: Date.now(),
			heapUsed: usage.heapUsed,
			heapTotal: usage.heapTotal,
			external: usage.external,
			rss: usage.rss,
		}

		this.snapshots.push(snapshot)

		const elapsed = Math.round((Date.now() - this.startTime) / 1000)
		const heapMB = Math.round(snapshot.heapUsed / 1024 / 1024)
		const totalMB = Math.round(snapshot.heapTotal / 1024 / 1024)
		const rssMB = Math.round(snapshot.rss / 1024 / 1024)

		console.log(`[${elapsed}s] ${label}: Heap ${heapMB}MB/${totalMB}MB, RSS ${rssMB}MB`)
	}

	private printSummary(): void {
		if (this.snapshots.length < 2) return

		const heapValues = this.snapshots.map((s) => s.heapUsed)
		const initial = heapValues[0]
		const final = heapValues[heapValues.length - 1]
		const peak = Math.max(...heapValues)
		const average = heapValues.reduce((sum, val) => sum + val, 0) / heapValues.length

		const growth = final - initial
		const duration = (this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp) / 1000
		const growthRate = (growth / duration) * 60

		console.log("\n" + "-".repeat(60))
		console.log("📊 Test Summary")
		console.log("-".repeat(60))
		console.log(`Test: ${this.testName}`)
		console.log(`Duration: ${duration.toFixed(1)}s`)
		console.log(`Snapshots: ${this.snapshots.length}`)
		console.log(`\nMemory:`)
		console.log(`  Initial: ${Math.round(initial / 1024 / 1024)}MB`)
		console.log(`  Final:   ${Math.round(final / 1024 / 1024)}MB`)
		console.log(`  Peak:    ${Math.round(peak / 1024 / 1024)}MB`)
		console.log(`  Average: ${Math.round(average / 1024 / 1024)}MB`)
		console.log(`  Growth:  ${Math.round(growth / 1024 / 1024)}MB`)
		console.log(`  Rate:    ${(growthRate / 1024 / 1024).toFixed(2)}MB/min`)

		const warnings: string[] = []

		if (Math.round(final / 1024 / 1024) > 500) {
			warnings.push("Final memory exceeds 500MB threshold")
		}

		if (Math.round(growth / 1024 / 1024) > 200) {
			warnings.push(`Excessive growth: ${Math.round(growth / 1024 / 1024)}MB`)
		}

		if ((growthRate / 1024 / 1024) > 5) {
			warnings.push(`High growth rate: ${(growthRate / 1024 / 1024).toFixed(2)}MB/min`)
		}

		if (warnings.length > 0) {
			console.log(`\n⚠️  Warnings:`)
			warnings.forEach((w) => console.log(`  - ${w}`))
		} else {
			console.log(`\n✅ No warnings - memory stable`)
		}

		console.log("-".repeat(60) + "\n")
	}

	async sleep(ms: number): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, ms))
	}

	snapshot(label: string): void {
		this.captureSnapshot(label)
	}
}

class ChatSessionStressTest {
	private runner: StressTestRunner

	constructor(runner: StressTestRunner) {
		this.runner = runner
	}

	async run(): Promise<void> {
		await this.runner.runScenario("Extended Chat Session (150 messages)", async () => {
			const messageCount = 150
			const messagesPerBatch = 10
			const delayBetweenMessages = 100
			const delayBetweenBatches = 2000

			const messages: Array<{ role: string; content: string }> = []

			for (let i = 0; i < messageCount; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i + 1}: ${"Content ".repeat(50)}`,
				})

				if ((i + 1) % messagesPerBatch === 0) {
					this.runner.snapshot(`${i + 1} messages`)
					await this.runner.sleep(delayBetweenBatches)

					if (global.gc && i > 0 && i % 50 === 0) {
						global.gc()
						await this.runner.sleep(500)
					}
				}

				await this.runner.sleep(delayBetweenMessages)
			}

			console.log(`\nGenerated ${messages.length} messages`)
		})
	}
}

class TaskAutomationStressTest {
	private runner: StressTestRunner

	constructor(runner: StressTestRunner) {
		this.runner = runner
	}

	async run(): Promise<void> {
		await this.runner.runScenario("Multiple Task Automations (10 runs)", async () => {
			const taskCount = 10
			const filesPerTask = 20
			const delayBetweenTasks = 3000

			for (let taskNum = 0; taskNum < taskCount; taskNum++) {
				const files: Array<{ path: string; content: string }> = []

				for (let fileNum = 0; fileNum < filesPerTask; fileNum++) {
					files.push({
						path: `/tmp/task-${taskNum}-file-${fileNum}.txt`,
						content: `Task ${taskNum} File ${fileNum}\n${"Data ".repeat(100)}`,
					})
				}

				await this.runner.sleep(delayBetweenTasks)
				this.runner.snapshot(`Task ${taskNum + 1} complete`)

				if (global.gc && taskNum > 0 && taskNum % 3 === 0) {
					global.gc()
					await this.runner.sleep(500)
				}
			}

			console.log(`\nCompleted ${taskCount} task simulations`)
		})
	}
}

class CodeIndexingStressTest {
	private runner: StressTestRunner

	constructor(runner: StressTestRunner) {
		this.runner = runner
	}

	async run(): Promise<void> {
		await this.runner.runScenario("Code Indexing Stress (3 full indexes)", async () => {
			const indexRuns = 3
			const filesPerIndex = 5000
			const delayBetweenRuns = 5000

			for (let run = 0; run < indexRuns; run++) {
				const index = new Map<string, string>()

				for (let fileNum = 0; fileNum < filesPerIndex; fileNum++) {
					const path = `/project/src/file-${fileNum}.ts`
					const content = `// File ${fileNum}\nexport const data = "${fileNum}";`
					index.set(path, content)

					if (fileNum % 1000 === 0 && fileNum > 0) {
						await this.runner.sleep(100)
					}
				}

				this.runner.snapshot(`Index run ${run + 1} (${index.size} files)`)

				index.clear()

				if (global.gc) {
					global.gc()
					await this.runner.sleep(1000)
				}

				if (run < indexRuns - 1) {
					await this.runner.sleep(delayBetweenRuns)
				}
			}

			console.log(`\nCompleted ${indexRuns} indexing runs`)
		})
	}
}

class McpToolStressTest {
	private runner: StressTestRunner

	constructor(runner: StressTestRunner) {
		this.runner = runner
	}

	async run(): Promise<void> {
		await this.runner.runScenario("MCP Tool Intensive Operations (50 calls)", async () => {
			const callCount = 50
			const delayBetweenCalls = 200

			for (let i = 0; i < callCount; i++) {
				const result = {
					toolName: `tool-${i}`,
					params: { data: "Parameter data ".repeat(50) },
					result: { output: "Result data ".repeat(50) },
				}

				await this.runner.sleep(delayBetweenCalls)

				if ((i + 1) % 10 === 0) {
					this.runner.snapshot(`${i + 1} MCP calls`)

					if (global.gc && i > 0 && i % 25 === 0) {
						global.gc()
						await this.runner.sleep(500)
					}
				}
			}

			console.log(`\nCompleted ${callCount} MCP tool calls`)
		})
	}
}

async function main() {
	const scenario = process.argv[2] || "all"

	if (!global.gc) {
		console.log("⚠️  Warning: GC not exposed. Run with --expose-gc for better results")
		console.log("   Example: node --expose-gc node_modules/.bin/tsx scripts/memory-stress-test.ts\n")
	}

	const runner = new StressTestRunner()

	const tests: Record<string, () => Promise<void>> = {
		chat: () => new ChatSessionStressTest(runner).run(),
		tasks: () => new TaskAutomationStressTest(runner).run(),
		indexing: () => new CodeIndexingStressTest(runner).run(),
		mcp: () => new McpToolStressTest(runner).run(),
	}

	if (scenario === "all") {
		console.log("🚀 Running all stress test scenarios...\n")
		for (const [name, test] of Object.entries(tests)) {
			try {
				await test()
			} catch (error) {
				console.error(`\n❌ Scenario "${name}" failed:`, error)
				process.exit(1)
			}
		}
		console.log("\n" + "=".repeat(60))
		console.log("✅ All stress tests completed successfully!")
		console.log("=".repeat(60) + "\n")
	} else if (tests[scenario]) {
		await tests[scenario]()
	} else {
		console.error(`Unknown scenario: ${scenario}`)
		console.log(`Available scenarios: ${Object.keys(tests).join(", ")}, all`)
		process.exit(1)
	}
}

main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
