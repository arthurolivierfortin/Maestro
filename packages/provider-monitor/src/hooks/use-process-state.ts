import { useState, useEffect } from 'react';
import type { ProcessManager } from '../process-manager.js';

interface ProcessState {
  isRunning: boolean;
  uptime: string;
  pid: number | undefined;
}

/** Hook that tracks the backend process state */
export function useProcessState(processManager: ProcessManager | null): ProcessState {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [uptime, setUptime] = useState('0s');
  const [pid, setPid] = useState<number | undefined>(undefined);

  useEffect(() => {
    const timer = setInterval(() => {
      const running = processManager?.isRunning ?? false;
      setIsRunning(running);
      setPid(processManager?.pid);

      if (running) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed < 60) setUptime(`${elapsed}s`);
        else if (elapsed < 3600) setUptime(`${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
        else setUptime(`${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [processManager, startTime]);

  return { isRunning, uptime, pid };
}
