/**
 * colorExtractor.ts
 * Client-side color quantization & palette extraction from logo images / URLs.
 * Runs completely offline using HTML5 Canvas pixel sampling.
 */

export interface ExtractedColorPalette {
  dominant: string;
  palette: string[];
  isDark: boolean;
  recommendedBg: string;
  secondaryAccent: string;
}

/**
 * Converts RGB numbers to Hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts Hex string to RGB object
 */
export function hexToRgb(hexStr: string): { r: number; g: number; b: number } | null {
  let hex = hexStr.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return null;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

/**
 * Calculates perceived brightness (0 - 255)
 */
export function getPerceivedBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Calculates color saturation (0 - 1)
 */
export function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const d = max - min;
  const l = (max + min) / 2;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/**
 * Quantizes and extracts a harmonious color palette from an image File or image URL.
 */
export async function extractColorPalette(
  source: File | string,
  sampleSize = 80
): Promise<ExtractedColorPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    let objectUrl = '';
    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return resolve(getDefaultPalette());
        }

        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number; score: number }>();

        // Sample pixels across image
        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Skip transparent or near-transparent pixels
          if (a < 140) continue;

          const brightness = getPerceivedBrightness(r, g, b);
          // Skip extreme whites / near-blacks for brand dominance
          if (brightness < 25 || brightness > 245) continue;

          const saturation = getSaturation(r, g, b);
          // Prefer saturated vibrant colors
          const score = (saturation * 1.8) + (brightness > 60 && brightness < 200 ? 1 : 0.5);

          // Group colors into rough buckets of 24
          const bucketStep = 24;
          const br = Math.round(r / bucketStep) * bucketStep;
          const bg = Math.round(g / bucketStep) * bucketStep;
          const bb = Math.round(b / bucketStep) * bucketStep;
          const key = `${br}-${bg}-${bb}`;

          const existing = colorBuckets.get(key);
          if (existing) {
            existing.count++;
            existing.score += score;
          } else {
            colorBuckets.set(key, { r: br, g: bg, b: bb, count: 1, score });
          }
        }

        if (objectUrl) URL.revokeObjectURL(objectUrl);

        if (colorBuckets.size === 0) {
          return resolve(getDefaultPalette());
        }

        // Sort by vibrant score and occurrence
        const sortedBuckets = Array.from(colorBuckets.values()).sort(
          (a, b) => b.score - a.score
        );

        const palette: string[] = [];
        for (const bucket of sortedBuckets) {
          const hex = rgbToHex(bucket.r, bucket.g, bucket.b);
          // Ensure colors in palette are distinct (not too close)
          const isTooClose = palette.some((existingHex) => {
            const rgb1 = hexToRgb(existingHex);
            const rgb2 = bucket;
            if (!rgb1) return false;
            const dist = Math.sqrt(
              Math.pow(rgb1.r - rgb2.r, 2) +
              Math.pow(rgb1.g - rgb2.g, 2) +
              Math.pow(rgb1.b - rgb2.b, 2)
            );
            return dist < 45;
          });

          if (!isTooClose) {
            palette.push(hex);
            if (palette.length >= 6) break;
          }
        }

        const dominant = palette[0] || '#2F7D32';
        const secondaryAccent = palette[1] || palette[0] || '#D4A72C';
        const dominantRgb = hexToRgb(dominant) || { r: 47, g: 125, b: 50 };
        const dominantBrightness = getPerceivedBrightness(dominantRgb.r, dominantRgb.g, dominantRgb.b);
        const isDark = dominantBrightness < 140;

        // Determine recommended complementary background
        const recommendedBg = isDark ? '#172033' : '#F7F7F2';

        resolve({
          dominant,
          palette,
          isDark,
          recommendedBg,
          secondaryAccent,
        });
      } catch (err) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(getDefaultPalette());
    };
  });
}

/**
 * Fallback palette in case of image load failure or monochrome image
 */
function getDefaultPalette(): ExtractedColorPalette {
  return {
    dominant: '#2F7D32',
    palette: ['#2F7D32', '#D4A72C', '#172033', '#7BC67E', '#10b981', '#3b82f6'],
    isDark: false,
    recommendedBg: '#F7F7F2',
    secondaryAccent: '#D4A72C',
  };
}
