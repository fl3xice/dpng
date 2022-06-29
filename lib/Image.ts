/*
 * Copyright (c) 2020 · Marton Lederer
 * This file was created / generated by Marton Lederer
 * See the LICENSE on the github repo
 * https://github.com/MartonDev
 * https://marton.lederer.hu
 */

import { fromUint8Array } from "../deps.ts";

// crc32 lookup
const crc32: Array<number> = [];

for (let i = 0; i < 256; i++) {
  let c = i;

  for (let j = 0; j < 8; j++) {
    if (c & 1) {
      c = -306674912 ^ ((c >> 1) & 0x7fffffff);
    } else {
      c = (c >> 1) & 0x7fffffff;
    }
  }

  crc32[i] = c;
}

//searching in crc32
function lookUpcrc32(buffer: Uint8Array, offset: number, size: number): void {
  let crc = -1;

  for (let i = 4; i < size - 4; i++) {
    crc = crc32[(crc ^ buffer[offset + i]) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
  }

  write4(buffer, offset + size - 4, crc ^ -1);
}

//writing
function write4(buffer: Uint8Array, offset: number, value: number): number {
  buffer[offset++] = (value >> 24) & 255;
  buffer[offset++] = (value >> 16) & 255;
  buffer[offset++] = (value >> 8) & 255;
  buffer[offset++] = value & 255;

  return offset;
}

function write2(buffer: Uint8Array, offset: number, value: number): number {
  buffer[offset++] = (value >> 8) & 255;
  buffer[offset++] = value & 255;

  return offset;
}

function write2lsb(buffer: Uint8Array, offset: number, value: number): number {
  buffer[offset++] = value & 255;
  buffer[offset++] = (value >> 8) & 255;

  return offset;
}

function writeString(
  buffer: Uint8Array,
  offset: number,
  string: string,
): number {
  for (let i = 0, n = string.length; i < n; i++) {
    buffer[offset++] = string.charCodeAt(i);
  }

  return offset;
}

interface Palette {
  [key: string]: number;
}
interface Coordinate {
  x: number;
  y: number;
}
/*
*
* Helper interface to create valid RGB colors
*
* */
export interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

/*
*
* Creating a basic image, without extension type
*
* To create a PNG image, use `PNGImage`
*
* See the documentation for other image types
*
*/
export class Image {
  private readonly width: number;
  private height: number;
  private readonly depth: number;

  private readonly bit_depth: number;
  private readonly pix_format: number;
  private readonly pix_size: number;

  private readonly data_size: number;

  private readonly ihdr_offs: number;
  private readonly ihdr_size: number;
  private readonly plte_offs: number;
  private readonly plte_size: number;
  private readonly trns_offs: number;
  private readonly trns_size: number;
  private readonly idat_offs: number;
  private readonly idat_size: number;
  private readonly iend_offs: number;
  private readonly iend_size: number;
  private readonly buffer_size: number;

  private readonly buffer: Uint8Array;
  private palette: Palette;
  private pindex: number;
  private backgroundColor: Object;

  /*
  *
  * @typeParam  backgroundColor The background color of the desired image. Black by default
  *
  * @param width  The width of the desired image
  * @param height The height of the desired image
  *
  * @param depth  The depth of the desired image. 10 by default
  *
  * */
  constructor(
    width: number,
    height: number,
    depth: number = 10,
    backgroundColor: RGB = { r: 0, g: 0, b: 0, a: 0 },
    HEADER: string,
  ) {
    this.width = width;
    this.height = height;
    this.depth = depth;

    this.bit_depth = 8;
    this.pix_format = 3;
    this.pix_size = height * (width + 1);

    this.data_size = 2 + this.pix_size +
      5 * Math.floor((0xfffe + this.pix_size) / 0xffff) + 4;

    this.ihdr_offs = 0;
    this.ihdr_size = 4 + 4 + 13 + 4;
    this.plte_offs = this.ihdr_offs + this.ihdr_size;
    this.plte_size = 4 + 4 + 3 * depth + 4;
    this.trns_offs = this.plte_offs + this.plte_size;
    this.trns_size = 4 + 4 + depth + 4;
    this.idat_offs = this.trns_offs + this.trns_size;
    this.idat_size = 4 + 4 + this.data_size + 4;
    this.iend_offs = this.idat_offs + this.idat_size;
    this.iend_size = 4 + 4 + 4;
    this.buffer_size = this.iend_offs + this.iend_size;

    const rawBuffer = new ArrayBuffer(HEADER.length + this.buffer_size);

    writeString(new Uint8Array(rawBuffer), 0, HEADER);

    const buffer = new Uint8Array(rawBuffer, HEADER.length, this.buffer_size);

    this.palette = {};
    this.buffer = buffer;
    this.pindex = 0;

    let off = write4(buffer, this.ihdr_offs, this.ihdr_size - 12);
    off = writeString(buffer, off, "IHDR");
    off = write4(buffer, off, width);
    off = write4(buffer, off, height);
    buffer[off++] = this.bit_depth;
    buffer[off++] = this.pix_format;
    off = write4(buffer, this.plte_offs, this.plte_size - 12);
    writeString(buffer, off, "PLTE");
    off = write4(buffer, this.trns_offs, this.trns_size - 12);
    writeString(buffer, off, "tRNS");
    off = write4(buffer, this.idat_offs, this.idat_size - 12);
    writeString(buffer, off, "IDAT");
    off = write4(buffer, this.iend_offs, this.iend_size - 12);
    writeString(buffer, off, "IEND");

    let header = ((8 + (7 << 4)) << 8) | (3 << 6);
    header += 31 - (header % 31);

    write2(buffer, this.idat_offs + 8, header);

    for (let i = 0; (i << 16) - 1 < this.pix_size; i++) {
      let size, bits;

      if (i + 0xffff < this.pix_size) {
        size = 0xffff;
        bits = 0;
      } else {
        size = this.pix_size - (i << 16) - i;
        bits = 1;
      }

      let off = this.idat_offs + 8 + 2 + (i << 16) + (i << 2);
      buffer[off++] = bits;
      off = write2lsb(buffer, off, size);
      write2lsb(buffer, off, ~size);
    }

    this.backgroundColor = this.createRGBColor(backgroundColor);
  }

  /*
  *
  * Deflate before converting
  *
  * */
  deflate(): void {
    const { width, height, buffer } = this,
      BASE = 65521,
      NMAX = 5552;

    let s1 = 1,
      s2 = 0,
      n = NMAX;

    const baseOffset = this.idat_offs + 8 + 2 + 5;

    for (let y = 0; y < height; y++) {
      for (let x = -1; x < width; x++) {
        const i = y * (width + 1) + x + 1;
        s1 += buffer[baseOffset * Math.floor((i / 0xffff) + 1) + i];
        s2 += s1;

        if ((n -= 1) != 0) {
          continue;
        }

        s1 %= BASE;
        s2 %= BASE;
        n = NMAX;
      }
    }

    s1 %= BASE;
    s2 %= BASE;
    write4(buffer, this.idat_offs + this.idat_size - 8, (s2 << 16) | s1);

    lookUpcrc32(buffer, this.ihdr_offs, this.ihdr_size);
    lookUpcrc32(buffer, this.plte_offs, this.plte_size);
    lookUpcrc32(buffer, this.trns_offs, this.trns_size);
    lookUpcrc32(buffer, this.idat_offs, this.idat_size);
    lookUpcrc32(buffer, this.iend_offs, this.iend_size);
  }

  /*
  *
  * Drawing on the image canvas
  *
  * @param x  x coordinate of the pixel
  * @param y  y coordinate of the pixel
  * @param color  The color of the pixel, you can generate one with createRGBColor
  *
  * */
  setPixel(x: number, y: number, color: number): void {
    const i = y * (this.width + 1) + x + 1;
    this.buffer[this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i] =
      color;
  }

  /*
  *
  * Drawing a line
  *
  * @param x  x coordinate of the line
  * @param y  y coordinate of the line
  * @param width  the width of the line
  * @param height the height of the line
  * @param color  the color of the line
  *
  * */
  drawLine(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ): void {
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        this.setPixel(x + i, y + j, color);
      }
    }
  }

  /*
  *
  * Drawing a rectangle
  *
  * @param x1 start x coordinate of the rect
  * @param y1 start y coordinate of the rect
  * @param x2 end x coordinate of the rect
  * @param y2 end y coordinate of the rect
  * @param color  the color of the rect
  *
  * */
  drawRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
  ): void {
    if (x1 > x2 || y1 > y2) {
      throw new Error("x2 or y2 can't be greater than x1 or y1");
    }

    this.drawLine(x1, y1, x2 - x1, y2 - y1, color);
  }

  /*
  *
  * Drawing a bordered rectangle
  *
  * @param x1 start x coordinate of the rect
  * @param y1 start y coordinate of the rect
  * @param x2 end x coordinate of the rect
  * @param y2 end y coordinate of the rect
  * @param borderSize how thick should the border be
  * @param insideColor the color inside the rectangle border
  * @param outsideColor the color of the border
  *
  * */
  drawBorderedRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    borderSize: number,
    insideColor: number,
    outsideColor: number,
  ): void {
    if (x1 > x2 || y1 > y2) {
      throw new Error("x2 or y2 can't be greater than x1 or y1");
    }

    this.drawLine(x1, y1, x2 - x1, borderSize, outsideColor);
    this.drawLine(x1, y2 - borderSize, x2 - x1, borderSize, outsideColor);
    this.drawLine(x1, y1, borderSize, y2 - y1, outsideColor);
    this.drawLine(x2 - borderSize, y1, borderSize, y2 - y1, outsideColor);
    this.drawRect(
      x1 + borderSize,
      y1 + borderSize,
      x2 - borderSize,
      y2 - borderSize,
      insideColor,
    );
  }

  /*
  *
  * Getting the required parameters for a circle drawing
  *
  * @param x_center  The x coordinate of the center of the circle
  * @param y_center  The y coordinate of the center of the circle
  * @param r  The radius of the circle
  *
  * @return outlinePixels The pixels on the edge of the circle
  *
  * */
  getCirclePoints(
    x_center: number,
    y_center: number,
    r: number,
  ): Array<Array<Coordinate>> {
    let x = r,
      y = 0,
      P = 1 - r;

    let outlinePixels = [];

    while (x >= y) {
      outlinePixels.push(
        [
          { x: x + x_center, y: y + y_center },
          { x: x + x_center, y: -y + y_center },
        ],
        [
          { x: -x + x_center, y: y + y_center },
          { x: -x + x_center, y: -y + y_center },
        ],
        [
          { x: y + x_center, y: x + y_center },
          { x: y + x_center, y: -x + y_center },
        ],
        [
          { x: -y + x_center, y: x + y_center },
          { x: -y + x_center, y: -x + y_center },
        ],
      );

      y++;

      if (P < 0) {
        P += 2 * y + 1;
      } else {
        x--;
        P += 2 * (y - x + 1);
      }
    }

    return outlinePixels;
  }

  /*
  *
  * Drawing a filled circle
  *
  * @param x_center  The x coordinate of the center of the circle
  * @param y_center  The y coordinate of the center of the circle
  * @param r  The radius of the circle
  * @param color  The color of the circle
  *
  * */
  drawFilledCircle(
    x_center: number,
    y_center: number,
    r: number,
    color: number,
  ): void {
    const outlinePixels = this.getCirclePoints(x_center, y_center, r);

    for (const line of outlinePixels) {
      for (let i = 0; i < line[0].y - line[1].y + 1; i++) {
        this.setPixel(line[1].x, line[1].y + i, color);
      }
    }
  }

  /*
  *
  * THIS FEATURE IS NOT YET WORKING
  *
  * TODO: FIX THIS
  *
  * Drawing an outlined circle
  *
  * @param x_center  The x coordinate of the center of the circle
  * @param y_center  The y coordinate of the center of the circle
  * @param r  The radius of the circle (with the border size)
  * @param borderSize how thick border / outline should be
  * @param insideColor the color inside the circle border
  * @param outsideColor the color of the border
  *
  * */
  drawBorderedCircle(
    x_center: number,
    y_center: number,
    r: number,
    borderSize: number,
    insideColor: number,
    outsideColor: number,
  ): void {
    const outlinePixels = this.getCirclePoints(x_center, y_center, r),
      innerPixels = this.getCirclePoints(x_center, y_center, r - borderSize);

    for (const line of outlinePixels) {
      this.drawLine(line[0].x, line[0].y - 1, borderSize, 1, outsideColor);
      this.drawLine(line[0].x - 1, line[0].y, 1, borderSize, outsideColor);
      this.drawLine(line[1].x, line[1].y, borderSize, 1, outsideColor);
      this.drawLine(line[1].x, line[1].y, 1, borderSize, outsideColor);
    }

    for (const line of innerPixels) {
      for (let i = 0; i < line[0].y - line[1].y + 1; i++) {
        this.setPixel(line[1].x, line[1].y + i, insideColor);
      }
    }
  }

  /*
  *
  * @internal
  * Create color from rgba value
  *
  * @param red  Red color amount (0-255)
  * @param green  Green color amount (0-255)
  * @param blue  Blue color amount (0-255)
  * @param alpha  Opacity of the color
  *
  * @return Color from palette
  *
  * */
  color(red: number, green: number, blue: number, alpha: number): number {
    alpha = alpha >= 0 ? alpha : 255;
    const color: any = ((((((alpha << 8) | red) << 8) | green) << 8) | blue)
      .toString();

    if (this.palette[color] === undefined) {
      if (this.pindex == this.depth) {
        return 0;
      }

      const ndx = this.plte_offs + 8 + 3 * this.pindex;

      this.buffer[ndx] = red;
      this.buffer[ndx + 1] = green;
      this.buffer[ndx + 2] = blue;
      this.buffer[this.trns_offs + 8 + this.pindex] = alpha;

      this.palette[color] = this.pindex++;
    }

    return this.palette[color];
  }

  /*
  *
  * Get the index of a pixel
  *
  * @param x  x coordinate of the pixel
  * @param y  y coordinate of the pixel
  *
  * @return index of the pixel
  *
  * */
  index(x: number, y: number): number {
    const i = y * (this.width + 1) + x + 1;
    return this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
  }

  /*
  *
  * Get the image buffer
  *
  * @return image buffer
  *
  * */
  getBuffer(): Uint8Array {
    this.deflate();
    return new Uint8Array(this.buffer.buffer);
  }

  /**
   * Set the image buffer.
   * (e.g: for copy data from another png);
   */
  setBuffer(buf: ArrayBufferLike): void {
    this.buffer.buffer = buf;
  }

  /*
  *
  * Get the base64 encoded image string
  *
  * @return base64 string of the image
  *
  * */
  getBase64(): string {
    this.deflate();
    return fromUint8Array(new Uint8Array(this.buffer.buffer));
  }

  /*
  *
  * Get the base64 encoded image converted to HTML data url.
  * This can be used in img tags' src attribute
  *
  * @return base64 encoded source
  *
  * */
  getDataURL(): string {
    return "data:image/png;base64," + this.getBase64();
  }

  //TODO: convert CSS style colors to rgb

  /*
  *
  * Create an rgb color
  *
  * @typeParam color  RGB type color
  *
  * @return color to use with setPixel
  *
  * */
  createRGBColor(color: RGB): number {
    return this.color(color.r, color.g, color.b, Math.round(color.a * 255));
  }

  /*
  *
  * Get the color of a pixel
  *
  * @param x  x coordinate of the pixel
  * @param y  y coordinate of the pixel
  *
  * @return the internal color of the pixel
  *
  * */
  getPixel(x: number, y: number): number {
    const i = y * (this.width + 1) + x + 1;
    return this
      .buffer[this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i];
  }
}
