using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;
using Microsoft.AspNetCore.SignalR.Client;
using System;

namespace Maestro.Infrastructure.Tests
{
    public class ExecutionMonitorIntegrationTests : IClassFixture<WebApplicationFactory<Maestro.Api.Program>>
    {
        private readonly WebApplicationFactory<Maestro.Api.Program> _factory;

        public ExecutionMonitorIntegrationTests(WebApplicationFactory<Maestro.Api.Program> factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task Monitor_PublishesExecutionStarted_ToSignalRClient()
        {
            var client = _factory.CreateDefaultClient();
            var baseAddress = new Uri(_factory.Server.BaseAddress, "/");

            var connection = new HubConnectionBuilder()
                .WithUrl(new Uri(_factory.Server.BaseAddress, "/hubs/execution").ToString(), options =>
                {
                    options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                })
                .Build();

            var tcs = new TaskCompletionSource<string>();
            connection.On<string>("ExecutionStarted", id => tcs.TrySetResult(id));

            await connection.StartAsync();

            // Resolve monitor from factory services and call publish
            var scope = _factory.Services.CreateScope();
            var monitor = scope.ServiceProvider.GetService(typeof(Maestro.Application.Interfaces.IExecutionMonitor)) as Maestro.Application.Interfaces.IExecutionMonitor;
            Assert.NotNull(monitor);

            var execId = Maestro.Domain.ValueObjects.ExecutionId.NewId();
            await monitor.PublishExecutionStartedAsync(execId);

            var received = await Task.WhenAny(tcs.Task, Task.Delay(5000));
            Assert.True(received == tcs.Task, "Timed out waiting for ExecutionStarted event");
            Assert.Equal(execId.Value, tcs.Task.Result);

            await connection.StopAsync();
        }
    }
}
