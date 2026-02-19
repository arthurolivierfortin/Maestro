using Maestro.Application.Interfaces;
using Maestro.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Maestro.Api.Configuration;

/// <summary>
/// Phase 22: Recovers sessions stuck in "running" state after a server restart.
/// Transitions all Active sessions to Ended/Stopped since no workflows survive a restart.
/// </summary>
public class SessionRecoveryService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SessionRecoveryService> _logger;

    public SessionRecoveryService(
        IServiceProvider serviceProvider,
        ILogger<SessionRecoveryService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Session recovery: checking for zombie sessions...");

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IProjectSessionRepository>();

            // Find all sessions with "Running" status
            var runningSessions = await repository.GetAllAsync(
                status: SessionStatus.Running,
                ct: cancellationToken);

            var recovered = 0;
            foreach (var session in runningSessions)
            {
                try
                {
                    session.Stop();
                    await repository.SaveAsync(session, cancellationToken);
                    recovered++;

                    _logger.LogInformation(
                        "Session {SessionId} ({Name}) recovered: running → stopped (server restart)",
                        session.Id, session.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Failed to recover session {SessionId}, will retry on next restart",
                        session.Id);
                }
            }

            // Also check for "Idle" sessions that might have been interrupted
            var idleSessions = await repository.GetAllAsync(
                status: SessionStatus.Idle,
                ct: cancellationToken);

            // Idle sessions are fine — they're legitimately started but not executing
            // Just log them for visibility
            var idleCount = idleSessions.Count();
            if (idleCount > 0)
            {
                _logger.LogInformation("Session recovery: {IdleCount} idle sessions found (no action needed)", idleCount);
            }

            if (recovered > 0)
            {
                _logger.LogInformation("Session recovery: {Count} zombie sessions recovered (running → stopped)", recovered);
            }
            else
            {
                _logger.LogInformation("Session recovery: no zombie sessions found");
            }
        }
        catch (Exception ex)
        {
            // Don't prevent startup if recovery fails
            _logger.LogError(ex, "Session recovery failed, zombie sessions may persist");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
