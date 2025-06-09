import { useState } from "react";
import { MapService, MapConfig, Portal } from "../services/MapService";
import { useEventBus } from "./useEventBus";

export function useMapService() {
  const [currentMap, setCurrentMap] = useState<string>(MapService.getCurrentMap());
  const [portals, setPortals] = useState<Portal[]>(MapService.getAllPortals());

  // Listen for map change events
  useEventBus("map.changed", (mapKey: string) => {
    setCurrentMap(mapKey);
  });

  // Listen for portal events
  useEventBus("portal.added", () => {
    setPortals(MapService.getAllPortals());
  });

  useEventBus("portal.removed", () => {
    setPortals(MapService.getAllPortals());
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

  // Get portals for a map
  const getPortalsForMap = (mapKey: string): Portal[] => {
    return MapService.getPortalsForMap(mapKey);
  };

  // Check for portal at position
  const checkPortalAtPosition = (x: number, y: number): Portal | null => {
    return MapService.checkPortalAtPosition(x, y, currentMap);
  };

  // Add portal
  const addPortal = (portal: Portal): void => {
    MapService.addPortal(portal);
  };

  // Remove portal
  const removePortal = (portalId: string): boolean => {
    return MapService.removePortal(portalId);
  };

  // Change map
  const changeMap = (mapKey: string): void => {
    MapService.setCurrentMap(mapKey);
  };

  // Traverse portal
  const traversePortal = (portalId: string): boolean => {
    return MapService.traversePortal(portalId);
  };

  return {
    currentMap,
    portals,
    getMap,
    getAllMapKeys,
    getMapName,
    getDefaultSpawn,
    tiledToPhaser,
    phaserToTiled,
    getPortalsForMap,
    checkPortalAtPosition,
    addPortal,
    removePortal,
    changeMap,
    traversePortal,
  };
}
