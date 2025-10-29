import * as vscode from "vscode"
import { Package } from "../shared/package"

/**
 * Memory diagnostics utility for tracking and logging memory usage.
 * Only logs when the enableMemoryDiagnostics setting is enabled.
 */
export class MemoryDiagnostics {
	private static isEnabled(): boolean {
		return vscode.workspace.getConfiguration(Package.name).get<boolean>("enableMemoryDiagnostics", false)
	}

	/**
	 * Log memory diagnostic information
	 */
	static log(message: string, data?: any): void {
		if (!this.isEnabled()) {
			return
		}

		const timestamp = new Date().toISOString()
		const memoryUsage = process.memoryUsage()
		const memoryInfo = {
			heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
			heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
			external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
			rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
		}

		console.log(`[MemoryDiagnostics ${timestamp}] ${message}`, memoryInfo, data || "")
	}

	/**
	 * Log a memory snapshot with a label
	 */
	static snapshot(label: string): void {
		if (!this.isEnabled()) {
			return
		}

		const timestamp = new Date().toISOString()
		const memoryUsage = process.memoryUsage()

		console.log(`[MemorySnapshot ${timestamp}] ${label}`, {
			heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
			heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
			external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
			rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
		})
	}

	/**
	 * Log when a resource is disposed
	 */
	static disposed(resourceType: string, details?: any): void {
		if (!this.isEnabled()) {
			return
		}

		this.log(`Disposed ${resourceType}`, details)
	}

	/**
	 * Log when a resource is created
	 */
	static created(resourceType: string, details?: any): void {
		if (!this.isEnabled()) {
			return
		}

		this.log(`Created ${resourceType}`, details)
	}
}
