# evroc Run Deployment Scripts

# Variables - Update these with your values

$ORGANIZATION = "31a06229-dbf5-4ae0-83c5-b209a90587ae"
$SERVICE_NAME = "pictureperfect"
$IMAGE_TAG = "latest"
$REGISTRY = "registry.prod.evroclabs.net"
$IMAGE_NAME = "$REGISTRY/$ORGANIZATION/${SERVICE_NAME}:${IMAGE_TAG}"

Write-Host "=== evroc Run Deployment ===" -ForegroundColor Cyan

# Step 1: Build the Docker image
Write-Host "`n1. Building Docker image..." -ForegroundColor Yellow
docker build -t ${SERVICE_NAME}:${IMAGE_TAG} .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Tag the image for evroc registry
Write-Host "`n2. Tagging image for evroc registry..." -ForegroundColor Yellow
docker tag ${SERVICE_NAME}:${IMAGE_TAG} $IMAGE_NAME

# Step 3: Login to evroc registry
Write-Host "`n3. Logging in to evroc registry..." -ForegroundColor Yellow
Write-Host "Note: You must login via evroc CLI first to setup your account" -ForegroundColor Cyan
Write-Host "Login with your email address (e.g., user@example.com):" -ForegroundColor Gray
Write-Host "Example: docker login $REGISTRY -u your-email@example.com" -ForegroundColor Gray
Write-Host ""
docker login $REGISTRY

# Step 4: Push the image
Write-Host "`n4. Pushing image to evroc registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed!" -ForegroundColor Red
    exit 1
}

# Step 5: Deploy/Update service using evroc CLI
Write-Host "`n5. Deploying service to evroc Run..." -ForegroundColor Yellow
Write-Host "Run the following command with evroc CLI:" -ForegroundColor Green
Write-Host "evroc run apply -f evroc-service.yaml --org $ORGANIZATION --rg $RESOURCE_GROUP" -ForegroundColor White

Write-Host "`n=== Deployment commands prepared ===" -ForegroundColor Cyan
Write-Host "Service will be available at: https://svc-[iid].prod.evroclabs.net" -ForegroundColor Green
Write-Host "`nTo view logs: evroc run logs $SERVICE_NAME --org $ORGANIZATION --rg $RESOURCE_GROUP" -ForegroundColor Yellow
