/**
 * Project Terminal Component
 *
 * Interactive terminal using xterm.js connected to project container via SignalR.
 * Phase 8 implementation.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import './ProjectTerminal.scss';

interface ProjectTerminalProps {
  projectId: string;
  containerId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

export const ProjectTerminal: React.FC<ProjectTerminalProps> = ({
  projectId,
  containerId,
  onConnect,
  onDisconnect: _onDisconnect,
  onError,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#58a6ff40',
        black: '#161b22',
        red: '#f85149',
        green: '#56d364',
        yellow: '#e3b341',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#e6edf3',
        brightBlack: '#6e7681',
        brightRed: '#ff7b72',
        brightGreen: '#7ee787',
        brightYellow: '#f2cc60',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      scrollback: 10000,
      convertEol: true,
    });

    xtermRef.current = terminal;

    // Add fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    // Add web links addon
    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(webLinksAddon);

    // Open terminal in DOM
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Welcome message
    terminal.writeln('\x1b[1;36mMaestro Terminal\x1b[0m');
    terminal.writeln(`Project: ${projectId}`);
    if (containerId) {
      terminal.writeln(`Container: ${containerId.substring(0, 12)}`);
    }
    terminal.writeln('');
    terminal.writeln('Connecting...');

    // Connect to SignalR hub (placeholder for now)
    // TODO: Implement SignalR connection to TerminalHub
    connectToTerminal(projectId, terminal)
      .then((conn) => {
        setConnection(conn);
        setIsConnected(true);
        onConnect?.();
        terminal.writeln('\x1b[32mConnected!\x1b[0m');
        terminal.write('$ ');
      })
      .catch((error) => {
        terminal.writeln(`\x1b[31mConnection failed: ${error.message}\x1b[0m`);
        onError?.(error.message);
      });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      if (connection) {
        disconnectTerminal(connection);
      }
    };
  }, [projectId, containerId]);

  // Handle terminal input
  useEffect(() => {
    const terminal = xtermRef.current;
    if (!terminal || !isConnected) return;

    const disposable = terminal.onData((data) => {
      // Send input to backend via SignalR
      if (connection) {
        sendTerminalInput(connection, data);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [isConnected, connection]);

  return (
    <div className="project-terminal">
      <div className="project-terminal__status">
        <span
          className={`project-terminal__status-indicator ${
            isConnected ? 'project-terminal__status-indicator--connected' : ''
          }`}
        />
        <span className="project-terminal__status-text">
          {isConnected ? 'Connected' : 'Connecting...'}
        </span>
      </div>
      <div className="project-terminal__container" ref={terminalRef} />
    </div>
  );
};

// Placeholder functions for SignalR connection
// TODO: Implement actual SignalR hub connection

async function connectToTerminal(projectId: string, terminal: Terminal): Promise<any> {
  // Simulate connection delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // In production, this would create a SignalR connection to /hubs/terminal/{projectId}
  // and listen for Output/Error events
  const connection = {
    projectId,
    terminal,
    // Mock connection object
  };

  // Simulate receiving output
  setTimeout(() => {
    terminal.writeln('Welcome to the Maestro project terminal!');
    terminal.writeln('Type "help" for available commands.');
    terminal.write('$ ');
  }, 100);

  return connection;
}

function disconnectTerminal(_connection: any): void {
  // In production, this would close the SignalR connection
  // and clean up resources
}

function sendTerminalInput(connection: any, data: string): void {
  // In production, this would send input to the backend via SignalR
  // For now, just echo it back
  const terminal = connection.terminal as Terminal;

  if (data === '\r') {
    // Enter key
    terminal.write('\r\n$ ');
  } else if (data === '\u007F') {
    // Backspace
    terminal.write('\b \b');
  } else if (data === '\u0003') {
    // Ctrl+C
    terminal.write('^C\r\n$ ');
  } else {
    // Regular character
    terminal.write(data);
  }
}

export default ProjectTerminal;
