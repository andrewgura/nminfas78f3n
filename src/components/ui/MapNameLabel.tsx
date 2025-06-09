import React, { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { MapService } from "../../services/MapService";
import { useEventBus } from "../../hooks/useEventBus";

const MapNameLabel: React.FC = () => {
  const currentMap = useGameStore((state) => state.currentMap);
  const [mapName, setMapName] = useState("");
  const [visible, setVisible] = useState(true);

  // Update map name when current map changes
  useEffect(() => {
    if (currentMap) {
      setMapName(MapService.getMapName(currentMap));
      // Show the label when map changes
      setVisible(true);

      // Hide after 3 seconds (optional)
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [currentMap]);

  // Also listen for map change events
  useEventBus("map.changed", (mapKey) => {
    if (mapKey) {
      setMapName(MapService.getMapName(mapKey));
      setVisible(true);

      // Hide after 3 seconds (optional)
      setTimeout(() => {
        setVisible(false);
      }, 3000);
    }
  });

  if (!visible || !mapName) return null;

  return <div className="map-name-label">{mapName}</div>;
};

export default MapNameLabel;
