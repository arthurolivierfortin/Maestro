# System Blocks

These blocks power Maestro's internal functionality. They are:

- **Visible**: You can see how they work
- **Clonable**: Copy them to customize
- **Overridable**: Your versions take priority

## Categories

### testing/

Blocks for testing and evaluating models and agents.

| Block | Type | Description |
|-------|------|-------------|
| `model-capability-tester` | tool | Complete model testing workflow |
| `run-model-tests` | command | Executes test suite via PowerShell |
| `analyze-test-results` | inference | LLM analysis of test results |

### documentation/

Blocks for generating documentation.

| Block | Type | Description |
|-------|------|-------------|
| (coming soon) | | |

## Override Pattern

To customize a system block:

1. **Clone**: Copy the block to your `blocks/tools/` folder
2. **Modify**: Change the configuration as needed
3. **Use**: Maestro will use your version instead

```
blocks/
├── system/testing/model-capability-tester.tool.block.json  (original)
└── tools/model-capability-tester.tool.block.json           (your override)
```

## Resolution Order

When Maestro looks for a block:

1. Check `blocks/tools/`, `blocks/agents/`, etc. (user blocks)
2. Check `blocks/system/` (system blocks)
3. First match wins

## Contributing

If you create a better version of a system block, consider contributing it back!
