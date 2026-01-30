using System;
using System.Collections.Generic;

namespace Maestro.Domain.Entities
{
    public class BlockDefinition
    {
        public string Id { get; private set; }
        public string Name { get; private set; }
        public string BlockType { get; private set; }
        public string Version { get; private set; }
        public bool IsAtomic { get; private set; }
        public string Description { get; private set; }
        public Dictionary<string, object> Config { get; private set; } = new();
        public Dictionary<string, object> Metadata { get; private set; } = new();
        public List<string> Capabilities { get; private set; } = new();

        private BlockDefinition() { }

        public static BlockDefinition Create(string id, string name, string blockType)
        {
            if (string.IsNullOrWhiteSpace(id)) throw new ArgumentException("id");
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name");
            if (string.IsNullOrWhiteSpace(blockType)) throw new ArgumentException("blockType");

            return new BlockDefinition
            {
                Id = id,
                Name = name,
                BlockType = blockType,
                Version = "1.0.0",
                IsAtomic = true
            };
        }

        public void UpdateMetadata(Dictionary<string, object> metadata)
        {
            Metadata = metadata ?? new();
        }

        public void UpdateConfig(Dictionary<string, object> config)
        {
            Config = config ?? new();
        }

        public void SetIsAtomic(bool isAtomic)
        {
            IsAtomic = isAtomic;
        }

        public void SetDescription(string description)
        {
            Description = description ?? string.Empty;
        }

        public void SetVersion(string version)
        {
            Version = version ?? "1.0.0";
        }

        public void AddCapabilities(IEnumerable<string> capabilities)
        {
            if (capabilities != null)
            {
                Capabilities.AddRange(capabilities);
            }
        }
    }
}
