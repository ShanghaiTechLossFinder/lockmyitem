export const MAIN_IMAGE_LONG_EDGE = 960;
export const MAIN_IMAGE_QUALITY = 0.72;
export const LOCATION_IMAGE_LONG_EDGE = 960;
export const LOCATION_IMAGE_QUALITY = 0.78;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择图片'));
    reader.readAsDataURL(file);
  });
}

function imageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解析失败，请换一张图片'));
    image.src = dataUrl;
  });
}

export function compressDataUrl(dataUrl, longEdge = MAIN_IMAGE_LONG_EDGE, quality = MAIN_IMAGE_QUALITY) {
  return imageFromDataUrl(dataUrl).then((image) => {
    const naturalLongEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, longEdge / naturalLongEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器无法处理图片压缩');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  });
}

export async function compressImageFile(file, options = {}) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  const source = await fileToDataUrl(file);
  return compressDataUrl(
    source,
    options.longEdge ?? MAIN_IMAGE_LONG_EDGE,
    options.quality ?? MAIN_IMAGE_QUALITY
  );
}

export function compressMainImageFile(file) {
  return compressImageFile(file, {
    longEdge: MAIN_IMAGE_LONG_EDGE,
    quality: MAIN_IMAGE_QUALITY
  });
}

export function compressLocationImageFile(file) {
  return compressImageFile(file, {
    longEdge: LOCATION_IMAGE_LONG_EDGE,
    quality: LOCATION_IMAGE_QUALITY
  });
}
