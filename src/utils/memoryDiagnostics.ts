import * as vscode from "vscode"
import { Package } from "../shared/package"

/**
 * Memory diagnostics utility for tracking and logging memory usage.
 * Only logs when the enableMemoryDiagnostics setting is enabled.
 */
export class MemoryDiagnostics {
    private static outputChannel: vscode.OutputChannel | undefined
    private static monitoringInterval: NodeJS.Timeout | undefined
    private static startTime: number | undefined

    static setOutputChannel(channel: vscode.OutputChannel): void {
        this.outputChannel = channel
    }

    private static isEnabled(): boolean {
        return vscode.workspace.getConfiguration(Package.name).get<boolean>("enableMemoryDiagnostics", false)
    }

    /**
     * Start periodic memory monitoring
     * @param intervalMs Interval in milliseconds (default: 30000 = 30 seconds)
     */
    static startMonitoring(intervalMs: number = 30000): void {
        if (!this.isEnabled()) {
            return
        }

        if (this.monitoringInterval) {
            return
        }

        this.startTime = Date.now()
        this.log("Memory monitoring started")
        
        this.monitoringInterval = setInterval(() => {
            const uptimeMinutes = Math.round((Date.now() - (this.startTime || Date.now())) / 60000)
            this.snapshot(`Periodic snapshot (uptime: ${uptimeMinutes}m)`)
        }, intervalMs)
    }

    /**
     * Stop periodic memory monitoring
     */
    static stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval)
            this.monitoringInterval = undefined
            this.log("Memory monitoring stopped")
        }
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

        const logMessage = `[MemoryDiagnostics ${timestamp}] ${message} ${JSON.stringify(memoryInfo)}${data ? " " + JSON.stringify(data) : ""}`
        console.log(logMessage)
        
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage)
        }
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
        const memInfo = {
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        }

        const logMessage = `[MemorySnapshot ${timestamp}] ${label} ${JSON.stringify(memInfo)}`
        console.log(logMessage)
        
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage)
        }
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
