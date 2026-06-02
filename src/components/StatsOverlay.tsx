import { useEffect, useState } from "react";
import type { ChunkCoord } from "../lib/chunks";
import type { TerrainStats } from "../lib/terrain";

function useFps() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      frameCount += 1;

      if (now - lastTime >= 500) {
        const elapsed = now - lastTime;
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = now;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  return fps;
}

type Props = {
  centerChunk: ChunkCoord;
  stats: TerrainStats;
  visibleChunkCount: number;
  generationMs: number;
  isGenerating: boolean;
  isExporting: boolean;
};

export function StatsOverlay({
  centerChunk,
  stats,
  visibleChunkCount,
  generationMs,
  isGenerating,
  isExporting,
}: Props) {
  const fps = useFps();

  return (
    <div className="stats-overlay">
      <div className="stats-title">World stats</div>
      <div>Chunk: {centerChunk.x}, {centerChunk.z}</div>
      <div>Visible chunks: {visibleChunkCount}</div>
      <div>FPS: {fps || "—"}</div>
      <div>Generation: {generationMs.toFixed(1)} ms</div>
      <div>Status: {isExporting ? "Exporting" : isGenerating ? "Generating" : "Ready"}</div>
      <div>Min height: {stats.minHeight.toFixed(2)}</div>
      <div>Max height: {stats.maxHeight.toFixed(2)}</div>
      <div>Average height: {stats.averageHeight.toFixed(2)}</div>
    </div>
  );
}