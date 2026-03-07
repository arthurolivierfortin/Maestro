#nullable enable

using System.Threading;
using System.Threading.Tasks;
using Moq;
using Xunit;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.Pricing;
using Microsoft.Extensions.Logging.Abstractions;

namespace Maestro.Execution.Tests
{
    public class ModelPricingServiceTests
    {
        private readonly Mock<ILLMProviderService> _providerMock;
        private readonly ModelPricingService _service;

        public ModelPricingServiceTests()
        {
            _providerMock = new Mock<ILLMProviderService>();
            _service = new ModelPricingService(
                _providerMock.Object,
                NullLogger<ModelPricingService>.Instance);
        }

        // ── Helper: build a CompatibleModelsResponse ──

        private static CompatibleModelsResponse MakeResponse(params CompatibleModel[] models)
        {
            return new CompatibleModelsResponse
            {
                Count = models.Length,
                Models = new System.Collections.Generic.List<CompatibleModel>(models)
            };
        }

        private static CompatibleModel MakeModel(
            string modelId,
            decimal? inputPrice = null,
            decimal? outputPrice = null,
            double parametersB = 0,
            bool isLocal = false)
        {
            return new CompatibleModel
            {
                ModelId = modelId,
                Name = modelId,
                InputTokenPricePerMillion = inputPrice,
                OutputTokenPricePerMillion = outputPrice,
                ParametersB = parametersB,
                IsLocal = isLocal,
            };
        }

        // ════════════════════════════════════════════════════════════════
        // 1 — GetPricingAsync returns cached prices from provider
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public async Task GetPricingAsync_ReturnsCachedPricesFromProvider()
        {
            _providerMock
                .Setup(p => p.GetCompatibleModelsAsync(null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(MakeResponse(
                    MakeModel("claude-sonnet-4-6", inputPrice: 3m, outputPrice: 15m)));

            var pricing = await _service.GetPricingAsync("claude-sonnet-4-6");

            Assert.NotNull(pricing);
            Assert.Equal(3m, pricing!.InputPricePerMillion);
            Assert.Equal(15m, pricing.OutputPricePerMillion);
        }

        // ════════════════════════════════════════════════════════════════
        // 2 — GetPricingAsync returns fallback for unknown cloud model
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public async Task GetPricingAsync_ReturnsFallbackForUnknownCloudModel()
        {
            // Provider returns an empty model list
            _providerMock
                .Setup(p => p.GetCompatibleModelsAsync(null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(MakeResponse());

            var pricing = await _service.GetPricingAsync("unknown-cloud-model");

            Assert.NotNull(pricing);
            // Cloud fallback: $5/$15 per million
            Assert.Equal(5m, pricing!.InputPricePerMillion);
            Assert.Equal(15m, pricing.OutputPricePerMillion);
        }

        // ════════════════════════════════════════════════════════════════
        // 3 — EstimateCostAsync calculates correctly
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public async Task EstimateCostAsync_CalculatesCorrectly()
        {
            _providerMock
                .Setup(p => p.GetCompatibleModelsAsync(null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(MakeResponse(
                    MakeModel("claude-sonnet-4-6", inputPrice: 3m, outputPrice: 15m)));

            // 1000 prompt tokens * 3 / 1_000_000 = 0.003
            // 500 completion tokens * 15 / 1_000_000 = 0.0075
            // Total = 0.0105
            var cost = await _service.EstimateCostAsync("claude-sonnet-4-6", 1000, 500);

            Assert.Equal(0.0105m, cost);
        }

        // ════════════════════════════════════════════════════════════════
        // 4 — EstimateCostAsync returns 0 for local model
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public async Task EstimateCostAsync_ReturnsZeroForLocalModel()
        {
            // No models from provider — fallback will be used
            _providerMock
                .Setup(p => p.GetCompatibleModelsAsync(null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(MakeResponse());

            // "llama" is in LocalModelFragments → fallback = $0/$0
            var cost = await _service.EstimateCostAsync("meta-llama-3.1-8b", 5000, 2000);

            Assert.Equal(0m, cost);
        }

        // ════════════════════════════════════════════════════════════════
        // 5 — Cache is used on second call (provider called only once)
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public async Task GetPricingAsync_UsesCacheOnSecondCall()
        {
            _providerMock
                .Setup(p => p.GetCompatibleModelsAsync(null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(MakeResponse(
                    MakeModel("claude-sonnet-4-6", inputPrice: 3m, outputPrice: 15m)));

            // First call — triggers cache refresh
            var first = await _service.GetPricingAsync("claude-sonnet-4-6");
            // Second call — should use cache
            var second = await _service.GetPricingAsync("claude-sonnet-4-6");

            Assert.NotNull(first);
            Assert.NotNull(second);
            Assert.Equal(first!.InputPricePerMillion, second!.InputPricePerMillion);

            // GetCompatibleModelsAsync should have been called exactly once
            _providerMock.Verify(
                p => p.GetCompatibleModelsAsync(null, It.IsAny<CancellationToken>()),
                Times.Once);
        }
    }
}
