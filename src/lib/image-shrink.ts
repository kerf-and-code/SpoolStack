// Browser-only: shrink a photo before upload.
//
// A phone photo is 3 to 12 MB; shrunk to 2048px on the long edge at JPEG
// quality 0.85 it is about 0.3 to 0.8 MB and still shows stringing and
// layer lines clearly. Re-encoding through a canvas also drops the EXIF
// block, including any GPS location, so where the photo was taken never
// leaves the device.

import { PHOTO_JPEG_QUALITY, fitWithin } from './photos';

export interface ShrunkImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function shrinkImage(file: File): Promise<ShrunkImage> {
  let bitmap: ImageBitmap;
  try {
    // from-image applies the EXIF rotation, so portrait shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name} is not an image this browser can read. Try a JPEG or PNG.`);
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY));
  if (!blob) throw new Error(`${file.name} could not be converted.`);
  return { blob, width, height };
}
