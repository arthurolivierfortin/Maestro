using FluentAssertions;
using LLMProvider.Application.Services;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging.Abstractions;

namespace LLMProvider.Application.Tests.Services;

public class TokenAccountingServiceTests
{
    private readonly TokenAccountingService _service;

    public TokenAccountingServiceTests()
    {
        _service = new TokenAccountingService(NullLogger<TokenAccountingService>.Instance);
    }

    [Fact]
    public void Track_UpdatesTotalUsage()
    {
        // Arrange
        var usage = new TokenUsage(100, 50);

        // Act
        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), usage);

        // Assert
        var total = _service.GetTotalUsage();
        total.PromptTokens.Should().Be(100);
        total.CompletionTokens.Should().Be(50);
        total.TotalTokens.Should().Be(150);
    }

    [Fact]
    public void Track_AccumulatesMultipleRequests()
    {
        // Arrange
        var usage1 = new TokenUsage(100, 50);
        var usage2 = new TokenUsage(200, 100);

        // Act
        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), usage1);
        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), usage2);

        // Assert
        var total = _service.GetTotalUsage();
        total.PromptTokens.Should().Be(300);
        total.CompletionTokens.Should().Be(150);
    }

    [Fact]
    public void GetUsageByProvider_ReturnsProviderSpecificUsage()
    {
        // Arrange
        var azureUsage = new TokenUsage(100, 50);
        var localUsage = new TokenUsage(200, 100);

        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), azureUsage);
        _service.Track(ProviderType.Local, new ModelId("distilgpt2"), localUsage);

        // Act
        var azureResult = _service.GetUsageByProvider(ProviderType.Azure);
        var localResult = _service.GetUsageByProvider(ProviderType.Local);

        // Assert
        azureResult.TotalTokens.Should().Be(150);
        localResult.TotalTokens.Should().Be(300);
    }

    [Fact]
    public void GetUsageByProvider_ReturnsZeroForUnusedProvider()
    {
        // Arrange
        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), new TokenUsage(100, 50));

        // Act
        var result = _service.GetUsageByProvider(ProviderType.Local);

        // Assert
        result.Should().Be(TokenUsage.Zero);
    }

    [Fact]
    public void GetUsageByModel_ReturnsModelSpecificUsage()
    {
        // Arrange
        var gpt4Usage = new TokenUsage(100, 50);
        var gpt4oUsage = new TokenUsage(200, 100);

        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), gpt4Usage);
        _service.Track(ProviderType.Azure, new ModelId("gpt-4o"), gpt4oUsage);

        // Act
        var gpt4Result = _service.GetUsageByModel(new ModelId("gpt-4"));
        var gpt4oResult = _service.GetUsageByModel(new ModelId("gpt-4o"));

        // Assert
        gpt4Result.TotalTokens.Should().Be(150);
        gpt4oResult.TotalTokens.Should().Be(300);
    }

    [Fact]
    public void GetUsageByConversation_ReturnsConversationSpecificUsage()
    {
        // Arrange
        var conversationId = ConversationId.New();
        var usage = new TokenUsage(100, 50);

        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), usage, conversationId);

        // Act
        var result = _service.GetUsageByConversation(conversationId);

        // Assert
        result.TotalTokens.Should().Be(150);
    }

    [Fact]
    public void Track_WithoutConversationId_DoesNotTrackByConversation()
    {
        // Arrange
        var usage = new TokenUsage(100, 50);
        var conversationId = ConversationId.New();

        // Act
        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), usage);

        // Assert
        var result = _service.GetUsageByConversation(conversationId);
        result.Should().Be(TokenUsage.Zero);
    }

    [Fact]
    public void GetSummary_ReturnsCompleteSummary()
    {
        // Arrange
        var conversationId = ConversationId.New();
        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), new TokenUsage(100, 50), conversationId);
        _service.Track(ProviderType.Local, new ModelId("distilgpt2"), new TokenUsage(200, 100));

        // Act
        var summary = _service.GetSummary();

        // Assert
        summary.TotalUsage.TotalTokens.Should().Be(450);
        summary.UsageByProvider.Should().HaveCount(2);
        summary.UsageByModel.Should().HaveCount(2);
        summary.ConversationCount.Should().Be(1);
    }

    [Fact]
    public void Reset_ClearsAllTracking()
    {
        // Arrange
        _service.Track(ProviderType.Azure, new ModelId("gpt-4"), new TokenUsage(100, 50));

        // Act
        _service.Reset();

        // Assert
        var total = _service.GetTotalUsage();
        total.Should().Be(TokenUsage.Zero);

        var summary = _service.GetSummary();
        summary.UsageByProvider.Should().BeEmpty();
        summary.UsageByModel.Should().BeEmpty();
        summary.ConversationCount.Should().Be(0);
    }
}
