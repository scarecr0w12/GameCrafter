import React, { useRef, useState } from 'react';
import type { AssetPreview } from '@gamecrafter/contracts';

export interface ImageViewerProps {
  url: string;
  preview: AssetPreview;
  onOpenInAuthoringTool(): void;
}

export function ImageViewer({
  url,
  preview,
  onOpenInAuthoringTool,
}: ImageViewerProps): React.ReactElement {
  const viewport = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; offsetX: number; offsetY: number }>();

  const fit = (): void => {
    const container = viewport.current;
    const target = image.current;
    if (!container || !target || !target.naturalWidth || !target.naturalHeight) return;
    const next = Math.min(
      (container.clientWidth - 24) / target.naturalWidth,
      (container.clientHeight - 24) / target.naturalHeight,
      1,
    );
    setScale(Math.max(0.05, next));
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="gamecrafter-image-viewer">
      <div className="gamecrafter-image-viewer-toolbar">
        <button type="button" onClick={fit}>
          Fit
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          1:1
        </button>
        <span>
          {preview.metadata.width ?? '—'} × {preview.metadata.height ?? '—'}
        </span>
        <button type="button" onClick={onOpenInAuthoringTool}>
          Open in authoring tool
        </button>
      </div>
      <div
        ref={viewport}
        className="gamecrafter-image-viewer-viewport"
        onWheel={(event) => {
          event.preventDefault();
          setScale((current) =>
            Math.max(0.05, Math.min(8, current * (event.deltaY < 0 ? 1.1 : 0.9))),
          );
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y });
        }}
        onPointerMove={(event) => {
          if (!drag) return;
          setOffset({
            x: drag.offsetX + event.clientX - drag.x,
            y: drag.offsetY + event.clientY - drag.y,
          });
        }}
        onPointerUp={() => setDrag(undefined)}
        onPointerCancel={() => setDrag(undefined)}
      >
        <img
          ref={image}
          src={url}
          alt={preview.sourcePath}
          draggable={false}
          onLoad={fit}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>
    </div>
  );
}
