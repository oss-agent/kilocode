#!/usr/bin/env node

/**
 * Heap Snapshot Capture Script
 * 
 * This script connects to a running extension host via the inspector protocol
 * and captures a heap snapshot. Useful for profiling extension memory usage.
 * 
 * Prerequisites:
 *   - Launch VS Code extension with --inspect-extensions=9229
 *   - Or use the "Profile Extension (Memory + CPU)" launch configuration
 * 
 * Usage:
 *   pnpm tsx scripts/capture-heap-snapshot.ts [options]
 * 
 * Options:
 *   --port <number>        Inspector port (default: 9229)
 *   --output <path>        Output directory (default: ./profiling)
 *   --label <string>       Label for the snapshot file
 *   --help, -h             Show this help message
 * 
 * Example:
 *   pnpm tsx scripts/capture-heap-snapshot.ts --label baseline
 *   pnpm tsx scripts/capture-heap-snapshot.ts --label after-tasks --port 9229
 */

import * as fs from "fs"
import * as path from "path"
import * as inspector from "inspector"

interface SnapshotOptions {
	port: number
	output: string
	label?: string
}

class HeapSnapshotCapture {
	constructor(private options: SnapshotOptions) {}

	async capture(): Promise<string> {
		console.log("🔍 Attempting to capture heap snapshot...")
		console.log(`Inspector port: ${this.options.port}`)

		const session = new inspector.Session()
		
		try {
			session.connect()
			console.log("✅ Connected to inspector")
		} catch (error) {
			throw new Error(
				`Failed to connect to inspector. Make sure extension is running with --inspect-extensions=${this.options.port}\n` +
				`Error: ${error.message}`
			)
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
		const label = this.options.label ? `-${this.options.label}` : ""
		const filename = `extension-heap${label}-${timestamp}.heapsnapshot`
		const outputPath = path.join(this.options.output, filename)

		if (!fs.existsSync(this.options.output)) {
			fs.mkdirSync(this.options.output, { recursive: true })
			console.log(`📁 Created output directory: ${this.options.output}`)
		}

		console.log("📸 Taking heap snapshot (this may take a moment)...")

		return new Promise((resolve, reject) => {
			const writeStream = fs.createWriteStream(outputPath)
			let chunkCount = 0

			session.on("HeapProfiler.addHeapSnapshotChunk", (m) => {
				writeStream.write(m.params.chunk)
				chunkCount++
				if (chunkCount % 100 === 0) {
					process.stdout.write(".")
				}
			})

			session.post("HeapProfiler.takeHeapSnapshot", null, (err) => {
				if (err) {
					writeStream.end()
					session.disconnect()
					reject(new Error(`Failed to take heap snapshot: ${err.message}`))
					return
				}

				writeStream.end()
				session.disconnect()

				const stats = fs.statSync(outputPath)
				const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

				console.log("\n")
				console.log("✅ Heap snapshot captured successfully!")
				console.log(`📄 File: ${outputPath}`)
				console.log(`📊 Size: ${sizeMB} MB`)
				console.log(`📦 Chunks: ${chunkCount}`)
				console.log("\nNext steps:")
				console.log("1. Open chrome://inspect in Chrome/Edge")
				console.log("2. Click 'Open dedicated DevTools for Node'")
				console.log("3. Go to Memory tab")
				console.log("4. Click 'Load' and select the .heapsnapshot file")
				console.log("5. Analyze retained objects and memory paths")

				resolve(outputPath)
			})
		})
	}
}

function parseArgs(): SnapshotOptions {
	const args = process.argv.slice(2)
	let port = 9229
	let output = "./profiling"
	let label: string | undefined

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--port":
				port = parseInt(args[++i], 10)
				break
			case "--output":
				output = args[++i]
				break
			case "--label":
				label = args[++i]
				break
			case "--help":
			case "-h":
				console.log(`
Heap Snapshot Capture Script

Usage: pnpm tsx scripts/capture-heap-snapshot.ts [options]

Options:
  --port <number>        Inspector port (default: 9229)
  --output <path>        Output directory (default: ./profiling)
  --label <string>       Label for the snapshot file
  --help, -h             Show this help message

Prerequisites:
  Launch extension with: code --extensionDevelopmentPath=./src --inspect-extensions=9229
  Or use the "Profile Extension (Memory + CPU)" launch configuration in VS Code

Example:
  pnpm tsx scripts/capture-heap-snapshot.ts --label baseline
  pnpm tsx scripts/capture-heap-snapshot.ts --label after-tasks --port 9229
				`)
				process.exit(0)
		}
	}

	return { port, output, label }
}

async function main() {
	const options = parseArgs()
	const capture = new HeapSnapshotCapture(options)

	try {
		await capture.capture()
		process.exit(0)
	} catch (error) {
		console.error("\n❌ Error:", error.message)
		console.error("\nTroubleshooting:")
		console.error("- Ensure extension is running with --inspect-extensions flag")
		console.error("- Check that port", options.port, "is not in use")
		console.error("- Try using the 'Profile Extension (Memory + CPU)' launch config")
		process.exit(1)
	}
}

main()
