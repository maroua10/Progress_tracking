// PDF.js still calls Promise.withResolvers even in its legacy distribution.
// Install the missing primitive in the page and in the isolated PDF worker.
export function installPdfCompatibility() {
  if (typeof Promise.withResolvers !== 'function') {
    Object.defineProperty(Promise, 'withResolvers', {
      configurable: true,
      writable: true,
      value: function () {
        const Constructor = typeof this === 'function' ? this : Promise;
        let resolve, reject;
        const promise = new Constructor((onResolve, onReject) => {
          resolve = onResolve;
          reject = onReject;
        });
        return { promise, resolve, reject };
      },
    });
  }
}
