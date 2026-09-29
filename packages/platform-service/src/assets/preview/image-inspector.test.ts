import { describe, expect, it } from 'vitest';
import { inspectImageDimensions } from './image-inspector';

describe('image inspector', () => {
  it('reads PNG IHDR dimensions', () => {
    const png = Buffer.alloc(24);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(360, 20);
    expect(inspectImageDimensions(png, '.png')).toEqual({ width: 640, height: 360 });
  });

  it('reads JPEG SOF dimensions', () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x48, 0x01, 0x00, 0x03, 0x01, 0x11, 0x00,
    ]);
    expect(inspectImageDimensions(jpeg, '.jpg')).toEqual({ width: 256, height: 72 });
  });

  it('reads WebP VP8X dimensions and leaves GIF/SVG dimensions omitted', () => {
    const webp = Buffer.alloc(30);
    webp.write('RIFF', 0, 'ascii');
    webp.write('WEBP', 8, 'ascii');
    webp.write('VP8X', 12, 'ascii');
    webp.writeUIntLE(319, 24, 3);
    webp.writeUIntLE(199, 27, 3);
    expect(inspectImageDimensions(webp, '.webp')).toEqual({ width: 320, height: 200 });
    expect(inspectImageDimensions(Buffer.alloc(32), '.gif')).toEqual({});
    expect(inspectImageDimensions(Buffer.alloc(32), '.svg')).toEqual({});
  });
});
