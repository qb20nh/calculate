const state = new BigUint64Array(4);

const rotl = (x: bigint, k: bigint): bigint => {
    return (x << k) | (x >> (64n - k));
};

const splitmix64 = (seed: bigint): bigint => {
    let z = (seed + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
};

export const setSeed = (seed: number) => {
    const s = BigInt(seed);
    state[0] = splitmix64(s);
    state[1] = splitmix64(state[0]);
    state[2] = splitmix64(state[1]);
    state[3] = splitmix64(state[2]);
};

// Initialize with default seed
setSeed(12345);

export const seededRandom = (): number => {
    const s0 = state[0];
    const s1 = state[1];
    const s3 = state[3];

    const result = (rotl(s0 + s3, 23n) + s0) & 0xffffffffffffffffn;

    const t = (s1 << 17n) & 0xffffffffffffffffn;

    state[2] ^= s0;
    state[3] ^= s1;
    state[1] ^= state[2];
    state[0] ^= state[3];

    state[2] ^= t;

    state[3] = rotl(state[3], 45n);

    // Convert to float in [0, 1) using 53 bits of precision
    const val = Number(result >> 11n);
    return val / 9007199254740992;
};

export const getRandomInt = (min: number, max: number): number => 
    Math.floor(seededRandom() * (max - min + 1)) + min;
