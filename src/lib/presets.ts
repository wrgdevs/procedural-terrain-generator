import type { TerrainParams } from "./terrain";

export function createDefaultTerrainParams(seed = "mountain-01"): TerrainParams {
  return {
    seed,
    chunkSize: 120,
    resolution: 80,
    visibleRadius: 2,
    movementSpeed: 55,
    lodNearDistance: 170,
    lodMidDistance: 320,

    amplitude: 22,
    baseFrequency: 0.012,
    octaves: 5,
    persistence: 0.5,
    lacunarity: 2.0,
    ridgeStrength: 0.65,
    detailFrequency: 0.045,
    detailStrength: 0.18,
    warpFrequency: 0.008,
    warpStrength: 7,
    waterLevel: -2,
    biomeScale: 1,
    moistureFrequency: 0.01,
    temperatureFrequency: 0.008,
    rockSlopeThreshold: 0.42,
    snowStart: 0.82,
    desertDryness: 0.3,
    forestMoisture: 0.62,

    erosionEnabled: true,
    erosionIterations: 900,
    erosionLifetime: 22,
    erosionRadius: 2.4,
    erosionInertia: 0.25,
    erosionCapacityFactor: 2.6,
    erosionDepositRate: 0.12,
    erosionErodeRate: 0.12,
    erosionEvaporation: 0.035,
    erosionGravity: 3.0,
    erosionInitialSpeed: 1.0,
    erosionInitialWater: 1.0,
  };
}

export type BuiltinPreset = {
  label: string;
  description: string;
  params: TerrainParams;
};

export const BUILTIN_PRESETS: Record<string, BuiltinPreset> = {
  alpine: {
    label: "Alpine",
    description: "Tall ridges, colder biomes, stronger snowlines",
    params: {
      ...createDefaultTerrainParams("alpine-01"),
      amplitude: 28,
      baseFrequency: 0.01,
      ridgeStrength: 0.95,
      snowStart: 0.72,
      forestMoisture: 0.56,
      waterLevel: -5,
      erosionIterations: 1100,
      erosionRadius: 2.8,
    },
  },
  desert: {
    label: "Desert",
    description: "Dry terrain with sparse vegetation and wide dunes",
    params: {
      ...createDefaultTerrainParams("desert-01"),
      amplitude: 16,
      baseFrequency: 0.009,
      ridgeStrength: 0.28,
      detailStrength: 0.12,
      waterLevel: -10,
      desertDryness: 0.15,
      forestMoisture: 0.9,
      moistureFrequency: 0.006,
      erosionIterations: 500,
      erosionRadius: 2.0,
    },
  },
  island: {
    label: "Island",
    description: "Water-heavy terrain with a strong central landmass",
    params: {
      ...createDefaultTerrainParams("island-01"),
      chunkSize: 140,
      amplitude: 18,
      baseFrequency: 0.013,
      ridgeStrength: 0.45,
      warpStrength: 9,
      waterLevel: 0,
      visibleRadius: 2,
      moistureFrequency: 0.012,
      forestMoisture: 0.7,
      erosionIterations: 800,
    },
  },
  canyon: {
    label: "Canyon",
    description: "Sharper valleys, strong erosion, and steep walls",
    params: {
      ...createDefaultTerrainParams("canyon-01"),
      amplitude: 24,
      baseFrequency: 0.014,
      ridgeStrength: 0.8,
      detailStrength: 0.24,
      warpStrength: 10,
      waterLevel: -6,
      erosionIterations: 1300,
      erosionLifetime: 26,
      erosionRadius: 2.3,
      erosionErodeRate: 0.14,
      erosionDepositRate: 0.11,
    },
  },
};

export function listBuiltinPresetNames() {
  return Object.keys(BUILTIN_PRESETS);
}