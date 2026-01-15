# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files for dependency restore
COPY src/Maestro.Domain/*.csproj src/Maestro.Domain/
COPY src/Maestro.Application/*.csproj src/Maestro.Application/
COPY src/Maestro.Infrastructure/*.csproj src/Maestro.Infrastructure/
COPY src/Maestro.Api/*.csproj src/Maestro.Api/

# Restore NuGet packages
RUN dotnet restore src/Maestro.Api/Maestro.Api.csproj

# Copy all source code
COPY src/ src/

# Build and publish in release mode
WORKDIR /src/src/Maestro.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create directories for blocks
RUN mkdir -p /app/blocks /app/.maestro/blocks

# Copy published application
COPY --from=build /app/publish .

# Expose port 5000
EXPOSE 5000

# Set environment variables
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/discovery/health || exit 1

# Run the application
ENTRYPOINT ["dotnet", "Maestro.Api.dll"]
