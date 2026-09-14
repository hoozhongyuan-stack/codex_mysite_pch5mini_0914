'use client';
import MediaBrowser from './media-browser';
export { default as ContentManager } from './paged-content';
export function AssetManager({accept}: any) {
  return (
    <>
      <div className="heading-row">
        <h1>{accept==='video'?'视频库':'图片库'}</h1>
      </div>
      <section className="panel">
        <MediaBrowser accept={accept}/>
      </section>
    </>
  );
}
