# Scaleway Cloud Deployment Script

# Variables - Update these with your values

$NAMESPACE_ID = "funcscwnssuspiciousmurdock2ee4sodu"
$SERVICE_NAME = "pictureperfect"
$IMAGE_TAG = "latest"
$REGISTRY = "rg.nl-ams.scw.cloud/$NAMESPACE_ID"
$IMAGE_NAME = "$REGISTRY/${SERVICE_NAME}:${IMAGE_TAG}"
$REGION = "nl-ams"

Write-Host "=== Scaleway Cloud Deployment ===" -ForegroundColor Cyan

# Step 1: Build the Docker image
Write-Host "`n1. Building Docker image..." -ForegroundColor Yellow
docker build -t ${SERVICE_NAME}:${IMAGE_TAG} .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Tag the image for Scaleway registry
Write-Host "`n2. Tagging image for Scaleway registry..." -ForegroundColor Yellow
docker tag ${SERVICE_NAME}:${IMAGE_TAG} $IMAGE_NAME

# Step 3: Login to Scaleway registry
Write-Host "`n3. Logging in to Scaleway registry..." -ForegroundColor Yellow
$SCW_USERNAME = "noLogin"
$SCW_PASSWORD = "be7fd6ab-2686-4449-820f-0629f5a80963"
echo $SCW_PASSWORD | docker login $REGISTRY -u $SCW_USERNAME --password-stdin
if ($LASTEXITCODE -ne 0) {
    Write-Host "Login failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Push the image
Write-Host "`n4. Pushing image to Scaleway registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed!" -ForegroundColor Red
    exit 1
}

# Step 5: Deploy/Update service using Scaleway CLI
Write-Host "`n5. Deploying service to Scaleway Serverless Containers..." -ForegroundColor Yellow
Write-Host "Run the following command with Scaleway CLI (scw):" -ForegroundColor Green
Write-Host "scw container container deploy namespace-id=$NAMESPACE_ID region=$REGION name=$SERVICE_NAME registry-image=$IMAGE_NAME port=8080" -ForegroundColor White

Write-Host "`n=== Deployment commands prepared ===" -ForegroundColor Cyan
Write-Host "Service will be available at: https://[container-name]-[namespace-id].functions.fnc.$REGION.scw.cloud" -ForegroundColor Green
Write-Host "`nTo view logs: scw container container logs $SERVICE_NAME region=$REGION" -ForegroundColor Yellow
