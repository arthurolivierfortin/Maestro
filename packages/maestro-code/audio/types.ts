/**
 * AudioAdapter — interface for audio input/output.
 *
 * Terminal (Node.js) uses NoopAudioAdapter.
 * Electron apps provide a real implementation (e.g., ElectronAudioAdapter).
 */
export interface AudioAdapter {
  /** Whether the audio subsystem is available in this environment. */
  isAvailable(): boolean;
  /** Start listening for voice input. */
  startListening(): Promise<void>;
  /** Stop listening. */
  stopListening(): Promise<void>;
  /** Register a callback for transcription results. */
  onTranscript(callback: (text: string) => void): void;
  /** Speak text aloud. */
  speak(text: string): Promise<void>;
}

/**
 * No-op audio adapter for terminal environments.
 * Voice mode is a UI state — no actual audio capture happens.
 */
export class NoopAudioAdapter implements AudioAdapter {
  isAvailable(): boolean {
    return false;
  }
  async startListening(): Promise<void> {
    // No-op in terminal
  }
  async stopListening(): Promise<void> {
    // No-op in terminal
  }
  onTranscript(_callback: (text: string) => void): void {
    // No-op in terminal
  }
  async speak(_text: string): Promise<void> {
    // No-op in terminal
  }
}
