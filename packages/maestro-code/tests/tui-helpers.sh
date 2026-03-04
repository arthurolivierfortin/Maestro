#!/bin/bash
# TUI Helper Functions — Source this to interact with the running TUI.
#
# These are the ONLY functions a dogfooding subagent should use.
# Each function sends a command to the TUI server and returns the result.
#
# Usage:
#   source /c/Meastro/packages/maestro-code/tests/tui-helpers.sh
#   tui_spawn demo
#   tui_frame
#   tui_press /
#   tui_type "Hello world"
#   tui_wait "MAESTRO"
#   tui_check "Agent"
#   tui_kill

TUI_IPC_DIR="${TUI_IPC_DIR:-/tmp/tui-ipc}"
TUI_SCRIPT_DIR="/c/Meastro/packages/maestro-code"

# Internal: send a command to the TUI server and print the result
_tui_cmd() {
  local cmd="$*"
  local result_file="$TUI_IPC_DIR/result.txt"

  # Remove previous result
  rm -f "$result_file"

  # Write command
  echo "$cmd" > "$TUI_IPC_DIR/cmd"

  # Wait for result (max 60s)
  local waited=0
  while [ ! -f "$result_file" ] && [ $waited -lt 120 ]; do
    sleep 0.5
    waited=$((waited + 1))
  done

  if [ ! -f "$result_file" ]; then
    echo "[tui-helpers] ERROR: Timeout waiting for result (60s)"
    return 1
  fi

  cat "$result_file"
  rm -f "$result_file"
}

# Start the TUI server in background.
# Args: [demo|real] [--repo path]
tui_spawn() {
  local mode="${1:-demo}"
  shift 2>/dev/null
  local extra_args="$*"

  mkdir -p "$TUI_IPC_DIR"

  # Kill any existing server
  if [ -f "$TUI_IPC_DIR/pid" ]; then
    local old_pid
    old_pid=$(cat "$TUI_IPC_DIR/pid")
    kill "$old_pid" 2>/dev/null
    sleep 1
  fi

  # Clean IPC dir
  rm -f "$TUI_IPC_DIR"/{cmd,result.txt,ready,pid,frame.txt}

  echo "[tui-helpers] Starting TUI in $mode mode..."
  cd "$TUI_SCRIPT_DIR" && npx tsx tests/tui-cli.ts serve --mode "$mode" --ipc-dir "$TUI_IPC_DIR" $extra_args > "$TUI_IPC_DIR/server.log" 2>&1 &
  local server_pid=$!
  echo "[tui-helpers] Server PID: $server_pid"

  # Wait for ready signal (max 30s)
  local waited=0
  while [ ! -f "$TUI_IPC_DIR/ready" ] && [ $waited -lt 60 ]; do
    sleep 0.5
    waited=$((waited + 1))
  done

  if [ ! -f "$TUI_IPC_DIR/ready" ]; then
    echo "[tui-helpers] ERROR: TUI did not become ready in 30s"
    echo "[tui-helpers] Server log:"
    cat "$TUI_IPC_DIR/server.log" 2>/dev/null
    return 1
  fi

  echo "[tui-helpers] TUI is ready!"
  cat "$TUI_IPC_DIR/frame.txt"
}

# Capture and display the current screen frame.
tui_frame() {
  _tui_cmd frame
}

# Send a keypress to the TUI. Shows the frame after the press.
# Args: <key> — one of: enter, escape, tab, up, down, left, right, /
tui_press() {
  if [ -z "$1" ]; then
    echo "[tui-helpers] Usage: tui_press <key>"
    echo "  Keys: enter, escape, tab, up, down, left, right, /"
    return 1
  fi
  _tui_cmd "press $1"
}

# Type text into the TUI. Shows the frame after typing.
# Args: <text>
tui_type() {
  if [ -z "$1" ]; then
    echo "[tui-helpers] Usage: tui_type <text>"
    return 1
  fi
  _tui_cmd "type $*"
}

# Wait for specific text to appear on screen (max timeout).
# Args: <text> [--timeout ms]
tui_wait() {
  if [ -z "$1" ]; then
    echo "[tui-helpers] Usage: tui_wait <text> [--timeout ms]"
    return 1
  fi
  _tui_cmd "wait $*"
}

# Wait for the screen to stop changing.
# Args: [--timeout ms]
tui_stable() {
  _tui_cmd "stable $*"
}

# Check if text exists on screen. Returns PASS or FAIL.
# Args: <text>
tui_check() {
  if [ -z "$1" ]; then
    echo "[tui-helpers] Usage: tui_check <text>"
    return 1
  fi
  _tui_cmd "check $*"
}

# Kill the TUI server and clean up.
tui_kill() {
  _tui_cmd kill

  # Also kill the server process
  if [ -f "$TUI_IPC_DIR/pid" ]; then
    local pid
    pid=$(cat "$TUI_IPC_DIR/pid")
    kill "$pid" 2>/dev/null
  fi

  echo "[tui-helpers] Cleanup complete."
}

echo "[tui-helpers] TUI functions loaded: tui_spawn, tui_frame, tui_press, tui_type, tui_wait, tui_stable, tui_check, tui_kill"
