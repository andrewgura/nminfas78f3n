import { eventBus } from "../utils/EventBus";

// Map configuration interface
export interface MapConfig {
  mapfile: string;
  offsetX: number;
  offsetY: number;
  mapname: string;
  defaultSpawn: {
    x: number;
    y: number;
  };
}

// Internal map configurations
const MAPS: Record<string, MapConfig> = {
  // Main game map
  "game-map": {
    mapfile: "devground",
    offsetX: 1040,
    offsetY: 2064,
    mapname: "Starter Town",
    defaultSpawn: {
      x: 1040,
      y: 2064,
    },
  },

  // Noob cave map
  "noob-cave-map": {
    mapfile: "noob-cave",
    offsetX: 0,
    offsetY: 0,
    mapname: "Noob Cave",
    defaultSpawn: {
      x: 550,
      y: 550,
    },
  },
};

// Portal interface
export interface Portal {
  id: string;
  sourceMap: string;
  sourceX: number;
  sourceY: number;
  radius: number;
  targetMap: string;
  targetX: number;
  targetY: number;
  message: string;
}

class MapServicel {
  private maps: Record<string, MapConfig> = {};
  private portals: Portal[] = [];
  private currentMap: string = "game-map";

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Load map configurations
      this.maps = { ...MAPS };

      // Initialize default portals
      this.initializeDefaultPortals();

      // Emit initialization event
      eventBus.emit("mapService.initialized", {
        mapCount: Object.keys(this.maps).length,
        portalCount: this.portals.length,
      });

      console.log(
        `MapService initialized with ${Object.keys(this.maps).length} maps and ${
          this.portals.length
        } portals`
      );
    } catch (error) {
      console.error("Error initializing map service:", error);
    }
  }

  private initializeDefaultPortals(): void {
    // Add default portals
    this.portals = [
      {
        id: "main-to-cave",
        sourceMap: "game-map",
        sourceX: 1328,
        sourceY: 1872,
        radius: 32,
        targetMap: "noob-cave-map",
        targetX: 550,
        targetY: 550,
        message: "Descending into Noob Cave...",
      },
      {
        id: "cave-to-main",
        sourceMap: "noob-cave-map",
        sourceX: 550,
        sourceY: 450,
        radius: 32,
        targetMap: "game-map",
        targetX: 1328,
        targetY: 1828,
        message: "Returning to the surface...",
      },
    ];
  }

  getMap(mapKey: string): MapConfig | null {
    return this.maps[mapKey] || null;
  }

  getAllMapKeys(): string[] {
    return Object.keys(this.maps);
  }

  getMapName(mapKey: string): string {
    return this.maps[mapKey]?.mapname || mapKey;
  }

  getDefaultSpawn(mapKey: string): { x: number; y: number } {
    const map = this.maps[mapKey];
    if (!map) return { x: 0, y: 0 };

    return (
      map.defaultSpawn || {
        x: map.offsetX,
        y: map.offsetY,
      }
    );
  }

  tiledToPhaser(mapKey: string, tiledX: number, tiledY: number): { x: number; y: number } {
    const map = this.maps[mapKey];
    if (!map) return { x: tiledX, y: tiledY };

    return {
      x: tiledX + map.offsetX,
      y: tiledY + map.offsetY,
    };
  }

  phaserToTiled(mapKey: string, phaserX: number, phaserY: number): { x: number; y: number } {
    const map = this.maps[mapKey];
    if (!map) return { x: phaserX, y: phaserY };

    return {
      x: phaserX - map.offsetX,
      y: phaserY - map.offsetY,
    };
  }

  // Portal methods
  getAllPortals(): Portal[] {
    return [...this.portals];
  }

  getPortalsForMap(mapKey: string): Portal[] {
    return this.portals.filter((portal) => portal.sourceMap === mapKey);
  }

  checkPortalAtPosition(x: number, y: number, currentMap: string): Portal | null {
    const mapPortals = this.getPortalsForMap(currentMap);

    // Find the first portal that contains the position
    const portal = mapPortals.find((portal) => {
      const dx = portal.sourceX - x;
      const dy = portal.sourceY - y;
      const distanceSquared = dx * dx + dy * dy;

      // Check if within the portal's radius
      return distanceSquared <= portal.radius * portal.radius;
    });

    return portal || null;
  }

  addPortal(portal: Portal): void {
    // Check if a portal with this ID already exists
    const existingIndex = this.portals.findIndex((p) => p.id === portal.id);

    if (existingIndex >= 0) {
      // Replace existing portal
      this.portals[existingIndex] = portal;
    } else {
      // Add new portal
      this.portals.push(portal);
    }

    // Emit portal added event
    eventBus.emit("portal.added", portal);
  }

  removePortal(portalId: string): boolean {
    const initialLength = this.portals.length;
    this.portals = this.portals.filter((portal) => portal.id !== portalId);

    const removed = this.portals.length < initialLength;

    if (removed) {
      // Emit portal removed event
      eventBus.emit("portal.removed", portalId);
    }

    return removed;
  }

  setCurrentMap(mapKey: string): void {
    if (this.maps[mapKey]) {
      this.currentMap = mapKey;

      // Emit map changed event
      eventBus.emit("map.changed", mapKey);
    }
  }

  getCurrentMap(): string {
    return this.currentMap;
  }

  // Portal traversal method
  traversePortal(portalId: string): boolean {
    const portal = this.portals.find((p) => p.id === portalId);
    if (!portal) return false;

    // Emit portal traversal event
    eventBus.emit("portal.traverse", {
      portalId,
      sourceMap: portal.sourceMap,
      targetMap: portal.targetMap,
      targetPosition: { x: portal.targetX, y: portal.targetY },
      message: portal.message,
    });

    // Update current map
    this.setCurrentMap(portal.targetMap);

    return true;
  }
}

// Create and export singleton instance
export const MapService = new MapServicel();
