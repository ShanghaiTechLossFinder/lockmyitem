export const MAIN_IMAGE_MAX_DATA_URL_BYTES = 1_200_000;
export const LOCATION_IMAGE_MAX_DATA_URL_BYTES = 180_000;

const DEFAULT_ERROR_MESSAGE = '图片过大，请换一张或先裁剪/压缩';

export function dataUrlByteLength(dataUrl = '') {
  const value = String(dataUrl || '');
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

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

function renderImageToDataUrl(image, longEdge, quality) {
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
}

export async function compressImageFile(file, options = {}) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }

  const {
    maxDataUrlBytes = MAIN_IMAGE_MAX_DATA_URL_BYTES,
    maxLongEdge = 960,
    minLongEdge = 320,
    qualityStart = 0.72,
    qualityMin = 0.48,
    qualityStep = 0.08,
    edgeStepRatio = 0.82,
    errorMessage = DEFAULT_ERROR_MESSAGE
  } = options;

  const source = await fileToDataUrl(file);
  const image = await imageFromDataUrl(source);
  let best = '';
  let bestBytes = Infinity;

  for (let edge = Math.min(maxLongEdge, Math.max(image.naturalWidth, image.naturalHeight)); edge >= minLongEdge; edge = Math.floor(edge * edgeStepRatio)) {
    for (let quality = qualityStart; quality >= qualityMin; quality -= qualityStep) {
      const dataUrl = renderImageToDataUrl(image, edge, Math.max(qualityMin, quality));
      const bytes = dataUrlByteLength(dataUrl);
      if (bytes <= maxDataUrlBytes) {
        return dataUrl;
      }
      if (bytes < bestBytes) {
        best = dataUrl;
        bestBytes = bytes;
      }
    }
  }

  const smallest = renderImageToDataUrl(image, minLongEdge, qualityMin);
  const smallestBytes = dataUrlByteLength(smallest);
  if (smallestBytes <= maxDataUrlBytes) return smallest;
  if (best && bestBytes <= maxDataUrlBytes) return best;
  throw new Error(errorMessage);
}

export function compressMainImageFile(file) {
  return compressImageFile(file, {
    maxDataUrlBytes: MAIN_IMAGE_MAX_DATA_URL_BYTES,
    maxLongEdge: 960,
    minLongEdge: 360,
    qualityStart: 0.72,
    qualityMin: 0.46
  });
}

export function compressLocationImageFile(file) {
  return compressImageFile(file, {
    maxDataUrlBytes: LOCATION_IMAGE_MAX_DATA_URL_BYTES,
    maxLongEdge: 720,
    minLongEdge: 240,
    qualityStart: 0.68,
    qualityMin: 0.42
  });
}
