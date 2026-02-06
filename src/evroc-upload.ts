import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getEvroc Config } from './runtime-config';

const config = getEvrocConfig();

// Initialize S3 client for browser
const s3Client = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  credentials: {
    accessKeyId: config.accessKey,
    secretAccessKey: config.secretKey,
  },
  forcePathStyle: true,
});

// Upload file directly to S3 from browser
export const uploadFileToEvroc = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  console.log(`[Upload] Starting upload for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  
  const fileKey = `uploads/${Date.now()}-${file.name}`;
  
  try {
    // Convert file to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    
    // Simulate progress since S3 SDK doesn't provide native progress for browser
    const progressInterval = setInterval(() => {
      if (onProgress) {
        // Simulate progress - this is a workaround since PutObjectCommand doesn't expose progress
        const fakeProgress = Math.floor(Math.random() * 30) + 50;
        onProgress(Math.min(fakeProgress, 95));
      }
    }, 200);
    
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: fileKey,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type,
      ACL: 'public-read', // Make images publicly readable
    });
    
    await s3Client.send(command);
    
    clearInterval(progressInterval);
    if (onProgress) onProgress(100);
    
    console.log(`[Upload] ✅ Success: ${file.name} -> ${fileKey}`);
    return fileKey;
  } catch (error) {
    console.error(`[Upload] ❌ Failed: ${file.name}`, error);
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
