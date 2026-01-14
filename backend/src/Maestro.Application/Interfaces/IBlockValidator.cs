using System.Threading;
using System.Threading.Tasks;

namespace Maestro.Application.Interfaces
{
    public interface IBlockValidator
    {
        Task<BlockValidationResult> ValidateAsync(string blockJson, CancellationToken ct = default);
        Task<BlockValidationResult> ValidateFolderAsync(string folderPath, CancellationToken ct = default);
    }

    public class BlockValidationResult
    {
        public bool IsValid { get; set; }
        public string[] Errors { get; set; } = new string[0];
    }
}
