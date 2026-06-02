import { BUILTIN_PRESETS, createDefaultTerrainParams } from "./presets";
import type { TerrainParams } from "./terrain";

export const CUSTOM_PRESET_PREFIX = "ptg:custom-preset:";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function encodeTerrainState(state: TerrainParams) {
  return encodeURIComponent(JSON.stringify(state));
}

export function decodeTerrainState(raw: string) {
  return safeJsonParse<Partial<TerrainParams>>(decodeURIComponent(raw));
}

export function buildStateUrl(state: TerrainParams) {
  const url = new URL(window.location.href);
  url.searchParams.delete("preset");
  url.searchParams.delete("seed");
  url.searchParams.set("state", encodeTerrainState(state));
  return url.toString();
}

export function buildPresetUrl(presetName: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete("state");
  url.searchParams.delete("seed");
  url.searchParams.set("preset", presetName);
  return url.toString();
}

export function getSavedCustomPresetNames() {
  if (typeof window === "undefined") return [];

  const names: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(CUSTOM_PRESET_PREFIX)) {
      names.push(key.slice(CUSTOM_PRESET_PREFIX.length));
    }
  }

  names.sort((a, b) => a.localeCompare(b));
  return names;
}

export function saveCustomPreset(name: string, state: TerrainParams) {
  window.localStorage.setItem(
    `${CUSTOM_PRESET_PREFIX}${name}`,
    JSON.stringify(state)
  );
}

export function loadCustomPreset(name: string) {
  const raw = window.localStorage.getItem(`${CUSTOM_PRESET_PREFIX}${name}`);
  return safeJsonParse<TerrainParams>(raw);
}

export function deleteCustomPreset(name: string) {
  window.localStorage.removeItem(`${CUSTOM_PRESET_PREFIX}${name}`);
}

export function resolveInitialTerrainParams() {
  const defaults = createDefaultTerrainParams();

  if (typeof window === "undefined") {
    return defaults;
  }

  const query = new URLSearchParams(window.location.search);

  const stateParam = query.get("state");
  if (stateParam) {
    const decoded = decodeTerrainState(stateParam);
    if (decoded) {
      return { ...defaults, ...decoded };
    }
  }

  const presetParam = query.get("preset");
  if (presetParam && BUILTIN_PRESETS[presetParam]) {
    return { ...defaults, ...BUILTIN_PRESETS[presetParam].params };
  }

  const seedParam = query.get("seed");
  if (seedParam) {
    return { ...defaults, seed: seedParam };
  }

  return defaults;
}