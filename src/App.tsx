import { Leva, useControls } from "leva";
import { useEffect, useMemo, useState } from "react";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { Scene } from "./components/Scene";
import { StatsOverlay } from "./components/StatsOverlay";
import type { ChunkCoord } from "./lib/chunks";
import { buildTerrainSnapshot } from "./lib/terrain";
import {
  buildPresetUrl,
  buildStateUrl,
  deleteCustomPreset,
  getSavedCustomPresetNames,
  loadCustomPreset,
  resolveInitialTerrainParams,
  saveCustomPreset,
} from "./lib/share";
import { exportHeightmapPNG, exportTerrainGLTF } from "./lib/export";

export default function App() {
  const initialTerrain = useMemo(() => resolveInitialTerrainParams(), []);
  const [sceneKey, setSceneKey] = useState(0);
  const [centerChunk, setCenterChunk] = useState<ChunkCoord>({ x: 0, z: 0 });
  const [isGenerating, setIsGenerating] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [savedPresets, setSavedPresets] = useState<string[]>(
    () => getSavedCustomPresetNames()
  );
  const [presetName, setPresetName] = useState("alpine");
  const [customPresetName, setCustomPresetName] = useState("");

  const terrain = useControls("Terrain", {
    seed: { value: initialTerrain.seed },
    chunkSize: { value: initialTerrain.chunkSize, min: 40, max: 400, step: 1 },
    resolution: { value: initialTerrain.resolution, min: 24, max: 192, step: 1 },
    visibleRadius: { value: initialTerrain.visibleRadius, min: 1, max: 4, step: 1 },
    movementSpeed: { value: initialTerrain.movementSpeed, min: 5, max: 150, step: 1 },

    lodNearDistance: { value: initialTerrain.lodNearDistance, min: 40, max: 1000, step: 1 },
    lodMidDistance: { value: initialTerrain.lodMidDistance, min: 80, max: 2000, step: 1 },

    amplitude: { value: initialTerrain.amplitude, min: 1, max: 100, step: 1 },
    baseFrequency: { value: initialTerrain.baseFrequency, min: 0.001, max: 0.05, step: 0.001 },
    octaves: { value: initialTerrain.octaves, min: 1, max: 8, step: 1 },
    persistence: { value: initialTerrain.persistence, min: 0.2, max: 0.95, step: 0.01 },
    lacunarity: { value: initialTerrain.lacunarity, min: 1.2, max: 4.0, step: 0.05 },
    ridgeStrength: { value: initialTerrain.ridgeStrength, min: 0, max: 2, step: 0.01 },
    detailFrequency: { value: initialTerrain.detailFrequency, min: 0.001, max: 0.1, step: 0.001 },
    detailStrength: { value: initialTerrain.detailStrength, min: 0, max: 0.5, step: 0.01 },
    warpFrequency: { value: initialTerrain.warpFrequency, min: 0.001, max: 0.03, step: 0.001 },
    warpStrength: { value: initialTerrain.warpStrength, min: 0, max: 25, step: 0.5 },
    waterLevel: { value: initialTerrain.waterLevel, min: -60, max: 60, step: 0.5 },
    biomeScale: { value: initialTerrain.biomeScale, min: 0.5, max: 3, step: 0.1 },
    moistureFrequency: { value: initialTerrain.moistureFrequency, min: 0.001, max: 0.05, step: 0.001 },
    temperatureFrequency: { value: initialTerrain.temperatureFrequency, min: 0.001, max: 0.05, step: 0.001 },
    rockSlopeThreshold: { value: initialTerrain.rockSlopeThreshold, min: 0.05, max: 1.5, step: 0.01 },
    snowStart: { value: initialTerrain.snowStart, min: 0.4, max: 1.4, step: 0.01 },
    desertDryness: { value: initialTerrain.desertDryness, min: 0.05, max: 0.9, step: 0.01 },
    forestMoisture: { value: initialTerrain.forestMoisture, min: 0.1, max: 0.95, step: 0.01 },

    erosionEnabled: { value: initialTerrain.erosionEnabled },
    erosionIterations: { value: initialTerrain.erosionIterations, min: 0, max: 12000, step: 50 },
    erosionLifetime: { value: initialTerrain.erosionLifetime, min: 1, max: 80, step: 1 },
    erosionRadius: { value: initialTerrain.erosionRadius, min: 1, max: 8, step: 0.1 },
    erosionInertia: { value: initialTerrain.erosionInertia, min: 0, max: 0.95, step: 0.01 },
    erosionCapacityFactor: { value: initialTerrain.erosionCapacityFactor, min: 0.5, max: 12, step: 0.1 },
    erosionDepositRate: { value: initialTerrain.erosionDepositRate, min: 0.01, max: 1, step: 0.01 },
    erosionErodeRate: { value: initialTerrain.erosionErodeRate, min: 0.01, max: 1, step: 0.01 },
    erosionEvaporation: { value: initialTerrain.erosionEvaporation, min: 0.001, max: 0.2, step: 0.001 },
    erosionGravity: { value: initialTerrain.erosionGravity, min: 0.1, max: 12, step: 0.1 },
    erosionInitialSpeed: { value: initialTerrain.erosionInitialSpeed, min: 0.1, max: 6, step: 0.1 },
    erosionInitialWater: { value: initialTerrain.erosionInitialWater, min: 0.1, max: 6, step: 0.1 },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("seed", terrain.seed);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", next);
  }, [terrain.seed]);

  const terrainSnapshot = useMemo(() => {
    const start = performance.now();
    const snapshot = buildTerrainSnapshot(terrain, centerChunk.x, centerChunk.z);
    const generationMs = performance.now() - start;
    return { snapshot, generationMs };
  }, [terrain, centerChunk]);

  useEffect(() => {
    setIsGenerating(true);
    const id = window.setTimeout(() => setIsGenerating(false), 90);
    return () => window.clearTimeout(id);
  }, [terrainSnapshot.generationMs, centerChunk.x, centerChunk.z, terrain.seed]);

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(buildStateUrl(terrain));
    alert("Share link copied.");
  };

  const resetCamera = () => {
    setSceneKey((v) => v + 1);
  };

  const applyBuiltinPreset = () => {
    window.location.href = buildPresetUrl(presetName);
  };

  const applyCustomPreset = (name: string) => {
    const loaded = loadCustomPreset(name);
    if (!loaded) return;
    window.location.href = buildStateUrl(loaded);
  };

  const saveCurrentPreset = () => {
    const name = customPresetName.trim();
    if (!name) {
      alert("Enter a preset name first.");
      return;
    }

    saveCustomPreset(name, terrain);
    setSavedPresets(getSavedCustomPresetNames());
    setCustomPresetName("");
  };

  const deletePreset = (name: string) => {
    deleteCustomPreset(name);
    setSavedPresets(getSavedCustomPresetNames());
  };

  const exportHeightmap = async () => {
    setIsExporting(true);
    try {
      await exportHeightmapPNG(terrain, centerChunk, `heightmap-${terrain.seed}.png`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportModel = async () => {
    setIsExporting(true);
    try {
      await exportTerrainGLTF(
        terrain,
        centerChunk,
        terrain.visibleRadius,
        `terrain-${terrain.seed}.glb`
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="hud">
        <div className="title-row">
          <div>
            <h1>Procedural Terrain Generator</h1>
            <p>Interactive 3D terrain, presets, export, and live controls</p>
          </div>

          <div className="hud-actions">
            <button className="share-btn" onClick={copyShareLink}>
              Copy share link
            </button>
            <button className="share-btn secondary" onClick={resetCamera}>
              Reset camera
            </button>
          </div>
        </div>

        <div className="hint">
          Fly with WASD and mouse look. Use the utility panel for presets, exports,
          and tuning.
        </div>
      </div>

      <div className="utility-panel">
        <div className="utility-section">
          <h3>Built-in presets</h3>
          <div className="row">
            <select
              className="control-select"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            >
              <option value="alpine">Alpine</option>
              <option value="desert">Desert</option>
              <option value="island">Island</option>
              <option value="canyon">Canyon</option>
            </select>
            <button className="panel-btn" onClick={applyBuiltinPreset}>
              Apply
            </button>
          </div>
        </div>

        <div className="utility-section">
          <h3>Save current</h3>
          <div className="row">
            <input
              className="control-input"
              value={customPresetName}
              placeholder="Preset name"
              onChange={(e) => setCustomPresetName(e.target.value)}
            />
            <button className="panel-btn" onClick={saveCurrentPreset}>
              Save
            </button>
          </div>
        </div>

        <div className="utility-section">
          <h3>Saved presets</h3>
          <div className="preset-list">
            {savedPresets.length === 0 ? (
              <div className="empty-note">No saved presets yet.</div>
            ) : (
              savedPresets.map((name) => (
                <div className="preset-item" key={name}>
                  <span>{name}</span>
                  <div className="row compact">
                    <button className="panel-btn small" onClick={() => applyCustomPreset(name)}>
                      Load
                    </button>
                    <button className="panel-btn small danger" onClick={() => deletePreset(name)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="utility-section">
          <h3>Export</h3>
          <div className="row wrap">
            <button className="panel-btn" onClick={exportHeightmap}>
              Export PNG
            </button>
            <button className="panel-btn" onClick={exportModel}>
              Export GLTF
            </button>
          </div>
        </div>
      </div>

      <Scene
        key={sceneKey}
        terrain={terrain}
        onCenterChunkChange={setCenterChunk}
      />

      <StatsOverlay
        centerChunk={centerChunk}
        stats={terrainSnapshot.snapshot.stats}
        visibleChunkCount={(terrain.visibleRadius * 2 + 1) ** 2}
        generationMs={terrainSnapshot.generationMs}
        isGenerating={isGenerating}
        isExporting={isExporting}
      />

      <LoadingOverlay
        visible={isGenerating || isExporting}
        label={isExporting ? "Exporting..." : "Generating terrain..."}
      />

      <Leva collapsed={false} />
    </div>
  );
}