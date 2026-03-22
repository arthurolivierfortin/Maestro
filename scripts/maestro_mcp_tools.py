#!/usr/bin/env python3
"""MCP Server — exposes Maestro build/test/API tools to Claude Code agents.

Tools:
  maestro_health()              — Check backend + LLM provider health
  maestro_build(scope)          — dotnet build (backend, llm-provider, all)
  maestro_test(scope)           — dotnet test (unit, integration, all)
  maestro_tsc(package)          — TypeScript type check
  maestro_block_list()          — List blocks via API
  maestro_session_list()        — List sessions via API
  maestro_contract_test(id,block) — Run contract test via API
"""

import json
import subprocess
import sys
import urllib.request
import urllib.error
from pathlib import Path

# Try to import MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import TextContent, Tool
    HAS_MCP = True
except ImportError:
    HAS_MCP = False

import os

BACKEND_URL = os.environ.get("MAESTRO_API_URL", "http://localhost:5000")
LLM_URL = os.environ.get("LLM_PROVIDER_URL", "http://localhost:5010")
PROJECT_ROOT = Path(__file__).parent.parent


def _api_get(url: str, timeout: int = 10) -> dict | str:
    try:
        r = urllib.request.urlopen(url, timeout=timeout)
        data = r.read().decode()
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return data
    except Exception as e:
        return {"error": str(e)}


def _run(cmd: list[str], cwd: str, timeout: int = 120) -> dict:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
        return {
            "success": r.returncode == 0,
            "stdout": r.stdout[-1000:] if r.stdout else "",
            "stderr": r.stderr[-500:] if r.stderr else "",
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Timed out after {timeout}s"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def health() -> str:
    backend = _api_get(f"{BACKEND_URL}/")
    llm = _api_get(f"{LLM_URL}/api/v1/health/")
    return json.dumps({"backend": backend, "llm_provider": llm}, indent=2)


def build(scope: str = "all") -> str:
    backend_dir = str(PROJECT_ROOT / "apps" / "backend")
    llm_dir = str(PROJECT_ROOT / "llm-provider" / "dotnet")

    results = {}
    if scope in ("backend", "all"):
        results["backend"] = _run(["dotnet", "build", "--no-restore", "-v", "quiet"], backend_dir)
    if scope in ("llm-provider", "all"):
        results["llm-provider"] = _run(["dotnet", "build", "--no-restore", "-v", "quiet"], llm_dir)
    return json.dumps(results, indent=2)


def test(scope: str = "all") -> str:
    backend_dir = str(PROJECT_ROOT / "apps" / "backend")
    results = {}

    if scope in ("unit", "all"):
        results["unit"] = _run(
            ["dotnet", "test", "--no-build", "--filter", "FullyQualifiedName~Tests"],
            backend_dir, timeout=180)
    if scope in ("integration", "all"):
        results["integration"] = _run(
            ["dotnet", "test", "--no-build", "--filter", "FullyQualifiedName~Integration"],
            backend_dir, timeout=180)
    return json.dumps(results, indent=2)


def tsc(package: str = "maestro-code") -> str:
    pkg_dir = str(PROJECT_ROOT / "packages" / package)
    return json.dumps(_run(["npx", "tsc", "--noEmit"], pkg_dir), indent=2)


def block_list() -> str:
    return json.dumps(_api_get(f"{BACKEND_URL}/api/blocks"), indent=2)


def session_list() -> str:
    return json.dumps(_api_get(f"{BACKEND_URL}/api/sessions"), indent=2)


def contract_test(contract_id: str, block_id: str) -> str:
    try:
        url = f"{BACKEND_URL}/api/contracts/{contract_id}/test?blockId={block_id}"
        req = urllib.request.Request(url, method="POST", headers={"Content-Type": "application/json"})
        r = urllib.request.urlopen(req, timeout=600)
        return r.read().decode()
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── MCP Server ──
if HAS_MCP:
    server = Server("maestro-tools")

    @server.list_tools()
    async def list_tools():
        return [
            Tool(name="maestro_health", description="Check Maestro backend + LLM provider health",
                 inputSchema={"type": "object", "properties": {}}),
            Tool(name="maestro_build", description="Build Maestro (dotnet build)",
                 inputSchema={"type": "object", "properties": {
                     "scope": {"type": "string", "enum": ["backend", "llm-provider", "all"], "default": "all"}
                 }}),
            Tool(name="maestro_test", description="Run tests (dotnet test)",
                 inputSchema={"type": "object", "properties": {
                     "scope": {"type": "string", "enum": ["unit", "integration", "all"], "default": "all"}
                 }}),
            Tool(name="maestro_tsc", description="TypeScript type check",
                 inputSchema={"type": "object", "properties": {
                     "package": {"type": "string", "default": "maestro-code"}
                 }}),
            Tool(name="maestro_block_list", description="List all blocks via API",
                 inputSchema={"type": "object", "properties": {}}),
            Tool(name="maestro_session_list", description="List all sessions via API",
                 inputSchema={"type": "object", "properties": {}}),
            Tool(name="maestro_contract_test", description="Run contract test",
                 inputSchema={"type": "object", "properties": {
                     "contract_id": {"type": "string"}, "block_id": {"type": "string"}
                 }, "required": ["contract_id", "block_id"]}),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict):
        if name == "maestro_health":
            result = health()
        elif name == "maestro_build":
            result = build(arguments.get("scope", "all"))
        elif name == "maestro_test":
            result = test(arguments.get("scope", "all"))
        elif name == "maestro_tsc":
            result = tsc(arguments.get("package", "maestro-code"))
        elif name == "maestro_block_list":
            result = block_list()
        elif name == "maestro_session_list":
            result = session_list()
        elif name == "maestro_contract_test":
            result = contract_test(arguments["contract_id"], arguments["block_id"])
        else:
            result = json.dumps({"error": f"Unknown tool: {name}"})

        return [TextContent(type="text", text=result)]

    async def main():
        async with stdio_server() as (read, write):
            await server.run(read, write, server.create_initialization_options())

    if __name__ == "__main__":
        import asyncio
        asyncio.run(main())

else:
    # Fallback: CLI mode (no MCP SDK installed)
    if __name__ == "__main__":
        if len(sys.argv) < 2:
            print("Usage: maestro_mcp_tools.py <health|build|test|tsc|blocks|sessions|contract-test>")
            sys.exit(1)

        cmd = sys.argv[1]
        if cmd == "health":
            print(health())
        elif cmd == "build":
            print(build(sys.argv[2] if len(sys.argv) > 2 else "all"))
        elif cmd == "test":
            print(test(sys.argv[2] if len(sys.argv) > 2 else "all"))
        elif cmd == "tsc":
            print(tsc(sys.argv[2] if len(sys.argv) > 2 else "maestro-code"))
        elif cmd == "blocks":
            print(block_list())
        elif cmd == "sessions":
            print(session_list())
        elif cmd == "contract-test" and len(sys.argv) >= 4:
            print(contract_test(sys.argv[2], sys.argv[3]))
        else:
            print(f"Unknown command: {cmd}")
            sys.exit(1)
