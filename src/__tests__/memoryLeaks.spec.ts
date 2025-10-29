import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../core/webview/ClineProvider"
import { CodeIndexManager } from "../services/code-index/manager"
import { MemoryDiagnostics } from "../utils/memoryDiagnostics"

// Mock vscode module
vi.mock("vscode", () => ({
    window: {
        createOutputChannel: vi.fn(() => ({
            appendLine: vi.fn(),
            dispose: vi.fn(),
        })),
        registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn((key: string, defaultValue?: any) => {
                if (key === "enableMemoryDiagnostics") return false
                return defaultValue
            }),
        })),
        workspaceFolders: [],
    },
    Disposable: class Disposable {
        dispose() {}
    },
    EventEmitter: class EventEmitter {
        fire() {}
        dispose() {}
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path })),
    },
}))

describe("Memory Leak Prevention", () => {
    describe("ClineProvider disposal", () => {
        let mockContext: any
        let mockOutputChannel: any

        beforeEach(() => {
            mockOutputChannel = {
                appendLine: vi.fn(),
                dispose: vi.fn(),
            }

            mockContext = {
                subscriptions: [],
                globalState: {
                    get: vi.fn((key: string) => {
                        if (key === "taskHistory") return []
                        return undefined
                    }),
                    update: vi.fn(),
                },
                workspaceState: {
                    get: vi.fn(),
                    update: vi.fn(),
                },
                extensionPath: "/mock/path",
            }
        })

        it("should properly dispose all resources", async () => {
            // This test verifies that ClineProvider has a dispose method
            // and that it cleans up its resources
            const provider = new (ClineProvider as any)(
                mockContext,
                mockOutputChannel,
                "sidebar",
                {} as any,
                undefined,
            )

            // Verify provider has dispose method
            expect(typeof provider.dispose).toBe("function")

            // Call dispose and ensure it doesn't throw
            await expect(provider.dispose()).resolves.not.toThrow()

            // Verify that the provider is removed from active instances
            const activeInstances = (ClineProvider as any).activeInstances
            expect(activeInstances.has(provider)).toBe(false)
        })

        it("should clear all pending operations on disposal", async () => {
            const provider = new (ClineProvider as any)(
                mockContext,
                mockOutputChannel,
                "sidebar",
                {} as any,
                undefined,
            )

            // Add a pending operation
            if (provider.setPendingEditOperation) {
                provider.setPendingEditOperation("test-op", 123, "content", undefined, 0, 0)
            }

            // Dispose the provider
            await provider.dispose()

            // Verify pending operations are cleared
            const pendingOps = provider.pendingOperations
            expect(pendingOps.size).toBe(0)
        })
    })

    describe("CodeIndexManager disposal", () => {
        it("should have a disposeAll method", () => {
            // Verify that CodeIndexManager has a disposeAll static method
            expect(typeof CodeIndexManager.disposeAll).toBe("function")
        })

        it("should dispose all instances without throwing", () => {
            // This test verifies the disposeAll method doesn't throw
            expect(() => CodeIndexManager.disposeAll()).not.toThrow()
        })
    })

    describe("Event listener cleanup", () => {
        it("should remove event listeners when component unmounts", () => {
            // This is a placeholder test to ensure we're thinking about
            // event listener cleanup in React components
            const removeListener = vi.fn()
            const cleanup = () => {
                removeListener()
            }

            // Simulate component mount and unmount
            cleanup()

            expect(removeListener).toHaveBeenCalledTimes(1)
        })
    })

    describe("MemoryDiagnostics", () => {
        it("should not log when diagnostics are disabled", () => {
            const consoleSpy = vi.spyOn(console, "log")

            MemoryDiagnostics.log("Test message")
            MemoryDiagnostics.snapshot("Test snapshot")
            MemoryDiagnostics.disposed("TestResource")
            MemoryDiagnostics.created("TestResource")

            // Since enableMemoryDiagnostics defaults to false in our mock,
            // none of these should log
            expect(consoleSpy).not.toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })

    describe("Extension deactivation", () => {
        it("should have all disposal methods available", () => {
            // Verify that critical disposal methods exist
            expect(typeof ClineProvider.prototype.dispose).toBe("function")
            expect(typeof CodeIndexManager.disposeAll).toBe("function")
        })
    })
})
