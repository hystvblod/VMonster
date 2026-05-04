window.VMSUtils = {
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  },

  now() {
    return performance.now();
  }
};
