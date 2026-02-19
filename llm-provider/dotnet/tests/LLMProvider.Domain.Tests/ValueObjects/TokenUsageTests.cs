using FluentAssertions;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Tests.ValueObjects;

public class TokenUsageTests
{
    [Fact]
    public void Constructor_WithValidValues_CreatesInstance()
    {
        // Act
        var usage = new TokenUsage(100, 50);

        // Assert
        usage.PromptTokens.Should().Be(100);
        usage.CompletionTokens.Should().Be(50);
        usage.TotalTokens.Should().Be(150);
    }

    [Fact]
    public void Constructor_WithZeroValues_CreatesInstance()
    {
        // Act
        var usage = new TokenUsage(0, 0);

        // Assert
        usage.PromptTokens.Should().Be(0);
        usage.CompletionTokens.Should().Be(0);
        usage.TotalTokens.Should().Be(0);
    }

    [Fact]
    public void Constructor_WithNegativePromptTokens_ThrowsException()
    {
        // Act
        var act = () => new TokenUsage(-1, 50);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("promptTokens");
    }

    [Fact]
    public void Constructor_WithNegativeCompletionTokens_ThrowsException()
    {
        // Act
        var act = () => new TokenUsage(100, -1);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("completionTokens");
    }

    [Fact]
    public void Zero_ReturnsZeroUsage()
    {
        // Act
        var usage = TokenUsage.Zero;

        // Assert
        usage.PromptTokens.Should().Be(0);
        usage.CompletionTokens.Should().Be(0);
        usage.TotalTokens.Should().Be(0);
    }

    [Fact]
    public void AddOperator_AddsTwoUsages()
    {
        // Arrange
        var usage1 = new TokenUsage(100, 50);
        var usage2 = new TokenUsage(200, 100);

        // Act
        var result = usage1 + usage2;

        // Assert
        result.PromptTokens.Should().Be(300);
        result.CompletionTokens.Should().Be(150);
        result.TotalTokens.Should().Be(450);
    }

    [Fact]
    public void ToString_ReturnsFormattedString()
    {
        // Arrange
        var usage = new TokenUsage(100, 50);

        // Act
        var result = usage.ToString();

        // Assert
        result.Should().Contain("150");
        result.Should().Contain("100");
        result.Should().Contain("50");
    }

    [Fact]
    public void Equality_SameValues_AreEqual()
    {
        // Arrange
        var usage1 = new TokenUsage(100, 50);
        var usage2 = new TokenUsage(100, 50);

        // Assert
        usage1.Should().Be(usage2);
        (usage1 == usage2).Should().BeTrue();
    }

    [Fact]
    public void Equality_DifferentValues_AreNotEqual()
    {
        // Arrange
        var usage1 = new TokenUsage(100, 50);
        var usage2 = new TokenUsage(100, 51);

        // Assert
        usage1.Should().NotBe(usage2);
        (usage1 != usage2).Should().BeTrue();
    }
}
