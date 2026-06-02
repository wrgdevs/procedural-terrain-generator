type HydraulicErosionSettings = {
  iterations: number;
  maxLifetime: number;
  inertia: number;
  capacityFactor: number;
  minCapacity: number;
  depositRate: number;
  erodeRate: number;
  evaporation: number;
  gravity: number;
  initialSpeed: number;
  initialWater: number;
  erosionRadius: number;
  smoothingPasses?: number;
  smoothingStrength?: number;
};

function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sampleHeightAndGradient(
  heightMap: Float32Array,
  resolution: number,
  x: number,
  z: number
) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = Math.min(x0 + 1, resolution - 1);
  const z1 = Math.min(z0 + 1, resolution - 1);

  const tx = x - x0;
  const tz = z - z0;

  const idx = (ix: number, iz: number) => iz * resolution + ix;

  const h00 = heightMap[idx(x0, z0)];
  const h10 = heightMap[idx(x1, z0)];
  const h01 = heightMap[idx(x0, z1)];
  const h11 = heightMap[idx(x1, z1)];

  const height =
    h00 * (1 - tx) * (1 - tz) +
    h10 * tx * (1 - tz) +
    h01 * (1 - tx) * tz +
    h11 * tx * tz;

  const gradientX = (h10 - h00) * (1 - tz) + (h11 - h01) * tz;
  const gradientZ = (h01 - h00) * (1 - tx) + (h11 - h10) * tx;

  return { height, gradientX, gradientZ };
}

function depositSediment(
  heightMap: Float32Array,
  resolution: number,
  x: number,
  z: number,
  amount: number
) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = Math.min(x0 + 1, resolution - 1);
  const z1 = Math.min(z0 + 1, resolution - 1);

  const tx = x - x0;
  const tz = z - z0;

  const w00 = (1 - tx) * (1 - tz);
  const w10 = tx * (1 - tz);
  const w01 = (1 - tx) * tz;
  const w11 = tx * tz;

  const idx = (ix: number, iz: number) => iz * resolution + ix;

  heightMap[idx(x0, z0)] += amount * w00;
  heightMap[idx(x1, z0)] += amount * w10;
  heightMap[idx(x0, z1)] += amount * w01;
  heightMap[idx(x1, z1)] += amount * w11;
}

function erodeSediment(
  heightMap: Float32Array,
  resolution: number,
  x: number,
  z: number,
  amount: number,
  radius: number
) {
  const xMin = Math.max(0, Math.floor(x - radius));
  const xMax = Math.min(resolution - 1, Math.ceil(x + radius));
  const zMin = Math.max(0, Math.floor(z - radius));
  const zMax = Math.min(resolution - 1, Math.ceil(z + radius));

  const affected: Array<{ index: number; weight: number }> = [];
  let totalWeight = 0;

  for (let iz = zMin; iz <= zMax; iz++) {
    for (let ix = xMin; ix <= xMax; ix++) {
      const dx = ix - x;
      const dz = iz - z;
      const dist = Math.hypot(dx, dz);

      if (dist > radius) continue;

      const weight = 1 - dist / radius;
      const index = iz * resolution + ix;
      affected.push({ index, weight });
      totalWeight += weight;
    }
  }

  if (totalWeight <= 0) return;

  for (const cell of affected) {
    heightMap[cell.index] -= (amount * cell.weight) / totalWeight;
  }
}

function smoothHeightMap(
  input: Float32Array,
  resolution: number,
  passes: number,
  strength: number
) {
  let current = new Float32Array(input);
  let next = new Float32Array(input.length);

  const idx = (x: number, z: number) => z * resolution + x;

  for (let pass = 0; pass < passes; pass++) {
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = clamp(x + dx, 0, resolution - 1);
            const nz = clamp(z + dz, 0, resolution - 1);
            const weight = dx === 0 && dz === 0 ? 4 : dx === 0 || dz === 0 ? 2 : 1;

            sum += current[idx(nx, nz)] * weight;
            weightSum += weight;
          }
        }

        const avg = sum / weightSum;
        const i = idx(x, z);
        next[i] = current[i] * (1 - strength) + avg * strength;
      }
    }

    const tmp = current;
    current = next;
    next = tmp;
  }

  return current;
}

export function applyHydraulicErosion(
  inputHeights: Float32Array,
  resolution: number,
  settings: HydraulicErosionSettings,
  seed: string
) {
  const heights = new Float32Array(inputHeights);

  if (settings.iterations <= 0 || settings.erosionRadius <= 0) {
    return heights;
  }

  const rng = mulberry32(hashStringToSeed(seed));
  const maxX = resolution - 1;
  const maxZ = resolution - 1;

  for (let i = 0; i < settings.iterations; i++) {
    let posX = rng() * maxX;
    let posZ = rng() * maxZ;

    let dirX = 0;
    let dirZ = 0;
    let speed = settings.initialSpeed;
    let water = settings.initialWater;
    let sediment = 0;

    for (let life = 0; life < settings.maxLifetime; life++) {
      const x0 = Math.floor(posX);
      const z0 = Math.floor(posZ);

      if (x0 < 0 || x0 >= maxX || z0 < 0 || z0 >= maxZ) break;

      const sample = sampleHeightAndGradient(heights, resolution, posX, posZ);

      dirX = dirX * settings.inertia - sample.gradientX * (1 - settings.inertia);
      dirZ = dirZ * settings.inertia - sample.gradientZ * (1 - settings.inertia);

      const len = Math.hypot(dirX, dirZ);
      if (len === 0) break;

      dirX /= len;
      dirZ /= len;

      posX += dirX;
      posZ += dirZ;

      if (posX < 0 || posX >= maxX || posZ < 0 || posZ >= maxZ) break;

      const nextSample = sampleHeightAndGradient(heights, resolution, posX, posZ);
      const deltaHeight = nextSample.height - sample.height;

      const capacity = Math.max(
        -deltaHeight * speed * water * settings.capacityFactor,
        settings.minCapacity
      );

      if (sediment > capacity) {
        const depositAmount = (sediment - capacity) * settings.depositRate;
        sediment -= depositAmount;
        depositSediment(heights, resolution, posX, posZ, depositAmount);
      } else {
        const erodeAmount = Math.min(
          (capacity - sediment) * settings.erodeRate,
          -deltaHeight
        );

        if (erodeAmount > 0) {
          erodeSediment(
            heights,
            resolution,
            posX,
            posZ,
            erodeAmount,
            settings.erosionRadius
          );
          sediment += erodeAmount;
        }
      }

      speed = Math.sqrt(Math.max(0, speed * speed - deltaHeight * settings.gravity));
      water *= 1 - settings.evaporation;

      if (water <= 0.01) break;
    }
  }

  return smoothHeightMap(
    heights,
    resolution,
    settings.smoothingPasses ?? 1,
    settings.smoothingStrength ?? 0.12
  );
}