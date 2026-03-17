using FluentAssertions;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Application.Options;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using LLMProvider.Infrastructure.Providers;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace LLMProvider.Infrastructure.Tests.Providers;

public class LLMProviderFactoryTests : IDisposable
{
    private readonly string _priorityFilePath;

    public LLMProviderFactoryTests()
    {
        // Clean up any persisted priority file before each test
        _priorityFilePath = Path.Combine(AppContext.BaseDirectory, "provider-priority.json");
        if (File.Exists(_priorityFilePath))
        {
            File.Delete(_priorityFilePath);
        }
    }

    public void Dispose()
    {
        // Clean up after each test
        if (File.Exists(_priorityFilePath))
        {
            File.Delete(_priorityFilePath);
        }
    }

    private static ILLMProvider CreateMockProvider(
        ProviderType type,
        string name,
        bool isAvailable,
        params string[] modelIds)
    {
        var provider = Substitute.For<ILLMProvider>();
        provider.ProviderType.Returns(type);
        provider.Name.Returns(name);
        provider.IsAvailableAsync(Arg.Any<CancellationToken>()).Returns(isAvailable);

        var models = modelIds.Select(id => new ModelInfo(
            new ModelId(id),
            id,
            type,
            200000
        )).ToList().AsReadOnly();

        provider.GetAvailableModelsAsync(Arg.Any<CancellationToken>()).Returns(models);
        return provider;
    }

    private static LLMProviderFactory CreateFactory(
        IEnumerable<ILLMProvider> providers,
        Dictionary<string, string>? preferences = null)
    {
        var options = new ProviderPriorityOptions();
        if (preferences != null)
        {
            foreach (var (key, value) in preferences)
            {
                options.ModelPreferences[key] = value;
            }
        }

        return new LLMProviderFactory(
            providers,
            Options.Create(options),
            NullLogger<LLMProviderFactory>.Instance);
    }

    [Fact]
    public async Task DetectModelConflictsAsync_FindsConflicts_WhenTwoProvidersSupportSameModel()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6", "claude-opus-4-6");
        var claudeCode = CreateMockProvider(
            ProviderType.ClaudeCode, "Claude Code", true,
            "claude-sonnet-4-6", "claude-haiku-4-5-20251001");

        var factory = CreateFactory(new[] { anthropic, claudeCode });

        // Act
        var conflicts = await factory.DetectModelConflictsAsync();

        // Assert
        conflicts.Should().HaveCount(1);
        conflicts[0].ModelId.Should().Be("claude-sonnet-4-6");
        conflicts[0].Providers.Should().Contain(ProviderType.Anthropic);
        conflicts[0].Providers.Should().Contain(ProviderType.ClaudeCode);
        conflicts[0].Preferred.Should().BeNull();
    }

    [Fact]
    public async Task DetectModelConflictsAsync_ReturnsEmpty_WhenNoConflicts()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var azure = CreateMockProvider(
            ProviderType.Azure, "Azure", true,
            "gpt-4o");

        var factory = CreateFactory(new[] { anthropic, azure });

        // Act
        var conflicts = await factory.DetectModelConflictsAsync();

        // Assert
        conflicts.Should().BeEmpty();
    }

    [Fact]
    public async Task DetectModelConflictsAsync_SkipsUnavailableProviders()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var claudeCode = CreateMockProvider(
            ProviderType.ClaudeCode, "Claude Code", false, // unavailable
            "claude-sonnet-4-6");

        var factory = CreateFactory(new[] { anthropic, claudeCode });

        // Act
        var conflicts = await factory.DetectModelConflictsAsync();

        // Assert — no conflict because ClaudeCode is unavailable
        conflicts.Should().BeEmpty();
    }

    [Fact]
    public async Task DetectModelConflictsAsync_ShowsPreference_WhenConfigured()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var claudeCode = CreateMockProvider(
            ProviderType.ClaudeCode, "Claude Code", true,
            "claude-sonnet-4-6");

        var factory = CreateFactory(
            new[] { anthropic, claudeCode },
            new Dictionary<string, string> { ["claude-sonnet-4-6"] = "Anthropic" });

        // Act
        var conflicts = await factory.DetectModelConflictsAsync();

        // Assert
        conflicts.Should().HaveCount(1);
        conflicts[0].Preferred.Should().Be(ProviderType.Anthropic);
    }

    [Fact]
    public async Task GetProviderForModelAsync_UsesConfiguredPriority()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var claudeCode = CreateMockProvider(
            ProviderType.ClaudeCode, "Claude Code", true,
            "claude-sonnet-4-6");

        // ClaudeCode registered first, but Anthropic is preferred
        var factory = CreateFactory(
            new[] { claudeCode, anthropic },
            new Dictionary<string, string> { ["claude-sonnet-4-6"] = "Anthropic" });

        // Act
        var provider = await factory.GetProviderForModelAsync(new ModelId("claude-sonnet-4-6"));

        // Assert
        provider.ProviderType.Should().Be(ProviderType.Anthropic);
    }

    [Fact]
    public async Task GetProviderForModelAsync_FallsBack_WhenPreferredProviderUnavailable()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", false, // unavailable
            "claude-sonnet-4-6");
        var claudeCode = CreateMockProvider(
            ProviderType.ClaudeCode, "Claude Code", true,
            "claude-sonnet-4-6");

        // Anthropic is preferred but unavailable
        var factory = CreateFactory(
            new[] { claudeCode, anthropic },
            new Dictionary<string, string> { ["claude-sonnet-4-6"] = "Anthropic" });

        // Act
        var provider = await factory.GetProviderForModelAsync(new ModelId("claude-sonnet-4-6"));

        // Assert — falls back to ClaudeCode
        provider.ProviderType.Should().Be(ProviderType.ClaudeCode);
    }

    [Fact]
    public async Task GetProviderForModelAsync_ReturnsFirst_WhenNoPriorityConfigured()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var claudeCode = CreateMockProvider(
            ProviderType.ClaudeCode, "Claude Code", true,
            "claude-sonnet-4-6");

        // No preference set — should return first registered
        var factory = CreateFactory(new[] { anthropic, claudeCode });

        // Act
        var provider = await factory.GetProviderForModelAsync(new ModelId("claude-sonnet-4-6"));

        // Assert — first registered (Anthropic) wins
        provider.ProviderType.Should().Be(ProviderType.Anthropic);
    }

    [Fact]
    public async Task GetProviderForModelAsync_ThrowsWhenNoProviderSupportsModel()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");

        var factory = CreateFactory(new[] { anthropic });

        // Act & Assert
        var act = () => factory.GetProviderForModelAsync(new ModelId("nonexistent-model"));
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public void SetModelPreference_DoesNotThrow()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var factory = CreateFactory(new[] { anthropic });

        // Act & Assert — just verify it doesn't throw
        var act = () => factory.SetModelPreference("claude-sonnet-4-6", ProviderType.Anthropic);
        act.Should().NotThrow();
    }

    [Fact]
    public async Task SetModelPreference_AffectsSubsequentGetProviderCalls()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var claudeCode = CreateMockProvider(
            ProviderType.ClaudeCode, "Claude Code", true,
            "claude-sonnet-4-6");

        // ClaudeCode registered first, no initial preference
        var factory = CreateFactory(new[] { claudeCode, anthropic });

        // Initially returns first registered (ClaudeCode)
        var initial = await factory.GetProviderForModelAsync(new ModelId("claude-sonnet-4-6"));
        initial.ProviderType.Should().Be(ProviderType.ClaudeCode);

        // Act — set preference at runtime
        factory.SetModelPreference("claude-sonnet-4-6", ProviderType.Anthropic);

        // Assert — now uses the preference
        var after = await factory.GetProviderForModelAsync(new ModelId("claude-sonnet-4-6"));
        after.ProviderType.Should().Be(ProviderType.Anthropic);
    }

    [Fact]
    public void SetModelPreference_PersistsToFile()
    {
        // Arrange
        var anthropic = CreateMockProvider(
            ProviderType.Anthropic, "Anthropic", true,
            "claude-sonnet-4-6");
        var factory = CreateFactory(new[] { anthropic });

        // Act
        factory.SetModelPreference("claude-sonnet-4-6", ProviderType.Anthropic);

        // Assert — file was written
        File.Exists(_priorityFilePath).Should().BeTrue();
        var content = File.ReadAllText(_priorityFilePath);
        content.Should().Contain("claude-sonnet-4-6");
        content.Should().Contain("Anthropic");
    }
}
