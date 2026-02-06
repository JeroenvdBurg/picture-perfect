# Update CORS configuration on evroc storage bucket
# Requires AWS CLI: https://aws.amazon.com/cli/

$BUCKET_NAME = "my-bucket"
$EVROC_ENDPOINT = "https://storage.services.evroc.cloud"
$ACCESS_KEY = "7N5KDVEX5G4VPOK73YQW"
$SECRET_KEY = "KFMUTGIFMBBFK2JYDEQJ4K4OOLN75JSEYQDO2GWR"

Write-Host "Updating CORS configuration for bucket: $BUCKET_NAME" -ForegroundColor Cyan

# Set environment variables for AWS CLI
$env:AWS_ACCESS_KEY_ID = $ACCESS_KEY
$env:AWS_SECRET_ACCESS_KEY = $SECRET_KEY

# Apply CORS configuration
Write-Host "Applying CORS configuration..." -ForegroundColor Yellow
aws s3api put-bucket-cors `
    --bucket $BUCKET_NAME `
    --cors-configuration file://cors-config.json `
    --endpoint-url $EVROC_ENDPOINT

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "CORS configuration updated successfully!" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Verifying current CORS settings..." -ForegroundColor Cyan
    aws s3api get-bucket-cors `
        --bucket $BUCKET_NAME `
        --endpoint-url $EVROC_ENDPOINT
} else {
    Write-Host ""
    Write-Host "Failed to update CORS configuration" -ForegroundColor Red
    Write-Host "Make sure AWS CLI is installed and configured properly." -ForegroundColor Yellow
}
