import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Hardcoded evroc credentials (from Dockerfile)
const EVROC_CONFIG = {
  endpoint: 'https://storage.services.evroc.cloud/',
  region: 'sto-1',
  bucket: 'my-bucket',
  accessKey: '7N5KDVEX5G4VPOK73YQW',
  secretKey: 'KFMUTGIFMBBFK2JYDEQJ4K4OOLN75JSEYQDO2GWR'
};

// Log configuration at startup
console.log('[Server] 🔍 Configuration Check:');
console.log('[Server] Endpoint:', EVROC_CONFIG.endpoint);
console.log('[Server] Region:', EVROC_CONFIG.region);
console.log('[Server] Bucket:', EVROC_CONFIG.bucket);
console.log('[Server] Access Key:', `${EVROC_CONFIG.accessKey.substring(0, 8)}...`);
console.log('[Server] Secret Key: ***SET***');

// Configure S3 client for evroc
let s3Client;
try {
  const s3Config = {
    endpoint: EVROC_CONFIG.endpoint,
    region: EVROC_CONFIG.region,
    credentials: {
      accessKeyId: EVROC_CONFIG.accessKey,
      secretAccessKey: EVROC_CONFIG.secretKey,
    },
    forcePathStyle: true,
    requestHandler: {
      requestTimeout: 30000, // 30 second timeout
      httpsAgent: {
        maxSockets: 50
      }
    }
  };
  
  console.log('[Server] 🔧 Initializing S3 client with config:', {
    endpoint: s3Config.endpoint,
    region: s3Config.region,
    forcePathStyle: s3Config.forcePathStyle,
    hasCredentials: !!(s3Config.credentials.accessKeyId && s3Config.credentials.secretAccessKey)
  });
  
  s3Client = new S3Client(s3Config);
  console.log('[Server] ✅ S3 client initialized successfully');
} catch (error) {
  console.error('[Server] ❌ Failed to initialize S3 client:', error);
  console.error('[Server] Error stack:', error.stack);
}

// CORS middleware - allow all origins for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// API Routes - Define before static files to ensure priority

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('healthy');
});

// List all objects in bucket
app.get('/api/files', async (req, res) => {
  try {
    if (!s3Client) {
      console.error('[Server] ❌ S3 client not initialized');
      return res.status(500).json({ error: 'S3 client not initialized' });
    }
    
    const bucketName = EVROC_CONFIG.bucket;
    console.log(`[Server] 📋 Listing files in bucket: ${bucketName}`);

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'uploads/',
    });

    console.log(`[Server] 🔄 Sending ListObjectsV2Command...`);
    const response = await s3Client.send(command);
    console.log(`[Server] 📦 Response received:`, { contentCount: response.Contents?.length || 0 });
    
    const files = (response.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      url: `/api/proxy/${bucketName}/${item.Key}`,
    }));

    console.log(`[Server] ✅ Found ${files.length} file(s)`);
    res.json({ files });
  } catch (error) {
    console.error('[Server] ❌ List files error:', error.message);
    console.error('[Server] Error name:', error.name);
    console.error('[Server] Error stack:', error.stack);
    console.error('[Server] Full error:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to list files', message: error.message, name: error.name });
  }
});

// Proxy image requests to avoid CORS
app.get('/api/proxy/:bucket/:key(*)', async (req, res) => {
  try {
    if (!s3Client) {
      console.error('[Server] ❌ S3 client not initialized');
      return res.status(500).json({ error: 'S3 client not initialized' });
    }
    
    const { bucket, key } = req.params;
    console.log(`[Server] 🖼️ Proxying image: ${bucket}/${key}`);
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    console.log(`[Server] 🔄 Sending GetObjectCommand...`);
    const response = await s3Client.send(command);
    console.log(`[Server] 📦 Response received, ContentType:`, response.ContentType);
    
    res.set('Content-Type', response.ContentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    // Convert the stream to buffer and send
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    res.send(buffer);
  } catch (error) {
    console.error('[Server] ❌ Proxy error:', error.message);
    console.error('[Server] Error name:', error.name);
    console.error('[Server] Error stack:', error.stack);
    
    // Return 404 only for NoSuchKey errors, 500 for everything else
    const statusCode = error.name === 'NoSuchKey' ? 404 : 500;
    const errorMessage = error.name === 'NoSuchKey' ? 'File not found' : 'Server error';
    res.status(statusCode).json({ error: errorMessage, message: error.message, name: error.name });
  }
});

// Delete endpoint - handles file deletion from evroc
app.delete('/api/files/:key(*)', async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!s3Client) {
      console.error('[Server] ❌ S3 client not initialized');
      return res.status(500).json({ error: 'S3 client not initialized' });
    }
    
    const fileKey = req.params.key;
    const bucketName = EVROC_CONFIG.bucket;
    
    console.log(`[Server] 🗑️ Deleting from evroc: ${bucketName}/${fileKey}`);

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });

    console.log(`[Server] 🔄 Sending DeleteObjectCommand...`);
    await s3Client.send(command);
    console.log(`[Server] 📦 Delete command completed`);
    
    const duration = Date.now() - startTime;
    console.log(`[Server] ✅ Delete successful: ${fileKey} in ${duration}ms`);

    res.json({ 
      success: true, 
      fileKey
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Server] ❌ Delete failed after ${duration}ms:`, error.message);
    console.error('[Server] Error name:', error.name);
    console.error('[Server] Error code:', error.code);
    console.error('[Server] Error stack:', error.stack);
    res.status(500).json({ error: 'Delete failed', message: error.message, name: error.name, code: error.code });
  }
});

// Upload endpoint - handles file upload to evroc
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!s3Client) {
      console.error('[Server] ❌ S3 client not initialized');
      return res.status(500).json({ error: 'S3 client not initialized' });
    }
    
    if (!req.file) {
      console.warn('[Server] ⚠️  Upload request with no file');
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log(`[Server] 📤 Received upload: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB, ${req.file.mimetype})`);

    const fileKey = `uploads/${Date.now()}-${req.file.originalname}`;
    const bucketName = EVROC_CONFIG.bucket;
    
    console.log(`[Server] 🚀 Uploading to evroc: ${bucketName}/${fileKey}`);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    console.log(`[Server] 🔄 Sending PutObjectCommand...`);
    await s3Client.send(command);
    console.log(`[Server] 📦 Upload command completed`);
    
    const duration = Date.now() - startTime;
    const url = `${EVROC_CONFIG.endpoint}${bucketName}/${fileKey}`;
    
    console.log(`[Server] ✅ Upload successful: ${req.file.originalname} in ${duration}ms`);
    console.log(`[Server] 🔗 URL: ${url}`);

    res.json({ 
      success: true, 
      fileKey,
      url
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Server] ❌ Upload failed after ${duration}ms:`, error.message);
    console.error('[Server] Error name:', error.name);
    console.error('[Server] Error code:', error.code);
    console.error('[Server] Error stack:', error.stack);
    console.error('[Server] Full error:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Upload failed', message: error.message, name: error.name, code: error.code });
  }
});

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Bind to 0.0.0.0 for Docker compatibility
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[Server] 🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(`[Server] 📍 Health check: http://${HOST}:${PORT}/health`);
  console.log(`[Server] 🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
