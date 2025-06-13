import { useState } from "react";
import { MapService, MapConfig } from "../services/MapService";
import { useEventBus } from "./useEventBus";

export function useMapService() {
  const [currentMap, setCurrentMap] = useState<string>(MapService.getCurrentMap());

  // Listen for map change events
  useEventBus("map.changed", (mapKey: string) => {
    setCurrentMap(mapKey);
  });

  // Get map config
  const getMap = (mapKey: string): MapConfig | null => {
    return MapService.getMap(mapKey);
  };

  // Get all map keys
  const getAllMapKeys = (): string[] => {
    return MapService.getAllMapKeys();
  };

  // Get map name
  const getMapName = (mapKey: string): string => {
    return MapService.getMapName(mapKey);
  };

  // Get default spawn point
  const getDefaultSpawn = (mapKey: string): { x: number; y: number } => {
    return MapService.getDefaultSpawn(mapKey);
  };

  // Convert Tiled coordinates to Phaser coordinates
  const tiledToPhaser = (
    mapKey: string,
    tiledX: number,
    tiledY: number
  ): { x: number; y: number } => {
    return MapService.tiledToPhaser(mapKey, tiledX, tiledY);
  };

  // Convert Phaser coordinates to Tiled coordinates
  const phaserToTiled = (
    mapKey: string,
    phaserX: number,
    phaserY: number
  ): { x: number; y: number } => {
    return MapService.phaserToTiled(mapKey, phaserX, phaserY);
  };

  // Change map
  const changeMap = (mapKey: string): void => {
    MapService.setCurrentMap(mapKey);
  };

  return {
    currentMap,

    getMap,
    getAllMapKeys,
    getMapName,
    getDefaultSpawn,
    tiledToPhaser,
    phaserToTiled,
    changeMap,
  };
}
