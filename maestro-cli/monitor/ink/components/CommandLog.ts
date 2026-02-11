// @ts-nocheck
/**
 * CommandLog Component (Ink)
 *
 * Displays history of commands executed on the session.
 * - Shows commands in reverse chronological order (newest first)
 * - Each: status icon + time + command name
 * - Result line if available (truncated to 60 chars)
 * - Max 20 commands
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  T, primary, muted, dim, success,
  statusColor, statusIcon, formatTime, truncate,
  icons,
} from '../theme.ts';

// ── Constants ───────────────────────────────────────────────────

const MAX_COMMANDS = 20;

// ── Single command entry ────────────────────────────────────────

const CommandEntry = ({ cmd }) => {
  const time = cmd.timestamp ? formatTime(cmd.timestamp) : '--:--:--';
  const status = cmd.status || 'completed';

  const sIcon = status === 'completed' ? icons.done
    : status === 'failed' ? icons.failed
    : icons.running;

  const sColor = status === 'completed' ? 'green'
    : status === 'failed' ? 'red'
    : 'cyan';

  const commandName = cmd.command || 'command';

  // Result line (optional)
  let resultLine = null;
  if (cmd.result) {
    const resultStr = typeof cmd.result === 'string' ? cmd.result : JSON.stringify(cmd.result);
    const truncated = truncate(resultStr, 60);
    resultLine = h(Box, { flexDirection: 'row', paddingLeft: 5 },
      success(icons.arrow),
      h(Text, null, ' '),
      muted(truncated)
    );
  }

  return h(Box, { flexDirection: 'column', marginBottom: 1 },
    h(Box, { flexDirection: 'row', paddingLeft: 2 },
      T(sColor, sIcon),
      h(Text, null, ' '),
      dim(time),
      h(Text, null, '  '),
      primary(commandName)
    ),
    resultLine
  );
};

// ── Main component ──────────────────────────────────────────────

const CommandLog = ({ session, context }) => {
  const commandLog = session?.variables?._commandLog || [];

  if (commandLog.length === 0) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      dim('(no commands executed yet)'),
      h(Box, { height: 1 }),
      dim('execute: maestro session vars <id> set <key> <value>'),
      dim('invoke:  maestro session invoke <id> <entry-point>')
    );
  }

  // Show commands in reverse chronological order (newest first)
  const commands = [...commandLog].reverse().slice(0, MAX_COMMANDS);

  const children = [];

  for (let i = 0; i < commands.length; i++) {
    children.push(h(CommandEntry, { key: 'cmd-' + i, cmd: commands[i] }));
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 }, ...children);
};

export { CommandLog };
