# .maestro Directory

This directory contains Maestro runtime configuration and artifacts.

## Structure

```
.maestro/
├── artifacts/          # User-defined artifacts
│   ├── scripts/       # Shell scripts, PowerShell, Python scripts
│   ├── tools/         # Custom executables
│   └── templates/     # Code templates
├── logs/              # Execution logs (auto-generated, git-ignored)
└── config.json        # Artifact detection configuration
```

## Artifacts

Maestro automatically scans this directory on startup and watches for changes.
Any scripts or tools placed here become available in workflow nodes.

## External Editor Integration

Edit files in this directory using your preferred editor (VS Code, Visual Studio, etc.).
Maestro will detect changes and automatically refresh the artifact index.

## Configuration

See `config.json` for artifact detection rules and validation settings.
