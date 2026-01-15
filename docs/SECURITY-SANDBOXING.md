# Security & Sandboxing Documentation

## Overview

This document describes the security model and sandboxing capabilities of the Maestro workflow execution engine, with particular focus on the `ToolBlockExecutor` which executes arbitrary scripts.

> ⚠️ **CRITICAL WARNING**: The current sandboxing implementation is **NOT PRODUCTION-READY** for executing untrusted code. It provides only basic isolation for development and testing purposes.

## Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Working Directory Isolation | ✅ Implemented | Temporary directories created per execution |
| Process Timeout | ✅ Implemented | Configurable via `timeoutMs` |
| Output Size Limits | ✅ Implemented | Configurable via `maxOutputBytes` |
| Network Restriction | ⚠️ Best-Effort Only | Uses proxy env vars, **easily bypassed** |
| Filesystem Restriction | ❌ Not Implemented | Process has full filesystem access |
| Process Privilege Restriction | ❌ Not Implemented | Runs with executor's privileges |
| Container Isolation | ❌ Not Implemented | No Docker/container support |
| System Call Filtering | ❌ Not Implemented | No seccomp/AppArmor |

## ToolBlockExecutor Sandboxing Details

### Working Directory Sandbox

When `enableSandbox: true` is set in the block configuration:

```json
{
  "config": {
    "enableSandbox": true,
    "script": "process-data.ps1"
  }
}
```

The executor:
1. Creates a temporary directory: `{TempPath}/maestro_tool_sandbox/{GUID}`
2. Copies the script file into this directory
3. Executes the script with this as the working directory
4. Cleans up the directory after execution

**Limitations**:
- The process can still access any path on the filesystem
- The process runs with the same user permissions as Maestro
- No chroot or namespace isolation

### Timeout Protection

```json
{
  "config": {
    "timeoutMs": 30000
  }
}
```

- Default: 30 seconds
- Process is killed after timeout
- Prevents runaway scripts from consuming resources indefinitely

### Output Size Limits

```json
{
  "config": {
    "maxOutputBytes": 204800
  }
}
```

- Default: 200KB
- Prevents memory exhaustion from verbose scripts
- Output is truncated with `--output-truncated--` marker

### Network "Restriction" (Best-Effort Only)

```json
{
  "config": {
    "disableNetwork": true
  }
}
```

When enabled, the executor sets environment variables:
- `HTTP_PROXY=127.0.0.1:0`
- `HTTPS_PROXY=127.0.0.1:0`
- `NODE_OPTIONS=--no-experimental-fetch` (for Node.js)

**⚠️ CRITICAL LIMITATIONS**:
- This is trivially bypassed by any code that doesn't respect proxy settings
- Direct socket connections are not blocked
- DNS resolution is not blocked
- Subprocess spawning with different env vars bypasses this
- This provides NO real security, only a hint to well-behaved code

## Recommended Production Hardening

For production deployment with untrusted code execution, implement one of these approaches:

### Option 1: Container Isolation (Recommended)

```csharp
// Example: Docker-based execution (not yet implemented)
public class ContainerizedToolExecutor : IBlockExecutor
{
    public async Task<BlockExecutionResult> ExecuteAsync(...)
    {
        // Create isolated container
        var containerId = await _docker.CreateContainer(new ContainerConfig
        {
            Image = "maestro-sandbox:latest",
            NetworkMode = "none",           // No network
            ReadonlyRootfs = true,          // Read-only filesystem
            Memory = 512 * 1024 * 1024,     // 512MB limit
            CpuPeriod = 100000,             // CPU throttling
            CpuQuota = 50000,               // 50% CPU max
            PidsLimit = 100,                // Limit processes
        });
        
        // Copy script and execute
        await _docker.CopyToContainer(containerId, scriptPath);
        var result = await _docker.ExecAsync(containerId, command);
        await _docker.RemoveContainer(containerId);
        
        return result;
    }
}
```

### Option 2: OS-Level Sandboxing

**Linux (seccomp + namespaces)**:
```bash
# Example: Using bubblewrap for sandboxing
bwrap \
  --unshare-net \           # No network
  --unshare-pid \           # Isolated PIDs
  --ro-bind /usr /usr \     # Read-only system dirs
  --tmpfs /tmp \            # Writable temp only
  --die-with-parent \       # Kill on parent exit
  --new-session \           # New session
  /path/to/script.sh
```

**Windows (Job Objects)**:
```csharp
// Example: Windows Job Object restrictions
[DllImport("kernel32.dll")]
static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

// Configure job limits
var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION
{
    BasicLimitInformation = new JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        LimitFlags = JOB_OBJECT_LIMIT_PROCESS_MEMORY |
                     JOB_OBJECT_LIMIT_JOB_MEMORY |
                     JOB_OBJECT_LIMIT_ACTIVE_PROCESS |
                     JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    },
    ProcessMemoryLimit = (UIntPtr)(256 * 1024 * 1024),  // 256MB
    JobMemoryLimit = (UIntPtr)(512 * 1024 * 1024),      // 512MB
};
```

### Option 3: WebAssembly Sandbox

For scripts that can be compiled to WASM:
```csharp
// Example: Wasmtime-based execution
public class WasmToolExecutor : IBlockExecutor
{
    private readonly Engine _engine;
    
    public async Task<BlockExecutionResult> ExecuteAsync(...)
    {
        using var store = new Store(_engine);
        using var linker = new Linker(_engine);
        
        // No WASI capabilities = no filesystem, no network
        // Only add what's explicitly needed
        linker.DefineWasi();
        
        var module = Module.FromFile(_engine, wasmPath);
        var instance = linker.Instantiate(store, module);
        
        // Execute with memory limits
        var result = instance.GetFunction("main").Invoke();
        return result;
    }
}
```

## Security Checklist for Production

Before deploying Maestro with tool execution in production:

- [ ] **Never run as root/Administrator**
- [ ] **Implement container isolation** for tool blocks
- [ ] **Use read-only filesystems** where possible
- [ ] **Disable network** at the OS/container level
- [ ] **Set memory limits** to prevent DoS
- [ ] **Set CPU limits** to prevent resource exhaustion
- [ ] **Limit process count** to prevent fork bombs
- [ ] **Audit all block definitions** before execution
- [ ] **Log all executions** for forensics
- [ ] **Use allowlists** for permitted scripts/tools
- [ ] **Implement request signing** for API calls
- [ ] **Regular security audits** of execution logs

## Risk Assessment

### Current Risk Level: HIGH

With the current implementation:

| Attack Vector | Risk | Mitigation Status |
|--------------|------|-------------------|
| Arbitrary Code Execution | HIGH | ❌ No mitigation |
| Filesystem Access | HIGH | ❌ No mitigation |
| Network Exfiltration | HIGH | ⚠️ Weak mitigation |
| Resource Exhaustion | MEDIUM | ✅ Timeout + output limits |
| Privilege Escalation | HIGH | ❌ No mitigation |
| Lateral Movement | HIGH | ❌ No mitigation |

### Acceptable Use Cases (Current Implementation)

✅ **Safe to use for**:
- Development and testing with trusted blocks
- Internal tools where all block definitions are reviewed
- Demonstrations and proof-of-concept workflows
- Air-gapped environments with no sensitive data

❌ **NOT safe to use for**:
- Executing user-submitted code
- Processing untrusted workflow definitions
- Production environments with sensitive data
- Multi-tenant deployments
- Internet-facing deployments

## Future Roadmap

### Phase 1: Immediate (v0.x)
- [ ] Add security warnings to logs when sandbox is disabled
- [ ] Document all limitations clearly (this document)
- [ ] Add `requiresSandbox` flag to block schema

### Phase 2: Short-term (v1.0)
- [ ] Implement Docker-based tool execution
- [ ] Add Windows Job Object process limits
- [ ] Implement script allowlist validation

### Phase 3: Long-term (v2.0)
- [ ] WebAssembly sandbox for supported runtimes
- [ ] Kubernetes-native pod-per-execution model
- [ ] Hardware security module (HSM) integration for secrets
- [ ] Formal security audit and penetration testing

## Configuration Reference

### Block Configuration Options

```json
{
  "type": "tool",
  "config": {
    "script": "script.ps1",           // Script content or path
    "scriptFile": "script.ps1",       // Script file relative to block path
    "runtime": "powershell",          // Runtime: powershell, pwsh, bash, node, python
    "timeoutMs": 30000,               // Execution timeout (default: 30s)
    "maxOutputBytes": 204800,         // Max output size (default: 200KB)
    "enableSandbox": true,            // Enable working dir isolation
    "disableNetwork": true,           // Best-effort network disable (NOT SECURE)
    "parseOutput": "json"             // Parse stdout as JSON
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MAESTRO_SANDBOX_ENABLED` | Set to `true` when sandbox is active |
| `MAESTRO_BLOCK_ID` | Current block ID |
| `MAESTRO_EXECUTION_ID` | Current execution context ID |

## Reporting Security Issues

If you discover a security vulnerability in Maestro:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to the maintainers privately
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if any)

## References

- [OWASP Code Injection Prevention](https://owasp.org/www-community/attacks/Code_Injection)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Linux Seccomp](https://man7.org/linux/man-pages/man2/seccomp.2.html)
- [Windows Job Objects](https://docs.microsoft.com/en-us/windows/win32/procthread/job-objects)
- [WebAssembly Security Model](https://webassembly.org/docs/security/)
