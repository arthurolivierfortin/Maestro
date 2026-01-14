using System.Threading.Tasks;

namespace Maestro.Api.Hubs
{
    public interface IBlockClient
    {
        Task BlockAdded(object block);
        Task BlockUpdated(object block);
        Task BlockDeleted(string blockId);
    }
}
