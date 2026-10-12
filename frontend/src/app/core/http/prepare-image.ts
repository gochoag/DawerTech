export async function prepareImageForUpload(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error('Elige una imagen PNG, JPEG o WebP de hasta 5 MB.');
  }
  let bitmap: ImageBitmap | HTMLImageElement;
  let objectUrl = '';
  try {
    if (typeof createImageBitmap === 'function') bitmap = await createImageBitmap(file);
    else {
      objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      bitmap = image;
    }
    try {
      const width = bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width;
      const height = bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height;
      if (!width || !height) throw new Error('invalid_dimensions');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return file; // El servidor mantiene la optimizacion obligatoria.
      let result: Blob | null = null;
      for (const side of [1200, 960, 768]) {
        const ratio = Math.min(1, side / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        result = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.76));
        if (!result) return file;
        if (result.size <= 200 * 1024) break;
      }
      if (!result || result.size >= file.size) return file;
      const extension = result.type === 'image/webp' ? 'webp' : result.type === 'image/jpeg' ? 'jpg' : 'png';
      return new File([result], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: result.type, lastModified: file.lastModified });
    } finally { if ('close' in bitmap) bitmap.close(); }
  } catch {
    throw new Error('No se pudo procesar la imagen. Elige otro archivo.');
  } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
}
