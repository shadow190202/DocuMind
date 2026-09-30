import { createRequire } from "module";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

// Polyfill DOM and Canvas constructs required by pdfjs-dist in Node.js serverless environments.
// Serverless runtimes like AWS Lambda and Vercel lack native GUI/canvas libraries (@napi-rs/canvas),
// causing unhandled ReferenceErrors (DOMMatrix is not defined) or module missing crashes.
class DOMMatrixPolyfill {
  constructor(init) {
    if (Array.isArray(init)) {
      this.a = init[0] ?? 1;
      this.b = init[1] ?? 0;
      this.c = init[2] ?? 0;
      this.d = init[3] ?? 1;
      this.e = init[4] ?? 0;
      this.f = init[5] ?? 0;
    } else if (init && typeof init === "object") {
      this.a = init.a ?? 1;
      this.b = init.b ?? 0;
      this.c = init.c ?? 0;
      this.d = init.d ?? 1;
      this.e = init.e ?? 0;
      this.f = init.f ?? 0;
    } else {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
    }
    this.m11 = this.a;
    this.m12 = this.b;
    this.m21 = this.c;
    this.m22 = this.d;
    this.m41 = this.e;
    this.m42 = this.f;
  }

  multiply(other) {
    return new DOMMatrixPolyfill([
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f,
    ]);
  }

  translate(tx = 0, ty = 0) {
    return new DOMMatrixPolyfill([
      this.a,
      this.b,
      this.c,
      this.d,
      this.a * tx + this.c * ty + this.e,
      this.b * tx + this.d * ty + this.f,
    ]);
  }

  scale(sx = 1, sy = sx) {
    return new DOMMatrixPolyfill([
      this.a * sx,
      this.b * sx,
      this.c * sy,
      this.d * sy,
      this.e,
      this.f,
    ]);
  }

  inverse() {
    const det = this.a * this.d - this.b * this.c;
    if (!det) return new DOMMatrixPolyfill();
    return new DOMMatrixPolyfill([
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    ]);
  }

  transformPoint(point = {}) {
    const x = point.x ?? 0;
    const y = point.y ?? 0;
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f,
    };
  }
}

class ImageDataPolyfill {
  constructor(w = 0, h = 0) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray((w * h * 4) || 0);
  }
}

class Path2DPolyfill {}

if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = ImageDataPolyfill;
}
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = Path2DPolyfill;
}

// Statically assign worker to globalThis.pdfjsWorker so pdfjs-dist never executes untraced filesystem lookups
globalThis.pdfjsWorker = pdfjsWorker;

// Intercept @napi-rs/canvas in require cache so pdfjs-dist never fails or warns
try {
  const require = createRequire(import.meta.url);
  const canvasMock = {
    DOMMatrix: DOMMatrixPolyfill,
    ImageData: ImageDataPolyfill,
    Path2D: Path2DPolyfill,
    createCanvas: () => ({ getContext: () => ({}) }),
  };

  const Module = require("module");
  if (Module._resolveFilename) {
    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function (request, parent, isMain, options) {
      if (request === "@napi-rs/canvas") {
        try {
          return origResolve.call(this, request, parent, isMain, options);
        } catch {
          return "@napi-rs/canvas";
        }
      }
      return origResolve.call(this, request, parent, isMain, options);
    };
  }

  require.cache["@napi-rs/canvas"] = {
    id: "@napi-rs/canvas",
    filename: "@napi-rs/canvas",
    loaded: true,
    exports: canvasMock,
  };
} catch {
  // Gracefully continue if require hook cannot be set
}

/**
 * PDF (.pdf) document parser using pdfjs-dist legacy with serverless worker and DOM polyfills.
 * Extracts full text and per-page text content safely without native dependencies.
 */
export async function parsePdf(buffer) {
  if (!buffer || buffer.length === 0) {
    return {
      text: "",
      pageCount: 0,
      pages: [],
      metadata: { format: "pdf" },
    };
  }

  // Ensure worker is registered on globalThis before document parsing
  if (!globalThis.pdfjsWorker) {
    globalThis.pdfjsWorker = pdfjsWorker;
  }

  // Pure Uint8Array slice to satisfy pdfjs-dist (Buffer.isBuffer must be false)
  const uint8Data = Buffer.isBuffer(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  try {
    const doc = await loadingTask.promise;
    const pageCount = doc.numPages || 0;
    const pages = [];
    const textSegments = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => item.str || "")
        .join(" ")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

      pages.push({
        pageNumber: i,
        text: pageText,
      });

      if (pageText) {
        textSegments.push(pageText);
      }
    }

    await doc.destroy();

    const normalizedText = textSegments
      .join("\n\n")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();

    return {
      text: normalizedText,
      pageCount: pageCount || 1,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: normalizedText }],
      metadata: {
        format: "pdf",
        total: pageCount || 1,
      },
    };
  } catch (err) {
    try {
      await loadingTask.destroy();
    } catch {}
    throw err;
  }
}
