function lcg(seed: number) {
    return function() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
}

export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
    if (!array || array.length <= 1) return array;
    const prng = lcg(seed);
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}


