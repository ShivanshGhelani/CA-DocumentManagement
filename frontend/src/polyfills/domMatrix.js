// Polyfill for DOMMatrix for react-pdf/pdfjs in environments where it's missing
if (typeof window !== 'undefined' && typeof window.DOMMatrix === 'undefined') {
  window.DOMMatrix = window.WebKitCSSMatrix || window.MSCSSMatrix || class {
    constructor() {
      throw new Error('DOMMatrix is not supported in this environment.');
    }
  };
} 