# Create Research Workspace Blocks
$baseUrl = "http://localhost:5000/api/blocks"

# Tool Blocks
$tools = @(
    @{
        name = "Fitness Calculator"
        blockType = "tool"
        description = "Calculates model fitness score using the Maestro formula"
        tags = @("fitness", "evaluation", "metrics")
        capabilities = @("fitness-calculation", "model-evaluation")
    },
    @{
        name = "Data Store"
        blockType = "tool"
        description = "Reads and writes JSON data files in the workspace data folder"
        tags = @("data", "json", "persistence")
        capabilities = @("storage", "persistence", "json-data")
    },
    @{
        name = "Metrics Collector"
        blockType = "tool"
        description = "Collects and aggregates metrics over time"
        tags = @("metrics", "aggregation", "history")
        capabilities = @("metrics", "aggregation")
    },
    @{
        name = "Leaderboard Manager"
        blockType = "tool"
        description = "Manages the fitness leaderboard rankings"
        tags = @("leaderboard", "ranking", "comparison")
        capabilities = @("ranking", "leaderboard")
    },
    @{
        name = "Checkpoint Manager"
        blockType = "tool"
        description = "Manages training checkpoints for recovery and comparison"
        tags = @("checkpoint", "recovery", "state")
        capabilities = @("checkpoint", "state-management")
    }
)

# Agent Blocks
$agents = @(
    @{
        name = "Experiment Manager"
        blockType = "agent"
        description = "Orchestrates training experiments using different strategies"
        tags = @("experiment", "manager", "orchestration")
        capabilities = @("experiment-lifecycle", "strategy-selection", "parallel-execution", "result-comparison")
    },
    @{
        name = "Researcher Agent"
        blockType = "agent"
        description = "Analyzes agent performance and identifies improvement opportunities"
        tags = @("research", "analysis", "planning")
        capabilities = @("performance-analysis", "opportunity-identification", "hypothesis-generation")
    },
    @{
        name = "Trainer Agent"
        blockType = "agent"
        description = "Executes training strategies and manages the training loop"
        tags = @("training", "execution", "strategy")
        capabilities = @("strategy-execution", "progress-monitoring", "early-stopping")
    },
    @{
        name = "Tester Agent"
        blockType = "agent"
        description = "Runs test suites and validates trained agent fitness"
        tags = @("testing", "validation", "quality")
        capabilities = @("test-execution", "fitness-validation", "regression-detection")
    },
    @{
        name = "Documenter Agent"
        blockType = "agent"
        description = "Generates documentation for trained agents"
        tags = @("documentation", "reporting", "changelog")
        capabilities = @("documentation-generation", "changelog-creation", "comparison-reporting")
    },
    @{
        name = "Publisher Agent"
        blockType = "agent"
        description = "Publishes approved agents to the catalog"
        tags = @("publishing", "catalog", "versioning")
        capabilities = @("version-management", "catalog-publishing", "notification")
    }
)

# Workflow Blocks
$workflows = @(
    @{
        name = "Research Team"
        blockType = "workflow"
        description = "Full research pipeline: analyze, train, test, document, publish"
        tags = @("research", "pipeline", "team")
        capabilities = @("orchestration", "multi-agent-coordination")
    },
    @{
        name = "Training Loop"
        blockType = "workflow"
        description = "Core training iteration loop with fitness tracking"
        tags = @("training", "loop", "iteration")
        capabilities = @("iteration", "fitness-tracking")
    },
    @{
        name = "Experiment Pipeline"
        blockType = "workflow"
        description = "Single experiment execution from start to finish"
        tags = @("experiment", "pipeline", "execution")
        capabilities = @("experiment-execution")
    },
    @{
        name = "RL Fitness Strategy"
        blockType = "workflow"
        description = "Reinforcement learning strategy using fitness as reward"
        tags = @("strategy", "reinforcement-learning", "fitness")
        capabilities = @("rl-training", "fitness-based-reward")
    },
    @{
        name = "SFT Strategy"
        blockType = "workflow"
        description = "Supervised fine-tuning strategy with fitness validation"
        tags = @("strategy", "supervised", "fine-tuning")
        capabilities = @("sft-training", "supervised-learning")
    }
)

$allBlocks = $tools + $agents + $workflows

foreach ($block in $allBlocks) {
    $body = $block | ConvertTo-Json -Depth 3
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -ContentType "application/json" -Body $body
        Write-Host "Created: $($response.id) ($($response.blockType))" -ForegroundColor Green
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg -match "already exists" -or $errorMsg -match "Conflict") {
            Write-Host "Skipped (exists): $($block.name)" -ForegroundColor Yellow
        } else {
            Write-Host "Error creating $($block.name): $errorMsg" -ForegroundColor Red
        }
    }
}

Write-Host "`nDone! Created blocks for Model Research workspace." -ForegroundColor Cyan
