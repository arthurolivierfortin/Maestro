# Maestro Pipeline Test Plan Template

## Overview

This document serves as a template for testing the complete Maestro pipeline. It is designed to be executed step-by-step by a tester (referred to as "Authority") who will validate each feature manually using the CLI.

**Important Notes:**
- All tests must be executed via CLI or API calls - NO mocks
- Each step should be documented with actual results
- This template should be copied and filled out for each test session
- Replace `{PROJECT_PATH}` with the actual path to your test repository
- Replace `{PROJECT_NAME}` with your project name

---

## Test Session Information

| Field | Value |
|-------|-------|
| **Test Date** | |
| **Tester (Authority)** | |
| **Repository Path** | |
| **Backend URL** | http://localhost:5000 |
| **LLM-Provider URL** | http://localhost:8000 |
| **Frontend URL** | http://localhost:5173 |

---

## Pre-Test Checklist

- [ ] Backend service is running (`http://localhost:5000/health`)
- [ ] LLM-Provider service is running (`http://localhost:8000/health`)
- [ ] Test repository exists and is accessible
- [ ] CLI tool is available (`node C:\Meastro\tools\maestro-cli\index.js --help`)

---

## Phase 1: Service Health Verification

### Test 1.1: Check Services Health

**Objective:** Verify all Maestro services are running and healthy.

| Item | Value |
|------|-------|
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js health` |
| **Expected Response** | All services show "healthy" status |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 1.2: Check LLM Status

**Objective:** Verify LLM-Provider is accessible and has models loaded.

| Item | Value |
|------|-------|
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js llm` |
| **Expected Response** | LLM-Provider status with available models |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 2: Block Management

### Test 2.1: List All Blocks

**Objective:** Verify the system can list all available blocks.

| Item | Value |
|------|-------|
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js list-blocks` |
| **Expected Response** | List of blocks with IDs, names, and types |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 2.2: Get Block Details

**Objective:** Verify block details can be retrieved.

| Item | Value |
|------|-------|
| **Block ID to Test** | (use any block ID from 2.1) |
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js get-block {BLOCK_ID}` |
| **Expected Response** | Block details with config, inputs, outputs |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 2.3: Execute a Simple Block

**Objective:** Verify block execution works.

| Item | Value |
|------|-------|
| **Block ID to Test** | (use a simple tool block like `directory-list`) |
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js execute {BLOCK_ID} --input path="{PROJECT_PATH}"` |
| **Expected Response** | Block execution result with outputs |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 3: Agent Creation

### Test 3.1: Create Agent Block via API

**Objective:** Create a new agent block for the test project.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/blocks` |
| **Request Body** | See below |
| **Expected Response** | 201 Created with agent block details |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

**Request Body:**
```json
{
  "name": "test-agent",
  "blockType": "agent",
  "description": "Test agent for pipeline validation",
  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxTokens": 512,
    "maxSteps": 5,
    "tools": ["file-read", "file-write", "directory-list", "shell-execute"]
  },
  "inputs": [
    { "name": "task", "type": "string", "required": true },
    { "name": "workingDir", "type": "string", "required": false }
  ],
  "outputs": [
    { "name": "result", "type": "string" },
    { "name": "content", "type": "string" }
  ]
}
```

**CLI Alternative:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{"name":"test-agent","blockType":"agent","description":"Test agent","config":{"model":"deepseek-ai/deepseek-coder-1.3b-instruct","maxTokens":512,"maxSteps":5,"tools":["file-read","file-write","directory-list"]}}'
```

### Test 3.2: Verify Agent Block Created

**Objective:** Confirm the agent appears in the block list.

| Item | Value |
|------|-------|
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js list-blocks --type agent` |
| **Expected Response** | List includes the newly created agent |
| **Actual Response** | |
| **Agent ID** | (record for later use) |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 4: Agent Execution

### Test 4.1: Execute Agent (Simple Task)

**Objective:** Execute the agent with a simple task.

| Item | Value |
|------|-------|
| **Agent ID** | (from Test 3.2) |
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js execute {AGENT_ID} --input task="List the files in the current directory" --input workingDir="{PROJECT_PATH}"` |
| **Expected Response** | Agent execution with tool calls and final result |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 4.2: Execute Agent (File Reading Task)

**Objective:** Verify agent can read files.

| Item | Value |
|------|-------|
| **Agent ID** | (from Test 3.2) |
| **CLI Command** | `node C:\Meastro\tools\maestro-cli\index.js execute {AGENT_ID} --input task="Read the README.md file and summarize it" --input workingDir="{PROJECT_PATH}"` |
| **Expected Response** | Agent reads file and provides summary |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 5: Block Testing API

### Test 5.1: Create Block Test Case

**Objective:** Create a test case for the agent block.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/block-tests` |
| **Request Body** | See below |
| **Expected Response** | 201 Created with test case ID |
| **Actual Response** | |
| **Test Case ID** | (record for later use) |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

**Request Body:**
```json
{
  "blockId": "{AGENT_ID}",
  "name": "Basic file listing test",
  "description": "Verify agent can list files",
  "inputs": {
    "task": "List all files in the current directory",
    "workingDir": "{PROJECT_PATH}"
  },
  "expectedOutputs": {
    "result": "Files listed successfully"
  },
  "tags": ["smoke-test", "file-operations"]
}
```

### Test 5.2: Run Block Test

**Objective:** Execute the test case and verify results.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/block-tests/{TEST_CASE_ID}/run` |
| **Expected Response** | Test run result with pass/fail status |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 5.3: List Test Results

**Objective:** Retrieve test run history.

| Item | Value |
|------|-------|
| **API Endpoint** | `GET http://localhost:5000/api/block-tests/{TEST_CASE_ID}/runs` |
| **Expected Response** | List of test runs with results |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 6: Training Configuration

### Test 6.1: Create Training Configuration

**Objective:** Set up training configuration for the agent.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/training/configurations` |
| **Request Body** | See below |
| **Expected Response** | 201 Created with configuration ID |
| **Actual Response** | |
| **Config ID** | (record for later use) |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

**Request Body:**
```json
{
  "name": "Test Agent Training Config",
  "description": "Training configuration for pipeline validation",
  "workflowId": "{AGENT_ID}",
  "iterations": 3,
  "parallelIterations": 1,
  "optimizationGoal": "quality",
  "qualityEvaluation": {
    "method": "heuristic",
    "criteria": [
      { "name": "completion", "weight": 0.5 },
      { "name": "accuracy", "weight": 0.5 }
    ],
    "minScore": 60
  },
  "inputVariation": {
    "type": "fixed",
    "fixedInputs": {
      "task": "List files in the directory",
      "workingDir": "{PROJECT_PATH}"
    }
  },
  "tags": ["test", "validation"]
}
```

### Test 6.2: List Training Configurations

**Objective:** Verify configuration is listed.

| Item | Value |
|------|-------|
| **API Endpoint** | `GET http://localhost:5000/api/training/configurations` |
| **Expected Response** | List includes the new configuration |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 7: Training Execution

### Test 7.1: Start Training Run

**Objective:** Execute a training run.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/training/configurations/{CONFIG_ID}/runs` |
| **Request Body** | `{"name": "Test Run 1", "initiatedBy": "tester"}` |
| **Expected Response** | 201 Created with run ID |
| **Actual Response** | |
| **Run ID** | (record for later use) |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 7.2: Monitor Training Run

**Objective:** Check training run progress.

| Item | Value |
|------|-------|
| **API Endpoint** | `GET http://localhost:5000/api/training/runs/{RUN_ID}` |
| **Expected Response** | Run status with iteration details |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

**Polling Note:** The training run executes asynchronously. Poll this endpoint every 5 seconds until status is "Completed" or "Failed".

### Test 7.3: Verify Training Iterations

**Objective:** Confirm iterations executed successfully.

| Item | Value |
|------|-------|
| **API Endpoint** | `GET http://localhost:5000/api/training/runs/{RUN_ID}` |
| **Expected Response** | Run with iterations array populated |
| **Actual Response** | |
| **Iterations Completed** | |
| **Iterations Succeeded** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 8: Metrics Verification

### Test 8.1: List Execution Metrics

**Objective:** Verify metrics are being collected.

| Item | Value |
|------|-------|
| **API Endpoint** | `GET http://localhost:5000/api/metrics/executions` |
| **Expected Response** | List of execution metrics |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 8.2: Get Aggregated Metrics

**Objective:** Retrieve aggregated metrics for the workflow.

| Item | Value |
|------|-------|
| **API Endpoint** | `GET http://localhost:5000/api/metrics/aggregate?workflowId={AGENT_ID}` |
| **Expected Response** | Aggregated metrics (total executions, avg cost, etc.) |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 8.3: Get Training Run Metrics

**Objective:** Retrieve metrics specific to the training run.

| Item | Value |
|------|-------|
| **API Endpoint** | `GET http://localhost:5000/api/metrics/runs/{TRAINING_RUN_ID}` |
| **Expected Response** | Metrics for all iterations in the run |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 9: Project Sessions (Optional)

### Test 9.1: Create Project Session

**Objective:** Create an interactive project session.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/sessions` |
| **Request Body** | See below |
| **Expected Response** | 201 Created with session ID |
| **Actual Response** | |
| **Session ID** | (record for later use) |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

**Request Body:**
```json
{
  "name": "Test Session",
  "authority": "human",
  "config": {
    "projectId": "{PROJECT_ID}",
    "access": { "level": "full" }
  }
}
```

### Test 9.2: Start Session

**Objective:** Start the project session.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/sessions/{SESSION_ID}/start` |
| **Expected Response** | Session status changed to "Running" |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 9.3: Execute Command in Session

**Objective:** Execute a command within the session.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/sessions/{SESSION_ID}/commands` |
| **Request Body** | `{"command": "status"}` |
| **Expected Response** | Command execution result |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 9.4: Stop Session

**Objective:** Properly stop the session.

| Item | Value |
|------|-------|
| **API Endpoint** | `POST http://localhost:5000/api/sessions/{SESSION_ID}/stop` |
| **Expected Response** | Session status changed to "Stopped" |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Phase 10: Cleanup (Optional)

### Test 10.1: Delete Training Run

| Item | Value |
|------|-------|
| **API Endpoint** | `DELETE http://localhost:5000/api/training/runs/{RUN_ID}` |
| **Expected Response** | 200 OK or 204 No Content |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 10.2: Delete Training Configuration

| Item | Value |
|------|-------|
| **API Endpoint** | `DELETE http://localhost:5000/api/training/configurations/{CONFIG_ID}` |
| **Expected Response** | 204 No Content |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

### Test 10.3: Delete Agent Block

| Item | Value |
|------|-------|
| **API Endpoint** | `DELETE http://localhost:5000/api/blocks/{AGENT_ID}` |
| **Expected Response** | 204 No Content |
| **Actual Response** | |
| **Status** | [ ] Pass  [ ] Fail |
| **Notes/Issues** | |

---

## Test Summary

| Phase | Tests Passed | Tests Failed | Notes |
|-------|--------------|--------------|-------|
| Phase 1: Service Health | /2 | | |
| Phase 2: Block Management | /3 | | |
| Phase 3: Agent Creation | /2 | | |
| Phase 4: Agent Execution | /2 | | |
| Phase 5: Block Testing | /3 | | |
| Phase 6: Training Config | /2 | | |
| Phase 7: Training Execution | /3 | | |
| Phase 8: Metrics | /3 | | |
| Phase 9: Project Sessions | /4 | | |
| Phase 10: Cleanup | /3 | | |
| **TOTAL** | /27 | | |

---

## Issues Encountered

| Issue # | Phase | Test | Description | Severity | Resolution |
|---------|-------|------|-------------|----------|------------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## Recommendations

_Space for tester recommendations based on test results_

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Reviewer | | | |
