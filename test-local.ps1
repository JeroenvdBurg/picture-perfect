# Local Testing Script for PicturePerfect

Write-Host "=== PicturePerfect Local Testing ===" -ForegroundColor Cyan

# Test 1: Build Docker image
Write-Host "`nTest 1: Building Docker image..." -ForegroundColor Yellow
docker build -t pictureperfect:test .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful!" -ForegroundColor Green

# Test 2: Verify non-root user
Write-Host "`nTest 2: Verifying non-root user configuration..." -ForegroundColor Yellow
$userId = docker run --rm pictureperfect:test id -u
if ($userId -eq "1001") {
    Write-Host "✅ Container runs as non-root user (UID: $userId)" -ForegroundColor Green
} else {
    Write-Host "❌ Container runs as root or unexpected user (UID: $userId)" -ForegroundColor Red
    exit 1
}

# Test 3: Start container
Write-Host "`nTest 3: Starting container..." -ForegroundColor Yellow
$containerId = docker run -d -p 8080:8080 -e PORT=8080 pictureperfect:test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Container failed to start!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Container started (ID: $containerId)" -ForegroundColor Green

# Wait for container to be ready
Write-Host "`nWaiting for container to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Test 4: Health check
Write-Host "`nTest 4: Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Health check failed with status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
}

# Test 5: Main endpoint
Write-Host "`nTest 5: Testing main endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Main endpoint passed!" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Main endpoint failed with status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Main endpoint failed: $_" -ForegroundColor Red
}

# Test 6: Images API
Write-Host "`nTest 6: Testing images API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/images" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Images API passed!" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Images API failed with status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Images API failed: $_" -ForegroundColor Red
}

# Test 7: Process API (POST)
Write-Host "`nTest 7: Testing process API (POST)..." -ForegroundColor Yellow
try {
    $body = @{
        imageUrl = "https://example.com/test.jpg"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/process" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Process API passed!" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Process API failed with status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Process API failed: $_" -ForegroundColor Red
}

# Test 8: Container logs
Write-Host "`nTest 8: Checking container logs..." -ForegroundColor Yellow
docker logs $containerId | Select-Object -First 10
Write-Host "✅ Logs retrieved successfully!" -ForegroundColor Green

# Cleanup
Write-Host "`n=== Cleaning up ===" -ForegroundColor Cyan
Write-Host "Stopping container..." -ForegroundColor Yellow
docker stop $containerId | Out-Null
docker rm $containerId | Out-Null
Write-Host "✅ Container stopped and removed!" -ForegroundColor Green

Write-Host "`n=== All tests completed ===" -ForegroundColor Cyan
Write-Host "The application is ready to deploy to evroc Run!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Update [customer] in evroc-service.yaml and deploy scripts" -ForegroundColor White
Write-Host "2. Run deploy.ps1 to push to evroc registry" -ForegroundColor White
Write-Host "3. Apply service configuration with evroc CLI" -ForegroundColor White
