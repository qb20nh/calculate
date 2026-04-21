let currentSeed = 12345;

export const setSeed = (seed: number) => {
    currentSeed = seed;
};

export const seededRandom = () => {
    let t = currentSeed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

export const getRandomInt = (min: number, max: number) => 
    Math.floor(seededRandom() * (max - min + 1)) + min;
