import { useState, useEffect, useRef, useCallback } from 'react';
import { LogStreamer } from '../log-streamer.js';

interface LogStreamState {
  lines: string[];
  clear: () => void;
}

/** Hook that streams log lines from the Serilog file sink */
export function useLogStream(logDir: string): LogStreamState {
  const [lines, setLines] = useState<string[]>([]);
  const streamerRef = useRef<LogStreamer | null>(null);

  useEffect(() => {
    const streamer = new LogStreamer(logDir);
    streamerRef.current = streamer;

    const unsubscribe = streamer.onLine(() => {
      setLines(streamer.getLines());
    });

    streamer.start();

    // Load initial lines
    setLines(streamer.getLines());

    return () => {
      unsubscribe();
      streamer.stop();
    };
  }, [logDir]);

  const clear = useCallback(() => {
    streamerRef.current?.clear();
    setLines([]);
  }, []);

  return { lines, clear };
}
