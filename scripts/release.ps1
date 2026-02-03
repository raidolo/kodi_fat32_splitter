$ErrorActionPreference = "Stop"

# 1. Get Version from package.json
$pkg = Get-Content "frontend/package.json" | ConvertFrom-Json
$version = $pkg.version
$tagName = "v$version"

Write-Host "Preparing Release: $tagName" -ForegroundColor Cyan

# 2. Commit changes on Dev
Write-Host "Committing changes on dev..." -ForegroundColor Yellow
git add .
try {
    git commit -m "chore(release): prepare $tagName"
}
catch {
    Write-Host "   No changes to commit, proceeding..." -ForegroundColor Gray
}

# 3. Merge to Main
Write-Host "Merging dev -> main..." -ForegroundColor Yellow
git checkout main
git pull origin main
git merge dev

# 4. Tag
Write-Host "Tagging $tagName..." -ForegroundColor Yellow
try {
    git tag $tagName
}
catch {
    Write-Host "   Tag already exists? Proceeding..." -ForegroundColor Gray
}

# 5. Push
Write-Host "Pushing to origin..." -ForegroundColor Yellow
git push origin main
git push origin $tagName

# 6. Return to Dev
Write-Host "Returning to dev branch..." -ForegroundColor Yellow
git checkout dev

Write-Host "Release $tagName triggered successfully." -ForegroundColor Green
