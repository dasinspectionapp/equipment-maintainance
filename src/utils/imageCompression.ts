/**
 * Compresses an image to less than 1 MB (1,000,000 bytes)
 * @param imageData - Image as data URL, File, or Blob
 * @param maxSizeBytes - Maximum size in bytes (default: 1000000 = 1 MB)
 * @param maxWidth - Maximum width for resizing (default: 1920)
 * @param maxHeight - Maximum height for resizing (default: 1920)
 * @returns Promise<string> - Compressed image as data URL
 */
export async function compressImage(
  imageData: string | File | Blob,
  maxSizeBytes: number = 1000000,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): Promise<string> {
  // Convert input to data URL if needed
  let dataUrl: string;
  
  if (typeof imageData === 'string') {
    // Already a data URL
    dataUrl = imageData;
  } else if (imageData instanceof File || imageData instanceof Blob) {
    // Convert File/Blob to data URL
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageData);
    });
  } else {
    throw new Error('Invalid image data type');
  }

  // Check if already under size limit
  const currentSize = getDataUrlSize(dataUrl);
  if (currentSize <= maxSizeBytes) {
    return dataUrl;
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels until we get under the size limit
      let quality = 0.9;
      let minQuality = 0.1;
      let attempts = 0;
      const maxAttempts = 20;

      const tryCompress = () => {
        const testDataUrl = canvas.toDataURL('image/jpeg', quality);
        const size = getDataUrlSize(testDataUrl);

        if (size <= maxSizeBytes || quality <= minQuality || attempts >= maxAttempts) {
          resolve(testDataUrl);
          return;
        }

        // If still too large, reduce quality
        if (size > maxSizeBytes) {
          quality = Math.max(minQuality, quality - 0.1);
        }

        attempts++;
        // Use requestAnimationFrame to avoid blocking
        requestAnimationFrame(tryCompress);
      };

      tryCompress();
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = dataUrl;
  });
}

/**
 * Gets the size of a data URL in bytes
 */
function getDataUrlSize(dataUrl: string): number {
  // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
  const base64 = dataUrl.split(',')[1] || dataUrl;
  // Calculate size: base64 is ~33% larger than binary
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Compresses multiple images
 */
export async function compressImages(
  images: (string | File | Blob)[],
  maxSizeBytes: number = 1000000
): Promise<string[]> {
  return Promise.all(
    images.map(img => compressImage(img, maxSizeBytes))
  );
}

