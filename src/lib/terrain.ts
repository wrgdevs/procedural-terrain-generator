import * as THREE from "three";
import { applyHydraulicErosion } from "./erosion";
import { createPerlin2D, fbm2D, ridgedFbm2D } from "./noise";
import type { LodLevel } from "./lod";
import { getLodStep } from "./lod";

export type TerrainParams = {
  seed: string;
  chunkSize: number;
  resolution: number;
  amplitude: number;
  baseFrequency: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  ridgeStrength: number;
  detailFrequency: number;
  detailStrength: number;
  warpFrequency: number;
  warpStrength: number;
  waterLevel: number;
  biomeScale: number;
  moistureFrequency: number;
  temperatureFrequency: number;
  rockSlopeThreshold: number;
  snowStart: number;
  desertDryness: number;
  forestMoisture: number;
  visibleRadius: number;
  movementSpeed: number;
  lodNearDistance: number;
  lodMidDistance: number;
  erosionEnabled: boolean;
  erosionIterations: number;
  erosionLifetime: number;
  erosionRadius: number;
  erosionInertia: number;
  erosionCapacityFactor: number;
  erosionDepositRate: number;
  erosionErodeRate: number;
  erosionEvaporation: number;
  erosionGravity: number;
  erosionInitialSpeed: number;
  erosionInitialWater: number;
};

export const BiomeType = {
  DeepWater: 0,
  ShallowWater: 1,
  Beach: 2,
  Desert: 3,
  Grassland: 4,
  Forest: 5,
  Taiga: 6,
  Rock: 7,
  Snow: 8,
} as const;

export type BiomeType = (typeof BiomeType)[keyof typeof BiomeType];

export type TerrainStats = {
  minHeight: number;
  maxHeight: number;
  averageHeight: number;
};

export type TerrainData = {
  heights: Float32Array;
  slopes: Float32Array;
  colors: Float32Array;
  biomes: Uint8Array;
  resolution: number;
  size: number;
  stats: TerrainStats;
};

const COLOR_DEEP_WATER = new THREE.Color("#163b7a");
const COLOR_SHALLOW_WATER = new THREE.Color("#4aa7ff");
const COLOR_BEACH = new THREE.Color("#d9c88f");
const COLOR_DRY_SAND = new THREE.Color("#cdb97a");
const COLOR_GRASS_LIGHT = new THREE.Color("#7fc15c");
const COLOR_GRASS_DARK = new THREE.Color("#4e8a37");
const COLOR_FOREST = new THREE.Color("#2f6f35");
const COLOR_TAIGA = new THREE.Color("#557d6b");
const COLOR_ROCK = new THREE.Color("#8a8a8a");
const COLOR_DARK_ROCK = new THREE.Color("#5f5f5f");
const COLOR_SNOW = new THREE.Color("#ffffff");
const COLOR_SNOW_BLUE = new THREE.Color("#e8f3ff");

const TERRAIN_CACHE = new Map<string, TerrainData>();
const TERRAIN_CACHE_LIMIT = 96;

function dampenSpikeArtifacts(
  heights: Float32Array,
  resolution: number,
  blend = 0.22,
  passes = 1
) {
  let current = new Float32Array(heights);
  let next = new Float32Array(heights.length);

  const idx = (x: number, z: number) => z * resolution + x;

  for (let pass = 0; pass < passes; pass++) {
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const i = idx(x, z);
        const center = current[i];

        let sum = 0;
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        let count = 0;

        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;

            const nx = Math.max(0, Math.min(resolution - 1, x + dx));
            const nz = Math.max(0, Math.min(resolution - 1, z + dz));
            const h = current[idx(nx, nz)];

            sum += h;
            min = Math.min(min, h);
            max = Math.max(max, h);
            count++;
          }
        }

        const neighborAvg = sum / count;
        const localRange = max - min;
        const deviation = Math.abs(center - neighborAvg);

        if (deviation > Math.max(localRange * 0.95, 0.25)) {
          next[i] = center * (1 - blend) + neighborAvg * blend;
        } else {
          next[i] = center;
        }
      }
    }

    const tmp = current;
    current = next;
    next = tmp;
  }

  return current;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mixColor(a: THREE.Color, b: THREE.Color, t: number) {
  return a.clone().lerp(b, t);
}

function numberKey(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(5)) : value;
}

function cacheKey(params: TerrainParams, chunkX: number, chunkZ: number) {
  // Keep this key explicit so UI-only params do not invalidate generated terrain.
  // Rounded numeric values avoid cache misses from harmless floating-point noise.
  return [
    params.seed,
    chunkX,
    chunkZ,
    params.chunkSize,
    params.resolution,
    numberKey(params.amplitude),
    numberKey(params.baseFrequency),
    params.octaves,
    numberKey(params.persistence),
    numberKey(params.lacunarity),
    numberKey(params.ridgeStrength),
    numberKey(params.detailFrequency),
    numberKey(params.detailStrength),
    numberKey(params.warpFrequency),
    numberKey(params.warpStrength),
    numberKey(params.waterLevel),
    numberKey(params.biomeScale),
    numberKey(params.moistureFrequency),
    numberKey(params.temperatureFrequency),
    numberKey(params.rockSlopeThreshold),
    numberKey(params.snowStart),
    numberKey(params.desertDryness),
    numberKey(params.forestMoisture),
    params.erosionEnabled ? 1 : 0,
    params.erosionIterations,
    params.erosionLifetime,
    numberKey(params.erosionRadius),
    numberKey(params.erosionInertia),
    numberKey(params.erosionCapacityFactor),
    numberKey(params.erosionDepositRate),
    numberKey(params.erosionErodeRate),
    numberKey(params.erosionEvaporation),
    numberKey(params.erosionGravity),
    numberKey(params.erosionInitialSpeed),
    numberKey(params.erosionInitialWater),
  ].join(":");
}

function getCachedTerrainData(
  params: TerrainParams,
  chunkX: number,
  chunkZ: number,
  factory: () => TerrainData
) {
  const key = cacheKey(params, chunkX, chunkZ);
  const cached = TERRAIN_CACHE.get(key);

  if (cached) {
    TERRAIN_CACHE.delete(key);
    TERRAIN_CACHE.set(key, cached);
    return cached;
  }

  const generated = factory();

  if (TERRAIN_CACHE.size >= TERRAIN_CACHE_LIMIT) {
    const firstKey = TERRAIN_CACHE.keys().next().value;
    if (firstKey) TERRAIN_CACHE.delete(firstKey);
  }

  TERRAIN_CACHE.set(key, generated);
  return generated;
}

function classifyBiome(
  height: number,
  slope: number,
  moisture: number,
  temperature: number,
  params: TerrainParams
) {
  const deepWater = params.waterLevel - params.amplitude * 0.05;
  const shallowWater = params.waterLevel + params.amplitude * 0.03;
  const beachTop = params.waterLevel + params.amplitude * 0.08;
  const snowLine = params.waterLevel + params.amplitude * params.snowStart;

  if (height < deepWater) return BiomeType.DeepWater;
  if (height < shallowWater) return BiomeType.ShallowWater;
  if (height < beachTop) return BiomeType.Beach;
  if (height > snowLine) return BiomeType.Snow;
  if (slope > params.rockSlopeThreshold) return BiomeType.Rock;

  if (temperature < 0.28) {
    return height > params.waterLevel + params.amplitude * 0.55
      ? BiomeType.Taiga
      : BiomeType.Grassland;
  }

  if (moisture < params.desertDryness && temperature > 0.55) {
    return BiomeType.Desert;
  }

  if (moisture > params.forestMoisture) {
    return BiomeType.Forest;
  }

  return BiomeType.Grassland;
}

function biomeColor(
  biome: BiomeType,
  height: number,
  slope: number,
  moisture: number,
  temperature: number,
  x: number,
  z: number,
  params: TerrainParams,
  noise2D: (x: number, y: number) => number
) {
  const smallVariation = fbm2D(noise2D, x * 0.08, z * 0.08, 2, 0.5, 2.0) * 0.5 + 0.5;

  switch (biome) {
    case BiomeType.DeepWater: {
      const t = clamp01(
        (height - (params.waterLevel - params.amplitude * 0.25)) /
          (params.amplitude * 0.2)
      );
      return mixColor(COLOR_DEEP_WATER, COLOR_SHALLOW_WATER, t);
    }

    case BiomeType.ShallowWater: {
      return mixColor(COLOR_DEEP_WATER, COLOR_SHALLOW_WATER, smallVariation * 0.5);
    }

    case BiomeType.Beach: {
      return mixColor(COLOR_BEACH, COLOR_DRY_SAND, smallVariation * 0.65);
    }

    case BiomeType.Desert: {
      return mixColor(
        new THREE.Color("#d9be75"),
        new THREE.Color("#b89b58"),
        0.35 + smallVariation * 0.65
      );
    }

    case BiomeType.Grassland: {
      const base = mixColor(COLOR_GRASS_LIGHT, COLOR_GRASS_DARK, smallVariation);
      const dryBias = clamp01(1 - moisture * 0.7);
      return mixColor(base, new THREE.Color("#8bbf5e"), 1 - dryBias * 0.2);
    }

    case BiomeType.Forest: {
      const canopy = mixColor(COLOR_FOREST, new THREE.Color("#3f8540"), smallVariation);
      return mixColor(canopy, new THREE.Color("#24552a"), clamp01(slope * 1.2));
    }

    case BiomeType.Taiga: {
      const coldMix = mixColor(COLOR_TAIGA, new THREE.Color("#6c8f7a"), smallVariation);
      return mixColor(
        coldMix,
        new THREE.Color("#eef5f0"),
        clamp01((0.35 - temperature) * 1.3)
      );
    }

    case BiomeType.Rock: {
      const rockBase = mixColor(COLOR_DARK_ROCK, COLOR_ROCK, smallVariation);
      const highlight = clamp01(1 - slope * 1.5);
      return mixColor(rockBase, new THREE.Color("#a8a8a8"), highlight * 0.35);
    }

    case BiomeType.Snow: {
      const snowBase = mixColor(COLOR_SNOW_BLUE, COLOR_SNOW, smallVariation);
      const tint = clamp01(
        (height - (params.waterLevel + params.amplitude * params.snowStart)) /
          (params.amplitude * 0.35)
      );
      return mixColor(snowBase, new THREE.Color("#dbe9f7"), 1 - tint * 0.3);
    }
  }
}

function sampleTerrainHeight(
  noise2D: (x: number, y: number) => number,
  x: number,
  z: number,
  params: TerrainParams
) {
  const scale = Math.max(0.1, params.biomeScale);
  const sx = x * scale;
  const sz = z * scale;

  const warpA =
    fbm2D(
      noise2D,
      sx * params.warpFrequency + 13.2,
      sz * params.warpFrequency + 7.7,
      2,
      0.5,
      2
    ) * params.warpStrength;

  const warpB =
    fbm2D(
      noise2D,
      sx * params.warpFrequency - 8.3,
      sz * params.warpFrequency + 3.1,
      2,
      0.5,
      2
    ) * params.warpStrength;

  const wx = sx + warpA;
  const wz = sz + warpB;

  const continental = fbm2D(
    noise2D,
    wx * params.baseFrequency * 0.22,
    wz * params.baseFrequency * 0.22,
    4,
    0.52,
    2.0
  );

  const ridges = ridgedFbm2D(
    noise2D,
    wx * params.baseFrequency * 1.7,
    wz * params.baseFrequency * 1.7,
    params.octaves,
    params.persistence,
    params.lacunarity
  );

  const valleyNoise = fbm2D(
    noise2D,
    wx * params.baseFrequency * 0.75 + 40,
    wz * params.baseFrequency * 0.75 - 12,
    3,
    0.5,
    2.1
  );

  const detail = fbm2D(
    noise2D,
    wx * params.detailFrequency,
    wz * params.detailFrequency,
    3,
    0.55,
    2.2
  );

  const continentShape = continental * 0.5 + 0.5;
  const ridgeShape = Math.pow(ridges, 1.35);
  const valleyShape = valleyNoise * 0.5 + 0.5;
  const detailShape = detail * 0.5 + 0.5;

  const base =
    continentShape * 0.72 +
    ridgeShape * params.ridgeStrength * 0.95 -
    valleyShape * 0.18 +
    detailShape * params.detailStrength * 0.28;

  return (base - 0.35) * params.amplitude * 1.35;
}

function sampleMoisture(
  noise2D: (x: number, y: number) => number,
  x: number,
  z: number,
  params: TerrainParams
) {
  const scale = Math.max(0.1, params.biomeScale);
  const m = fbm2D(
    noise2D,
    x * scale * params.moistureFrequency + 120,
    z * scale * params.moistureFrequency - 45,
    4,
    0.52,
    2.1
  );
  return clamp01(m * 0.5 + 0.5);
}

function sampleTemperature(
  noise2D: (x: number, y: number) => number,
  x: number,
  z: number,
  height: number,
  params: TerrainParams
) {
  const scale = Math.max(0.1, params.biomeScale);
  const t = fbm2D(
    noise2D,
    x * scale * params.temperatureFrequency - 210,
    z * scale * params.temperatureFrequency + 26,
    3,
    0.52,
    2.0
  );

  const baseTemp = clamp01(t * 0.5 + 0.5);
  const altitudePenalty = clamp01(height / params.amplitude) * 0.22;
  return clamp01(baseTemp - altitudePenalty);
}

function generateTerrainData(
  params: TerrainParams,
  chunkX: number,
  chunkZ: number
): TerrainData {
  const resolution = Math.max(2, Math.floor(params.resolution));
  const vertexCount = resolution * resolution;

  const baseHeights = new Float32Array(vertexCount);
  const slopes = new Float32Array(vertexCount);
  const colors = new Float32Array(vertexCount * 3);
  const biomes = new Uint8Array(vertexCount);

  const noise2D = createPerlin2D(params.seed);

  let index = 0;
  for (let row = 0; row < resolution; row++) {
    const localZ = row / (resolution - 1) - 0.5;
    const worldZ = (chunkZ + localZ) * params.chunkSize;

    for (let col = 0; col < resolution; col++) {
      const localX = col / (resolution - 1) - 0.5;
      const worldX = (chunkX + localX) * params.chunkSize;

      const height = sampleTerrainHeight(noise2D, worldX, worldZ, params);
      baseHeights[index] = height;
      index++;
    }
  }

  const erosionHeightMap = params.erosionEnabled
  ? applyHydraulicErosion(
      baseHeights,
      resolution,
      {
        iterations: params.erosionIterations,
        maxLifetime: params.erosionLifetime,
        inertia: params.erosionInertia,
        capacityFactor: params.erosionCapacityFactor,
        minCapacity: 0.01,
        depositRate: params.erosionDepositRate,
        erodeRate: params.erosionErodeRate,
        evaporation: params.erosionEvaporation,
        gravity: params.erosionGravity,
        initialSpeed: params.erosionInitialSpeed,
        initialWater: params.erosionInitialWater,
        erosionRadius: params.erosionRadius,
        smoothingPasses: 1,
        smoothingStrength: 0.10,
      },
      `${params.seed}:${chunkX}:${chunkZ}`
    )
  : baseHeights;

  const stabilizedHeights = dampenSpikeArtifacts(erosionHeightMap, resolution, 0.18, 1);

  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;
  let totalHeight = 0;

  const step = params.chunkSize / (resolution - 1);
  const idx = (x: number, z: number) => z * resolution + x;

  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const i = idx(col, row);
      const h = stabilizedHeights[i];

      totalHeight += h;
      minHeight = Math.min(minHeight, h);
      maxHeight = Math.max(maxHeight, h);

      const left = stabilizedHeights[idx(Math.max(col - 1, 0), row)];
      const right = stabilizedHeights[idx(Math.min(col + 1, resolution - 1), row)];
      const down = stabilizedHeights[idx(col, Math.max(row - 1, 0))];
      const up = stabilizedHeights[idx(col, Math.min(row + 1, resolution - 1))];

      const dx = (right - left) / (2 * step);
      const dz = (up - down) / (2 * step);
      const slope = Math.sqrt(dx * dx + dz * dz);
      slopes[i] = slope;

      const localX = col / (resolution - 1) - 0.5;
      const localZ = row / (resolution - 1) - 0.5;
      const worldX = (chunkX + localX) * params.chunkSize;
      const worldZ = (chunkZ + localZ) * params.chunkSize;

      const moisture = sampleMoisture(noise2D, worldX, worldZ, params);
      const temperature = sampleTemperature(noise2D, worldX, worldZ, h, params);
      const biome = classifyBiome(h, slope, moisture, temperature, params);
      biomes[i] = biome;

      const color = biomeColor(
        biome,
        h,
        slope,
        moisture,
        temperature,
        worldX,
        worldZ,
        params,
        noise2D
      );

      colors[i * 3 + 0] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
  }

  return {
    heights: stabilizedHeights,
    slopes,
    colors,
    biomes,
    resolution,
    size: params.chunkSize,
    stats: {
      minHeight,
      maxHeight,
      averageHeight: totalHeight / vertexCount,
    },
  };
}

function buildGeometryFromTerrainData(
  data: TerrainData,
  params: TerrainParams,
  lodLevel: LodLevel
) {
  const step = getLodStep(lodLevel);
  const segments = Math.max(1, Math.floor((data.resolution - 1) / step));
  const vertexResolution = segments + 1;

  const geometry = new THREE.PlaneGeometry(
    params.chunkSize,
    params.chunkSize,
    segments,
    segments
  );

  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colorArray = new Float32Array(position.count * 3);

  const sampleGridValue = (
    values: Float32Array,
    resolution: number,
    x: number,
    z: number
  ) => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const z1 = Math.min(z0 + 1, resolution - 1);

    const tx = x - x0;
    const tz = z - z0;

    const i00 = z0 * resolution + x0;
    const i10 = z0 * resolution + x1;
    const i01 = z1 * resolution + x0;
    const i11 = z1 * resolution + x1;

    const a = values[i00] * (1 - tx) + values[i10] * tx;
    const b = values[i01] * (1 - tx) + values[i11] * tx;
    return a * (1 - tz) + b * tz;
  };

  const sampleColorGrid = (
    colors: Float32Array,
    resolution: number,
    x: number,
    z: number
  ) => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const z1 = Math.min(z0 + 1, resolution - 1);

    const tx = x - x0;
    const tz = z - z0;

    const idx = (ix: number, iz: number) => (iz * resolution + ix) * 3;

    const c00 = idx(x0, z0);
    const c10 = idx(x1, z0);
    const c01 = idx(x0, z1);
    const c11 = idx(x1, z1);

    const r0 = colors[c00 + 0] * (1 - tx) + colors[c10 + 0] * tx;
    const g0 = colors[c00 + 1] * (1 - tx) + colors[c10 + 1] * tx;
    const b0 = colors[c00 + 2] * (1 - tx) + colors[c10 + 2] * tx;

    const r1 = colors[c01 + 0] * (1 - tx) + colors[c11 + 0] * tx;
    const g1 = colors[c01 + 1] * (1 - tx) + colors[c11 + 1] * tx;
    const b1 = colors[c01 + 2] * (1 - tx) + colors[c11 + 2] * tx;

    return {
      r: r0 * (1 - tz) + r1 * tz,
      g: g0 * (1 - tz) + g1 * tz,
      b: b0 * (1 - tz) + b1 * tz,
    };
  };

  for (let row = 0; row < vertexResolution; row++) {
    const sourceZ = (row / (vertexResolution - 1)) * (data.resolution - 1);

    for (let col = 0; col < vertexResolution; col++) {
      const sourceX = (col / (vertexResolution - 1)) * (data.resolution - 1);
      const vertexIndex = row * vertexResolution + col;

      const height = sampleGridValue(data.heights, data.resolution, sourceX, sourceZ);
      const color = sampleColorGrid(data.colors, data.resolution, sourceX, sourceZ);

      position.setZ(vertexIndex, height);
      colorArray[vertexIndex * 3 + 0] = color.r;
      colorArray[vertexIndex * 3 + 1] = color.g;
      colorArray[vertexIndex * 3 + 2] = color.b;
    }
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

export function buildChunkGeometry(
  params: TerrainParams,
  chunkX: number,
  chunkZ: number,
  lodLevel: LodLevel = 0
) {
  const data = getCachedTerrainData(params, chunkX, chunkZ, () =>
    generateTerrainData(params, chunkX, chunkZ)
  );

  return buildGeometryFromTerrainData(data, params, lodLevel);
}

export function buildTerrainGeometry(params: TerrainParams) {
  return buildChunkGeometry(params, 0, 0, 0);
}

export function buildTerrainSnapshot(
  params: TerrainParams,
  chunkX = 0,
  chunkZ = 0
) {
  return generateTerrainData(params, chunkX, chunkZ);
}