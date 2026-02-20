const http = require('http');

const operation = process.env.MAESTRO_INPUT_OPERATION || '';
const dotPath = process.env.MAESTRO_INPUT_PATH || '';
const rawValue = process.env.MAESTRO_INPUT_VALUE || '';
const phase = process.env.MAESTRO_INPUT_PHASE || '';
// Session ID: try dedicated input, then env var set by session executor
const sessionId = process.env.MAESTRO_INPUT_SESSIONID || process.env.MAESTRO_SESSION_ID || '';
const API_BASE = process.env.MAESTRO_API_BASE || 'http://localhost:5000';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('API timeout')); });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Variable name for the shared workflow state
const STATE_VAR = '_workflowState';

async function getState() {
  const res = await apiRequest('GET', `/api/sessions/${sessionId}/variables/${STATE_VAR}`);
  if (res.status === 200) {
    // API returns {key: "...", value: {...}} — extract the value
    if (res.data && typeof res.data === 'object' && 'value' in res.data) {
      return res.data.value || {};
    }
    return res.data;
  }
  return {};
}

async function setState(state) {
  await apiRequest('PUT', `/api/sessions/${sessionId}/variables/${STATE_VAR}`, { value: state });
}

function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : null, obj);
}

function setByPath(obj, path, value) {
  if (!path) return value;  // replace root
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

(async () => {
  if (!sessionId) {
    console.log(JSON.stringify({ success: false, error: 'No sessionId provided. Set MAESTRO_SESSION_ID or pass sessionId input.', value: null, previousState: null }));
    process.exit(0);
  }

  if (!operation) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: operation', value: null, previousState: null }));
    process.exit(0);
  }

  try {
    const state = await getState();
    const previousState = JSON.stringify(state);

    let parsedValue;
    try {
      parsedValue = rawValue ? JSON.parse(rawValue) : rawValue;
    } catch {
      parsedValue = rawValue;
    }

    switch (operation) {
      case 'get': {
        const result = getByPath(state, dotPath);
        console.log(JSON.stringify({ success: true, value: JSON.stringify(result), previousState }));
        break;
      }

      case 'set': {
        const updated = setByPath(state, dotPath, parsedValue);
        await setState(updated);
        console.log(JSON.stringify({ success: true, value: JSON.stringify(parsedValue), previousState }));
        break;
      }

      case 'transition': {
        if (!phase) throw new Error('transition requires phase input');
        state.previousPhase = state.currentPhase;
        state.currentPhase = phase;
        state.history = state.history || [];
        state.history.push({ from: state.previousPhase, to: phase, time: new Date().toISOString() });
        await setState(state);
        console.log(JSON.stringify({ success: true, value: phase, previousState }));
        break;
      }

      case 'pause': {
        state.status = 'paused';
        state.pausedAt = new Date().toISOString();
        await setState(state);
        console.log(JSON.stringify({ success: true, value: 'paused', previousState }));
        break;
      }

      case 'resume': {
        state.status = 'running';
        state.resumedAt = new Date().toISOString();
        await setState(state);
        console.log(JSON.stringify({ success: true, value: 'running', previousState }));
        break;
      }

      case 'rewind': {
        if (!phase) throw new Error('rewind requires phase input');
        state.currentPhase = phase;
        state.status = 'running';
        // Clear results from the rewound phase onwards
        state.rewoundTo = phase;
        state.rewoundAt = new Date().toISOString();
        state.history = state.history || [];
        state.history.push({ action: 'rewind', to: phase, time: new Date().toISOString() });
        await setState(state);
        console.log(JSON.stringify({ success: true, value: phase, previousState }));
        break;
      }

      case 'inject': {
        if (!dotPath) throw new Error('inject requires path input');
        const updated2 = setByPath(state, dotPath, parsedValue);
        updated2.userOverrides = updated2.userOverrides || {};
        updated2.userOverrides[dotPath] = parsedValue;
        await setState(updated2);
        console.log(JSON.stringify({ success: true, value: JSON.stringify(parsedValue), previousState }));
        break;
      }

      default:
        console.log(JSON.stringify({ success: false, error: `Unknown operation: ${operation}`, value: null, previousState }));
    }
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, value: null, previousState: null }));
  }
})();
