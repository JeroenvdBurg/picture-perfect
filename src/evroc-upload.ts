// Upload file to server API endpoint (server forwards to evroc)
export const uploadFileToEvroc = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  console.log(`[Upload] Starting upload for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        console.log(`[Upload] Progress for ${file.name}: ${progress}% (${(e.loaded / 1024 / 1024).toFixed(2)} / ${(e.total / 1024 / 1024).toFixed(2)} MB)`);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          console.log(`[Upload] ✅ Success: ${file.name} -> ${data.fileKey}`);
          resolve(data.fileKey);
        } catch (error) {
          console.error(`[Upload] ❌ Invalid response for ${file.name}:`, error);
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          console.error(`[Upload] ❌ Failed: ${file.name} - ${error.message || 'Unknown error'}`);
          reject(new Error(error.message || 'Upload failed'));
        } catch {
          console.error(`[Upload] ❌ Failed: ${file.name} - Status ${xhr.status}`);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      console.error(`[Upload] ❌ Network error for ${file.name}`);
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
};
