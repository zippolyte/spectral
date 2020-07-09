'use strict';

const DEFAULT_DESCRIPTOR = {
  configurable: true,
  enumerable: true,
};

function createArray(arr, getters) {
  // maybe proxy????
  for (const [key, getter] of getters) {
    Object.defineProperty(arr, key, {
      ...DEFAULT_DESCRIPTOR,
      get: getter,
      set(value) {
        Object.defineProperty(arr, key, {
          ...DEFAULT_DESCRIPTOR,
          value,
          writable: true,
        });
      },
    });
  }

  return arr;
}

module.exports = createArray;
