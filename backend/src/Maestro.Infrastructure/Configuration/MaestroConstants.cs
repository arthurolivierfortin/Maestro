namespace Maestro.Infrastructure.Configuration
{
    /// <summary>
    /// Centralized constants for Maestro paths, patterns, and configuration keys.
    /// </summary>
    public static class MaestroConstants
    {
        // ─────────────────────────────────────────────────────────────────────
        // Directory Names
        // ─────────────────────────────────────────────────────────────────────
        
        /// <summary>
        /// The hidden folder name for Maestro configuration and blocks within a project.
        /// </summary>
        public const string MaestroFolderName = ".maestro";
        
        /// <summary>
        /// The blocks subfolder within .maestro or global blocks directory.
        /// </summary>
        public const string BlocksFolderName = "blocks";

        /// <summary>
        /// The system blocks subfolder within blocks directory.
        /// System blocks are provided by Maestro and can be overridden.
        /// </summary>
        public const string SystemBlocksFolderName = "system";

        /// <summary>
        /// The user blocks subfolder within blocks directory for user overrides.
        /// </summary>
        public const string UserOverridesFolderName = "user";

        /// <summary>
        /// The workflows subfolder within .maestro.
        /// </summary>
        public const string WorkflowsFolderName = "workflows";

        /// <summary>
        /// The sessions subfolder within .maestro for storing session data.
        /// </summary>
        public const string SessionsFolderName = "sessions";
        
        // ─────────────────────────────────────────────────────────────────────
        // File Names & Patterns
        // ─────────────────────────────────────────────────────────────────────
        
        /// <summary>
        /// The project configuration file name.
        /// </summary>
        public const string ProjectConfigFileName = "project.json";
        
        /// <summary>
        /// Block file extension pattern.
        /// Format: {name}.{type}.block.json
        /// </summary>
        public const string BlockFileExtension = ".block.json";
        
        /// <summary>
        /// Glob pattern to discover all block files.
        /// </summary>
        public const string BlockFileGlobPattern = "*.block.json";
        
        // ─────────────────────────────────────────────────────────────────────
        // Environment Variables
        // ─────────────────────────────────────────────────────────────────────
        
        /// <summary>
        /// Environment variable to override the global blocks path.
        /// </summary>
        public const string GlobalBlocksPathEnvVar = "MAESTRO_GLOBAL_BLOCKS_PATH";
        
        /// <summary>
        /// Environment variable to override the user blocks path.
        /// </summary>
        public const string UserBlocksPathEnvVar = "MAESTRO_USER_BLOCKS_PATH";
        
        /// <summary>
        /// Environment variable to override the project blocks path.
        /// </summary>
        public const string ProjectBlocksPathEnvVar = "MAESTRO_PROJECT_BLOCKS_PATH";
        
        /// <summary>
        /// Environment variable to set the repository root path.
        /// </summary>
        public const string RepoRootEnvVar = "MAESTRO_REPO_ROOT";

        /// <summary>
        /// Environment variable for additional project search paths (colon or semicolon separated).
        /// </summary>
        public const string AdditionalProjectPathsEnvVar = "MAESTRO_ADDITIONAL_PROJECT_PATHS";
        
        // ─────────────────────────────────────────────────────────────────────
        // Configuration Keys
        // ─────────────────────────────────────────────────────────────────────
        
        /// <summary>
        /// Configuration section for Maestro settings.
        /// </summary>
        public const string ConfigurationSection = "Maestro";
        
        /// <summary>
        /// Configuration key for paths settings.
        /// </summary>
        public const string PathsConfigKey = "Paths";
        
        // ─────────────────────────────────────────────────────────────────────
        // Default Values
        // ─────────────────────────────────────────────────────────────────────
        
        /// <summary>
        /// Default relative path for global blocks from repository root.
        /// </summary>
        public const string DefaultGlobalBlocksRelativePath = "content/system/blocks";
        
        /// <summary>
        /// Default relative path for user blocks from user home.
        /// </summary>
        public const string DefaultUserBlocksRelativePath = ".maestro/blocks";
        
        /// <summary>
        /// Default relative path for project blocks from project root.
        /// </summary>
        public const string DefaultProjectBlocksRelativePath = ".maestro/blocks";
    }
}
