// Small deterministic PRNG so a game can be replayed from the same seed.
export function createRng(seed = 123456789) {
  let t = seed >>> 0;
  const uniform = () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  return {
    uniform,
    normal(mean = 0, std = 1) {
      const u1 = Math.max(uniform(), 1e-9);
      const u2 = Math.max(uniform(), 1e-9);
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * std;
    },
    range(min, max) {
      return min + (max - min) * uniform();
    }
  };
}

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
