import { createRequire } from "module";

// Polyfill DOM and Canvas constructs required by pdfjs-dist / pdf-parse in Node.js serverless environments.
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

let cachedPDFParse = null;

async function getPDFParseClass() {
  if (!cachedPDFParse) {
    const mod = await import("pdf-parse");
    cachedPDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
  }
  return cachedPDFParse;
}

/**
 * PDF (.pdf) document parser using pdf-parse with serverless polyfills.
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

  const PDFParseClass = await getPDFParseClass();
  const parser = new PDFParseClass({ data: buffer });

  try {
    const result = await parser.getText();
    const normalizedText = (result.text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();

    // Map extracted pages
    const rawPages = result.pages || [];
    const pages = rawPages.map((p, idx) => ({
      pageNumber: p.num || idx + 1,
      text: (p.text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim(),
    }));

    return {
      text: normalizedText,
      pageCount: result.total || pages.length || 1,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: normalizedText }],
      metadata: {
        format: "pdf",
        total: result.total || pages.length || 1,
      },
    };
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Ignore destroy errors if already cleaned up
    }
  }
}
