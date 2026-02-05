using Microsoft.AspNetCore.Mvc;
using System.Runtime.InteropServices;
using System.Management;
using System.Diagnostics;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for system hardware information and model recommendations.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SystemController : ControllerBase
{
    private readonly ILogger<SystemController> _logger;

    public SystemController(ILogger<SystemController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Get system hardware specifications and model recommendations.
    /// </summary>
    [HttpGet("info")]
    public async Task<IActionResult> GetSystemInfo()
    {
        try
        {
            var specs = await GetHardwareSpecs();
            var recommendations = GetModelRecommendations(specs);

            return Ok(new
            {
                specs,
                recommendations
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get system information");
            return StatusCode(500, new { error = "Failed to detect system hardware" });
        }
    }

    private async Task<SystemSpecs> GetHardwareSpecs()
    {
        var specs = new SystemSpecs();

        // Get OS info
        specs.Os = new OsInfo
        {
            Name = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "Windows" :
                   RuntimeInformation.IsOSPlatform(OSPlatform.Linux) ? "Linux" :
                   RuntimeInformation.IsOSPlatform(OSPlatform.OSX) ? "macOS" : "Unknown",
            Version = Environment.OSVersion.Version.ToString(),
            Architecture = RuntimeInformation.OSArchitecture.ToString()
        };

        // Get CPU info
        specs.Cpu = await GetCpuInfo();

        // Get Memory info
        specs.Memory = GetMemoryInfo();

        // Get GPU info
        specs.Gpu = await GetGpuInfo();

        return specs;
    }

    private async Task<CpuInfo> GetCpuInfo()
    {
        var info = new CpuInfo
        {
            Name = "Unknown CPU",
            Cores = Environment.ProcessorCount,
            Threads = Environment.ProcessorCount,
            Frequency = "Unknown"
        };

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor");
                foreach (var obj in searcher.Get())
                {
                    info.Name = obj["Name"]?.ToString()?.Trim() ?? "Unknown CPU";
                    info.Cores = Convert.ToInt32(obj["NumberOfCores"] ?? Environment.ProcessorCount);
                    info.Threads = Convert.ToInt32(obj["NumberOfLogicalProcessors"] ?? Environment.ProcessorCount);
                    var mhz = Convert.ToInt32(obj["MaxClockSpeed"] ?? 0);
                    info.Frequency = mhz > 0 ? $"{mhz / 1000.0:F1} GHz" : "Unknown";
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get CPU info via WMI");
            }
        }

        return info;
    }

    private MemoryInfo GetMemoryInfo()
    {
        var info = new MemoryInfo
        {
            Total = 0,
            Available = 0,
            Type = "Unknown"
        };

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem");
                foreach (var obj in searcher.Get())
                {
                    var totalKb = Convert.ToInt64(obj["TotalVisibleMemorySize"] ?? 0);
                    var freeKb = Convert.ToInt64(obj["FreePhysicalMemory"] ?? 0);
                    info.Total = (int)(totalKb / 1024 / 1024); // Convert to GB
                    info.Available = (int)(freeKb / 1024 / 1024); // Convert to GB
                    break;
                }

                // Get memory type
                using var memSearcher = new ManagementObjectSearcher("SELECT SMBIOSMemoryType FROM Win32_PhysicalMemory");
                foreach (var obj in memSearcher.Get())
                {
                    var memType = Convert.ToInt32(obj["SMBIOSMemoryType"] ?? 0);
                    info.Type = memType switch
                    {
                        20 => "DDR",
                        21 => "DDR2",
                        22 => "DDR2 FB-DIMM",
                        24 => "DDR3",
                        26 => "DDR4",
                        34 => "DDR5",
                        _ => "DDR4" // Default assumption
                    };
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get memory info via WMI");
            }
        }

        return info;
    }

    private async Task<List<GpuInfo>> GetGpuInfo()
    {
        var gpus = new List<GpuInfo>();

        // First try nvidia-smi for accurate NVIDIA GPU info
        var nvidiaGpus = await GetNvidiaGpuInfo();
        if (nvidiaGpus.Count > 0)
        {
            gpus.AddRange(nvidiaGpus);
        }

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT Name, AdapterRAM FROM Win32_VideoController");
                foreach (var obj in searcher.Get())
                {
                    var name = obj["Name"]?.ToString() ?? "Unknown GPU";
                    var vramBytes = Convert.ToInt64(obj["AdapterRAM"] ?? 0);

                    // Skip Microsoft Basic Display Adapter and similar
                    if (name.Contains("Microsoft") || name.Contains("Basic"))
                        continue;

                    // Skip NVIDIA GPUs - we already got them from nvidia-smi
                    if (name.Contains("NVIDIA", StringComparison.OrdinalIgnoreCase) && nvidiaGpus.Count > 0)
                        continue;

                    var gpu = new GpuInfo
                    {
                        Name = name,
                        Vram = (int)(vramBytes / 1024 / 1024 / 1024), // Convert to GB
                        CudaVersion = null
                    };

                    gpus.Add(gpu);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get GPU info via WMI");
            }
        }

        return gpus;
    }

    private async Task<List<GpuInfo>> GetNvidiaGpuInfo()
    {
        var gpus = new List<GpuInfo>();

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "nvidia-smi",
                Arguments = "--query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            if (process != null)
            {
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
                {
                    var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        var parts = line.Split(',').Select(p => p.Trim()).ToArray();
                        if (parts.Length >= 3)
                        {
                            var name = parts[0];
                            var vramMb = int.TryParse(parts[1], out var mb) ? mb : 0;
                            var driverVersion = parts[2];

                            gpus.Add(new GpuInfo
                            {
                                Name = name,
                                Vram = (int)Math.Ceiling(vramMb / 1024.0), // Convert MB to GB
                                CudaVersion = !string.IsNullOrEmpty(driverVersion) ? "Available" : null
                            });
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "nvidia-smi not available or failed");
        }

        return gpus;
    }

    private List<ModelRecommendation> GetModelRecommendations(SystemSpecs specs)
    {
        var recommendations = new List<ModelRecommendation>();
        var hasGpu = specs.Gpu.Any();
        var maxVram = specs.Gpu.Any() ? specs.Gpu.Max(g => g.Vram) : 0;
        var totalRam = specs.Memory.Total;

        // Cloud models - always recommended
        recommendations.Add(new ModelRecommendation
        {
            ModelName = "Claude 3.5 Sonnet",
            ModelId = "claude-3.5-sonnet",
            Provider = "anthropic",
            Reason = "Cloud-based, no hardware requirements",
            CanRun = true,
            RunOn = "cpu"
        });

        recommendations.Add(new ModelRecommendation
        {
            ModelName = "GPT-4o",
            ModelId = "gpt-4o",
            Provider = "openai",
            Reason = "Cloud-based, no hardware requirements",
            CanRun = true,
            RunOn = "cpu"
        });

        // Local models based on hardware
        if (totalRam >= 8)
        {
            recommendations.Add(new ModelRecommendation
            {
                ModelName = "Llama 3.2 3B",
                ModelId = "llama-3.2-3b",
                Provider = "ollama",
                Reason = $"Runs on CPU with {totalRam}GB RAM",
                CanRun = true,
                RunOn = "cpu"
            });
        }

        if (hasGpu && maxVram >= 4)
        {
            recommendations.Add(new ModelRecommendation
            {
                ModelName = "Llama 3.1 8B",
                ModelId = "llama-3.1-8b",
                Provider = "ollama",
                Reason = $"Good performance with {maxVram}GB VRAM",
                CanRun = maxVram >= 6,
                RunOn = "gpu"
            });
        }

        if (hasGpu && maxVram >= 6)
        {
            recommendations.Add(new ModelRecommendation
            {
                ModelName = "CodeLlama 7B",
                ModelId = "codellama-7b",
                Provider = "ollama",
                Reason = "Optimized for code, fits in GPU memory",
                CanRun = true,
                RunOn = "gpu"
            });
        }

        if (hasGpu)
        {
            recommendations.Add(new ModelRecommendation
            {
                ModelName = "Mixtral 8x7B",
                ModelId = "mixtral-8x7b",
                Provider = "ollama",
                Reason = maxVram >= 26
                    ? "MoE model with excellent performance"
                    : $"Requires ~26GB VRAM (you have {maxVram}GB)",
                CanRun = maxVram >= 26,
                RunOn = "gpu"
            });
        }

        return recommendations;
    }
}

#region DTOs

public class SystemSpecs
{
    public CpuInfo Cpu { get; set; } = new();
    public MemoryInfo Memory { get; set; } = new();
    public List<GpuInfo> Gpu { get; set; } = new();
    public OsInfo Os { get; set; } = new();
}

public class CpuInfo
{
    public string Name { get; set; } = "";
    public int Cores { get; set; }
    public int Threads { get; set; }
    public string Frequency { get; set; } = "";
}

public class MemoryInfo
{
    public int Total { get; set; }
    public int Available { get; set; }
    public string Type { get; set; } = "";
}

public class GpuInfo
{
    public string Name { get; set; } = "";
    public int Vram { get; set; }
    public string? CudaVersion { get; set; }
}

public class OsInfo
{
    public string Name { get; set; } = "";
    public string Version { get; set; } = "";
    public string Architecture { get; set; } = "";
}

public class ModelRecommendation
{
    public string ModelName { get; set; } = "";
    public string ModelId { get; set; } = "";
    public string Provider { get; set; } = "";
    public string Reason { get; set; } = "";
    public bool CanRun { get; set; }
    public string RunOn { get; set; } = "";
}

#endregion
