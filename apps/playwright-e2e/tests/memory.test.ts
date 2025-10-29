import { test, expect } from "./playwright-base-test"

test.describe("Memory Stability", () => {
	test("webview remains responsive and does not show grey screen", async ({ workbox }) => {
		await workbox.waitForSelector('iframe.webview[name="kilocode.kilo-code"]', { timeout: 30000 })

		const webviewFrame = workbox.frameLocator('iframe.webview[name="kilocode.kilo-code"]')

		await webviewFrame.locator('[data-testid="chat-input"], textarea, [contenteditable="true"]').first().waitFor({
			state: "visible",
			timeout: 15000,
		})

		const isVisible = await webviewFrame
			.locator('[data-testid="chat-input"], textarea, [contenteditable="true"]')
			.first()
			.isVisible()

		expect(isVisible).toBe(true)

		const backgroundColor = await webviewFrame.locator("body").evaluate((el) => {
			return window.getComputedStyle(el).backgroundColor
		})

		expect(backgroundColor).not.toBe("rgb(128, 128, 128)")
		expect(backgroundColor).not.toBe("grey")
		expect(backgroundColor).not.toBe("gray")

		console.log("✅ Webview is responsive, no grey screen detected")
	})

	test("memory warning banner does not appear during normal operation", async ({ workbox }) => {
		await workbox.waitForSelector('iframe.webview[name="kilocode.kilo-code"]', { timeout: 30000 })

		const webviewFrame = workbox.frameLocator('iframe.webview[name="kilocode.kilo-code"]')

		await webviewFrame.locator('[data-testid="chat-input"], textarea, [contenteditable="true"]').first().waitFor({
			state: "visible",
			timeout: 15000,
		})

		await workbox.waitForTimeout(5000)

		const warningBanner = webviewFrame.locator('div:has-text("memory"), div:has-text("Memory")')
		const warningCount = await warningBanner.count()

		if (warningCount > 0) {
			const warningText = await warningBanner.first().textContent()
			console.log(`⚠️  Warning detected: ${warningText}`)
		}

		expect(warningCount).toBe(0)

		console.log("✅ No memory warnings during normal operation")
	})

	test("webview memory usage stays within bounds", async ({ workbox }) => {
		await workbox.waitForSelector('iframe.webview[name="kilocode.kilo-code"]', { timeout: 30000 })

		const webviewFrame = workbox.frameLocator('iframe.webview[name="kilocode.kilo-code"]')

		await webviewFrame.locator('[data-testid="chat-input"], textarea, [contenteditable="true"]').first().waitFor({
			state: "visible",
			timeout: 15000,
		})

		interface MemoryInfo {
			usedJSHeapSize: number
			totalJSHeapSize: number
			jsHeapSizeLimit: number
		}

		const getMemoryUsage = async (): Promise<MemoryInfo | null> => {
			return await webviewFrame.locator("body").evaluate(() => {
				if ("memory" in performance && typeof performance.memory === "object") {
					const memory = performance.memory as MemoryInfo
					return {
						usedJSHeapSize: memory.usedJSHeapSize,
						totalJSHeapSize: memory.totalJSHeapSize,
						jsHeapSizeLimit: memory.jsHeapSizeLimit,
					}
				}
				return null
			})
		}

		const initialMemory = await getMemoryUsage()
		if (!initialMemory) {
			console.log("⚠️  Memory API not available, skipping detailed memory check")
			return
		}

		const initialMB = Math.round(initialMemory.usedJSHeapSize / 1024 / 1024)
		console.log(`Initial memory: ${initialMB}MB`)

		await workbox.waitForTimeout(10000)

		const afterMemory = await getMemoryUsage()
		if (!afterMemory) {
			console.log("⚠️  Memory API not available after wait")
			return
		}

		const afterMB = Math.round(afterMemory.usedJSHeapSize / 1024 / 1024)
		const limitMB = Math.round(afterMemory.jsHeapSizeLimit / 1024 / 1024)
		const percentUsed = Math.round((afterMemory.totalJSHeapSize / afterMemory.jsHeapSizeLimit) * 100)

		console.log(`After 10s: ${afterMB}MB (${percentUsed}% of ${limitMB}MB limit)`)

		expect(percentUsed).toBeLessThan(90)
		console.log("✅ Memory usage within acceptable bounds")
	})

	test("extended chat session memory stability", async ({ workbox }) => {
		await workbox.waitForSelector('iframe.webview[name="kilocode.kilo-code"]', { timeout: 30000 })

		const webviewFrame = workbox.frameLocator('iframe.webview[name="kilocode.kilo-code"]')

		const chatInput = webviewFrame.locator('[data-testid="chat-input"], textarea, [contenteditable="true"]').first()
		await chatInput.waitFor({ state: "visible", timeout: 15000 })

		interface MemoryInfo {
			usedJSHeapSize: number
			totalJSHeapSize: number
			jsHeapSizeLimit: number
		}

		const getMemoryUsage = async (): Promise<MemoryInfo | null> => {
			return await webviewFrame.locator("body").evaluate(() => {
				if ("memory" in performance && typeof performance.memory === "object") {
					const memory = performance.memory as MemoryInfo
					return {
						usedJSHeapSize: memory.usedJSHeapSize,
						totalJSHeapSize: memory.totalJSHeapSize,
						jsHeapSizeLimit: memory.jsHeapSizeLimit,
					}
				}
				return null
			})
		}

		const initialMemory = await getMemoryUsage()
		if (!initialMemory) {
			console.log("⚠️  Memory API not available, skipping memory tracking")
			return
		}

		const initialMB = Math.round(initialMemory.usedJSHeapSize / 1024 / 1024)
		console.log(`Initial memory: ${initialMB}MB`)

		const messageCount = 10
		for (let i = 0; i < messageCount; i++) {
			await chatInput.fill(`Test message ${i + 1} - checking memory stability`)

			await chatInput.press("Enter")

			await workbox.waitForTimeout(2000)

			const warningBanner = webviewFrame.locator('div:has-text("Memory"), div:has-text("memory")')
			const warningCount = await warningBanner.count()

			if (warningCount > 0) {
				const warningText = await warningBanner.first().textContent()
				console.error(`❌ Memory warning appeared at message ${i + 1}: ${warningText}`)
			}

			expect(warningCount).toBe(0)
		}

		const finalMemory = await getMemoryUsage()
		if (!finalMemory) {
			console.log("⚠️  Memory API not available after test")
			return
		}

		const finalMB = Math.round(finalMemory.usedJSHeapSize / 1024 / 1024)
		const growthMB = finalMB - initialMB
		const growthPerMessage = growthMB / messageCount

		console.log(`Final memory: ${finalMB}MB (growth: ${growthMB}MB, ~${growthPerMessage.toFixed(1)}MB/message)`)

		expect(growthPerMessage).toBeLessThan(20)

		const percentUsed = Math.round((finalMemory.totalJSHeapSize / finalMemory.jsHeapSizeLimit) * 100)
		console.log(`Memory utilization: ${percentUsed}%`)

		expect(percentUsed).toBeLessThan(90)

		console.log("✅ Extended chat session completed without memory issues")
	})

	test("no 'out-of-memory' or 'OOM' console errors", async ({ workbox }) => {
		await workbox.waitForSelector('iframe.webview[name="kilocode.kilo-code"]', { timeout: 30000 })

		const consoleMessages: string[] = []
		const errorMessages: string[] = []

		workbox.on("console", (msg) => {
			const text = msg.text()
			consoleMessages.push(text)

			if (msg.type() === "error") {
				errorMessages.push(text)
			}
		})

		await workbox.waitForTimeout(10000)

		const oomErrors = errorMessages.filter((msg) =>
			msg.toLowerCase().match(/out.?of.?memory|oom|pause before potential/i),
		)

		if (oomErrors.length > 0) {
			console.error("❌ OOM errors detected:")
			oomErrors.forEach((err) => console.error(`  - ${err}`))
		}

		expect(oomErrors).toHaveLength(0)

		console.log(`✅ No OOM errors in ${consoleMessages.length} console messages`)
	})

	test("memory snapshot comparison for task operations", async ({ workbox }) => {
		await workbox.waitForSelector('iframe.webview[name="kilocode.kilo-code"]', { timeout: 30000 })

		const webviewFrame = workbox.frameLocator('iframe.webview[name="kilocode.kilo-code"]')

		await webviewFrame.locator('[data-testid="chat-input"], textarea, [contenteditable="true"]').first().waitFor({
			state: "visible",
			timeout: 15000,
		})

		interface MemoryInfo {
			usedJSHeapSize: number
			totalJSHeapSize: number
			jsHeapSizeLimit: number
		}

		const getMemoryUsage = async (): Promise<MemoryInfo | null> => {
			return await webviewFrame.locator("body").evaluate(() => {
				if ("memory" in performance && typeof performance.memory === "object") {
					const memory = performance.memory as MemoryInfo
					return {
						usedJSHeapSize: memory.usedJSHeapSize,
						totalJSHeapSize: memory.totalJSHeapSize,
						jsHeapSizeLimit: memory.jsHeapSizeLimit,
					}
				}
				return null
			})
		}

		const snapshots: Array<{ label: string; mb: number; timestamp: number }> = []

		const takeSnapshot = async (label: string) => {
			const memory = await getMemoryUsage()
			if (memory) {
				const mb = Math.round(memory.usedJSHeapSize / 1024 / 1024)
				snapshots.push({ label, mb, timestamp: Date.now() })
				console.log(`📸 ${label}: ${mb}MB`)
			}
		}

		await takeSnapshot("Start")

		await workbox.waitForTimeout(5000)
		await takeSnapshot("After 5s")

		await workbox.waitForTimeout(5000)
		await takeSnapshot("After 10s")

		await workbox.waitForTimeout(5000)
		await takeSnapshot("After 15s")

		if (snapshots.length >= 2) {
			const firstMB = snapshots[0].mb
			const lastMB = snapshots[snapshots.length - 1].mb
			const totalGrowthMB = lastMB - firstMB
			const durationSeconds = (snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp) / 1000

			console.log(`Memory delta: ${totalGrowthMB}MB over ${durationSeconds}s`)

			expect(totalGrowthMB).toBeLessThan(200)

			console.log("✅ Memory remained stable across snapshots")
		}
	})
})
