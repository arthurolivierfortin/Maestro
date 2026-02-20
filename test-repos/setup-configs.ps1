$repos = @('crud', 'auth', 'dashboard', 'explorer', 'notifications')

$postcssConfig = @"
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"@

$tailwindConfig = @"
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"@

foreach ($repo in $repos) {
    $repoPath = "C:\Meastro\test-repos\$repo"

    $postcssPath = Join-Path $repoPath "postcss.config.js"
    if (-not (Test-Path $postcssPath)) {
        Set-Content -Path $postcssPath -Value $postcssConfig
        Write-Host "Created postcss.config.js for $repo"
    }

    $tailwindPath = Join-Path $repoPath "tailwind.config.js"
    if (-not (Test-Path $tailwindPath)) {
        Set-Content -Path $tailwindPath -Value $tailwindConfig
        Write-Host "Created tailwind.config.js for $repo"
    }
}

Write-Host "`nDone creating configs!"
