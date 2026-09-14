export const MAX_VIDEO_BYTES = 1024 ** 3;
export const VIDEO_CHUNK_BYTES = 8 * 1024 ** 2;
export function validateVideoSource(file) {
  if (
    !file ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > MAX_VIDEO_BYTES
  )
    throw Error('视频最大 1 GB，文件不能为空');
  if (!/\.(mp4|webm|mov)$/i.test(file.name || ''))
    throw Error('支持 MP4 / WebM / MOV');
  return file;
}
