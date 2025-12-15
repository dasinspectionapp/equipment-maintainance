/**
 * Compresses a video to less than 10 MB (10,000,000 bytes)
 * @param videoBlob - Video as Blob
 * @param maxSizeBytes - Maximum size in bytes (default: 10000000 = 10 MB)
 * @returns Promise<Blob> - Compressed video as Blob
 */
export async function compressVideo(
  videoBlob: Blob,
  maxSizeBytes: number = 10000000
): Promise<Blob> {
  // Check current size
  if (videoBlob.size <= maxSizeBytes) {
    return videoBlob;
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoBlob);
    
    video.src = url;
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      
      // Calculate target resolution to reduce file size
      // Start with 480p, reduce further if needed
      let targetWidth = 640;
      let targetHeight = 480;
      
      // If video is larger, reduce resolution proportionally
      const aspectRatio = video.videoWidth / video.videoHeight;
      if (video.videoWidth > 640) {
        targetWidth = 640;
        targetHeight = Math.round(640 / aspectRatio);
      }
      
      // Create a video element for playback and re-encoding
      const outputVideo = document.createElement('video');
      outputVideo.width = targetWidth;
      outputVideo.height = targetHeight;
      outputVideo.src = URL.createObjectURL(videoBlob);
      outputVideo.muted = true;
      outputVideo.playsInline = true;
      
      outputVideo.onloadeddata = async () => {
        try {
          // Create canvas for video frames
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            URL.revokeObjectURL(outputVideo.src);
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Create MediaStream from canvas
          const stream = canvas.captureStream(30); // 30 fps
          
          // Try to get audio track from original video
          try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaElementSource(outputVideo);
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);
            source.connect(audioContext.destination);
            
            const audioTrack = destination.stream.getAudioTracks()[0];
            if (audioTrack) {
              stream.addTrack(audioTrack);
            }
          } catch (audioError) {
            console.log('Audio not available, continuing without audio:', audioError);
          }
          
          // Try different codecs and bitrates
          const codecs = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
          ];
          
          let selectedCodec = codecs[0];
          for (const codec of codecs) {
            if (MediaRecorder.isTypeSupported(codec)) {
              selectedCodec = codec;
              break;
            }
          }
          
          // Try compression with different bitrate settings
          let bitrate = 2000000; // Start with 2 Mbps
          let minBitrate = 500000; // Minimum 500 kbps
          let attempts = 0;
          const maxAttempts = 5;
          
          const tryCompress = (): void => {
            const chunks: Blob[] = [];
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: selectedCodec,
              videoBitsPerSecond: bitrate
            });
            
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                chunks.push(event.data);
              }
            };
            
            mediaRecorder.onstop = () => {
              const blob = new Blob(chunks, { type: selectedCodec.split(';')[0] });
              
              if (blob.size <= maxSizeBytes || bitrate <= minBitrate || attempts >= maxAttempts) {
                URL.revokeObjectURL(outputVideo.src);
                resolve(blob);
                return;
              }
              
              // Reduce bitrate and try again
              bitrate = Math.max(minBitrate, bitrate - 300000); // Reduce by 300 kbps
              attempts++;
              setTimeout(tryCompress, 100);
            };
            
            // Start recording
            outputVideo.currentTime = 0;
            outputVideo.play();
            mediaRecorder.start();
            
            // Draw video frames to canvas
            const drawFrame = () => {
              if (outputVideo.paused || outputVideo.ended) {
                mediaRecorder.stop();
                return;
              }
              
              ctx.drawImage(outputVideo, 0, 0, targetWidth, targetHeight);
              requestAnimationFrame(drawFrame);
            };
            
            outputVideo.ontimeupdate = () => {
              if (outputVideo.currentTime >= outputVideo.duration) {
                mediaRecorder.stop();
              }
            };
            
            drawFrame();
          };
          
          tryCompress();
        } catch (error) {
          console.error('Error compressing video:', error);
          URL.revokeObjectURL(outputVideo.src);
          // Fallback: return original if compression fails
          resolve(videoBlob);
        }
      };
      
      outputVideo.onerror = () => {
        URL.revokeObjectURL(outputVideo.src);
        reject(new Error('Failed to load video for compression'));
      };
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
  });
}

/**
 * Gets the size of a video blob in bytes
 */
export function getVideoSize(videoBlob: Blob): number {
  return videoBlob.size;
}

/**
 * Converts video blob to base64
 */
export async function videoBlobToBase64(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(videoBlob);
  });
}
