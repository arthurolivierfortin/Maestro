import { EventEmitter } from 'events'

const API_BASE = import.meta.env.VITE_API_URL || ''

export class RealExecutionService {
  private emitter = new EventEmitter()
  private connection: any = null

  async startExecution(workflowId: string, inputs: Record<string, unknown> = {}) {
    const res = await fetch(`${API_BASE}/api/workflowexecution/${workflowId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    })

    if (!res.ok && res.status !== 202) throw new Error('Failed to start execution')

    const payload = await res.json().catch(() => null)
    const executionId = payload?.executionId

    // start SignalR connection mock (frontend uses real SignalR in production)
    this.connectSignalR(executionId)
    return executionId
  }

  connectSignalR(executionId: string) {
    // Minimal placeholder to simulate subscribe; in prod use @microsoft/signalr
    this.connection = { executionId }
    setTimeout(() => this.emitter.emit('ExecutionStarted', { executionId }), 100)
  }

  on(event: string, cb: (...args: any[]) => void) {
    this.emitter.on(event, cb)
  }

  off(event: string, cb: (...args: any[]) => void) {
    this.emitter.off(event, cb)
  }
}
