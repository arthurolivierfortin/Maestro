using System.Threading.Tasks;

namespace Maestro.Application.Interfaces
{
    public interface IBlockChangePublisher
    {
        Task PublishBlockAddedAsync(object block);
        Task PublishBlockUpdatedAsync(object block);
        Task PublishBlockDeletedAsync(string blockId);
    }
}
