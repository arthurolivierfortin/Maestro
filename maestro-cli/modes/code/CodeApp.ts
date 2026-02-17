import { createElement as h, useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { WidgetDispatcher } from '../../../shared/tui/widgets/WidgetDispatcher.ts';
import type { WidgetRequest, WidgetResponse } from '../../../shared/tui/widgets/index.ts';

interface CodeAppProps {
  apiClient: any;
  sessionId: string;
  agentId?: string;
  onExit: () => void;
}

type AppState = 'agent-select' | 'running' | 'idle' | 'widget-input';

interface AgentInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * maestro code — Interactive TUI mode
 *
 * Architecture:
 * - Session Manager: creates/manages the session
 * - Agent Runner: executes the selected agent
 * - User Input: permanent input field at the bottom
 * - Widget Zone: displays agent-requested widgets
 */
export const CodeApp = ({ apiClient, sessionId, agentId, onExit }: CodeAppProps) => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(agentId ? 'running' : 'agent-select');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(agentId || null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentCursor, setAgentCursor] = useState(0);
  const [messages, setMessages] = useState<Array<{ role: string; text: string; time: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [activeWidgets, setActiveWidgets] = useState<WidgetRequest[]>([]);
  const [pendingWidget, setPendingWidget] = useState<WidgetRequest | null>(null);
  const [sessionStatus, setSessionStatus] = useState('idle');
  const [currentPhase, setCurrentPhase] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load available agents
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await apiClient.getBlocks?.({ type: 'agent' });
        const blocks = res?.blocks || res || [];
        const agentList = blocks
          .filter((b: any) => b.blockType === 'agent' && !b.isAtomic)
          .map((b: any) => ({ id: b.id, name: b.name || b.id, description: b.description || '' }));
        setAgents(agentList.length > 0 ? agentList : [
          { id: 'autonomous-dev', name: 'Autonomous Developer', description: 'Full development agent' },
        ]);
      } catch {
        setAgents([
          { id: 'autonomous-dev', name: 'Autonomous Developer', description: 'Full development agent' },
        ]);
      }
    };
    loadAgents();
  }, []);

  // Poll session state
  useEffect(() => {
    if (!sessionId || state === 'agent-select') return;

    const poll = async () => {
      try {
        const session = await apiClient.getSession?.(sessionId);
        if (session) {
          setSessionStatus(session.status || 'idle');
          const agentState = session.variables?._agentState;
          if (agentState && typeof agentState === 'object') {
            setCurrentPhase(agentState.currentPhase || '');
          }

          // Check for widget requests
          const widgetReq = session.variables?._widgetRequest;
          if (widgetReq && widgetReq.type) {
            setPendingWidget(widgetReq);
            setState('widget-input');
          }

          // Collect active display widgets
          const aw = session.variables?._activeWidgets;
          if (Array.isArray(aw)) setActiveWidgets(aw);
        }
      } catch { /* poll failure is ok */ }
    };

    pollRef.current = setInterval(poll, 2000);
    poll(); // immediate first poll
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, state]);

  // Handle keyboard input
  useInput((input, key) => {
    // Ctrl+C to exit
    if (key.ctrl && input === 'c') {
      onExit();
      exit();
      return;
    }

    // Agent selection
    if (state === 'agent-select') {
      if (key.upArrow) setAgentCursor(c => Math.max(0, c - 1));
      if (key.downArrow) setAgentCursor(c => Math.min(agents.length - 1, c + 1));
      if (key.return && agents.length > 0) {
        setSelectedAgent(agents[agentCursor].id);
        setState('idle');
        addMessage('system', `Agent selected: ${agents[agentCursor].name}`);
      }
      return;
    }

    // Skip input handling during widget-input (widget handles its own keys)
    if (state === 'widget-input') return;

    // User text input (idle or running)
    if (key.return && inputText.trim()) {
      const msg = inputText.trim();
      setInputText('');
      addMessage('user', msg);
      sendUserMessage(msg);
      return;
    }
    if (key.backspace || key.delete) {
      setInputText(v => v.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setInputText(v => v + input);
    }
  });

  const addMessage = useCallback((role: string, text: string) => {
    setMessages(prev => [...prev.slice(-50), {
      role,
      text,
      time: new Date().toISOString().slice(11, 19),
    }]);
  }, []);

  const sendUserMessage = useCallback(async (msg: string) => {
    try {
      // If agent isn't running yet, start it with this as the task
      if (state === 'idle' && selectedAgent) {
        setState('running');
        addMessage('system', `Starting ${selectedAgent}...`);
        await apiClient.invokeEntryPoint?.(sessionId, 'start', {
          task: msg,
          agentId: selectedAgent,
        });
      } else {
        // Send to interaction agent via session variable
        await apiClient.setVariable?.(sessionId, '_userMessage', JSON.stringify({
          message: msg,
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (err: any) {
      addMessage('error', `Failed to send: ${err.message || err}`);
    }
  }, [state, selectedAgent, sessionId]);

  const handleWidgetResponse = useCallback(async (value: any) => {
    if (!pendingWidget) return;
    const response: WidgetResponse = {
      requestId: pendingWidget.id,
      type: pendingWidget.type,
      value,
      timestamp: new Date().toISOString(),
    };
    try {
      await apiClient.setVariable?.(sessionId, '_widgetResponse', JSON.stringify(response));
      await apiClient.setVariable?.(sessionId, '_widgetRequest', '{}');
    } catch (err: any) {
      addMessage('error', `Widget response failed: ${err.message || err}`);
    }
    setPendingWidget(null);
    setState(sessionStatus === 'running' ? 'running' : 'idle');
  }, [pendingWidget, sessionId, sessionStatus]);

  // --- Render ---

  // Agent selection screen
  if (state === 'agent-select') {
    return h(Box, { flexDirection: 'column', padding: 1 },
      h(Text, { bold: true, color: 'cyan' }, '◆ maestro code'),
      h(Text, { color: 'gray' }, 'Select an agent to work with:\n'),
      ...agents.map((agent, i) =>
        h(Box, { key: agent.id },
          h(Text, { color: i === agentCursor ? 'cyan' : 'gray' }, i === agentCursor ? '❯ ' : '  '),
          h(Text, { bold: i === agentCursor, color: i === agentCursor ? 'white' : 'gray' }, agent.name),
          h(Text, { color: 'gray', dimColor: true }, `  ${agent.description}`)
        )
      ),
      h(Text, { color: 'gray', dimColor: true, marginTop: 1 }, '↑/↓ navigate  Enter select  Ctrl+C exit')
    );
  }

  // Main code mode
  const statusColor = sessionStatus === 'running' ? 'green' : sessionStatus === 'error' ? 'red' : 'gray';

  return h(Box, { flexDirection: 'column', height: '100%' },
    // Header
    h(Box, { paddingX: 1 },
      h(Text, { bold: true, color: 'cyan' }, '◆ maestro code'),
      h(Text, { color: 'gray' }, ' │ '),
      h(Text, { color: 'white' }, selectedAgent || 'no agent'),
      h(Text, { color: 'gray' }, ' │ '),
      h(Text, { color: statusColor as any }, sessionStatus),
      currentPhase ? h(Text, { color: 'gray' }, ` │ ${currentPhase}`) : null
    ),

    h(Box, { borderStyle: 'single', borderColor: 'gray', width: '100%' }),

    // Message area
    h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1 },
      ...messages.slice(-20).map((msg, i) =>
        h(Box, { key: i },
          h(Text, { color: 'gray', dimColor: true }, `${msg.time} `),
          h(Text, { color: msg.role === 'user' ? 'cyan' : msg.role === 'error' ? 'red' : 'gray', bold: msg.role === 'user' },
            msg.role === 'user' ? '> ' : msg.role === 'system' ? '● ' : '✗ '
          ),
          h(Text, { color: msg.role === 'user' ? 'white' : 'gray' }, msg.text)
        )
      )
    ),

    // Widget zone — display active widgets
    activeWidgets.length > 0 ? h(Box, { flexDirection: 'column', paddingX: 1 },
      ...activeWidgets.map((w, i) =>
        h(WidgetDispatcher, { key: i, request: w, onResponse: () => {} })
      )
    ) : null,

    // Pending interactive widget
    pendingWidget ? h(Box, { paddingX: 1 },
      h(WidgetDispatcher, { request: pendingWidget, onResponse: handleWidgetResponse })
    ) : null,

    // Input line (always visible unless widget is active)
    !pendingWidget ? h(Box, { paddingX: 1, borderStyle: 'single', borderColor: 'cyan', borderTop: true, borderBottom: false, borderLeft: false, borderRight: false },
      h(Text, { color: 'cyan' }, '> '),
      h(Text, null, inputText || h(Text, { color: 'gray', dimColor: true }, 'Type a message or task...'))
    ) : null,

    // Status bar
    h(Box, { paddingX: 1 },
      h(Text, { color: 'gray', dimColor: true }, 'Enter send  Ctrl+C exit')
    )
  );
};
