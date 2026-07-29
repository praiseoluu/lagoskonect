/**
 * Extract a thumbnail from a video File using an off-screen canvas.
 * Seeks to 1 second (or the midpoint for very short clips) and grabs a frame.
 *
 * @param {File} videoFile
 * @param {number} [maxWidth=640]
 * @returns {Promise<Blob|null>} JPEG blob, or null if extraction fails
 */
export function extractVideoThumbnail(videoFile, maxWidth = 640) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const url = URL.createObjectURL(videoFile);

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(1, video.duration / 2);
    }, { once: true });

    video.addEventListener('seeked', () => {
      try {
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        }, 'image/jpeg', 0.85);
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    }, { once: true });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, { once: true });

    video.src = url;
  });
}
