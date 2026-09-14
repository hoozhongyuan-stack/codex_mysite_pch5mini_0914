'use client';
import { useState } from 'react';
export default function ProductGallery({
  ids,
  title,
  en,
}: {
  ids: string[];
  title: string;
  en: boolean;
}) {
  const [active, setActive] = useState(ids[0]);
  return (
    <div className="product-gallery">
      <img className="gallery-main" src={'/api/media/' + active} alt={title} />
      {ids.length > 1 && (
        <div className="gallery-thumbs">
          {ids.map((id, i) => (
            <button
              type="button"
              key={id}
              aria-label={(en ? 'View image ' : '查看图片 ') + (i + 1)}
              aria-pressed={active === id}
              onClick={() => setActive(id)}
            >
              <img src={'/api/media/' + id} alt={title + ' ' + (i + 1)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
