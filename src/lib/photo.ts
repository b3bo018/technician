export async function prepareProfilePhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo file.');
  if (file.size > 8_000_000) throw new Error('Choose a photo smaller than 8 MB.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This image could not be opened.'));
      image.src = url;
    });
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const x = (image.naturalWidth - size) / 2;
    const y = (image.naturalHeight - size) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    canvas.getContext('2d')!.drawImage(image, x, y, size, size, 0, 0, 256, 256);
    return canvas.toDataURL('image/jpeg', .78);
  } finally {
    URL.revokeObjectURL(url);
  }
}
