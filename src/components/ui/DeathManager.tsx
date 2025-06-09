import React, { useState } from "react";
import { useEventBus, useEmitEvent } from "../../hooks/useEventBus";

const DeathManager: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [respawnPoint, setRespawnPoint] = useState({ x: 1545, y: 2570 }); // Default respawn point
  const emitEvent = useEmitEvent();

  // Listen for player death event
  useEventBus("player.died", () => {
    setVisible(true);
  });

  // Handle respawn button click
  const handleRespawn = () => {
    // Hide dialog
    setVisible(false);

    // Emit respawn event
    emitEvent("player.respawn", respawnPoint);

    // Show message
    emitEvent("ui.message.show", "You have been respawned.");
  };

  // Update respawn point
  const updateRespawnPoint = (x: number, y: number) => {
    setRespawnPoint({ x, y });
  };

  if (!visible) {
    return null;
  }

  return (
    <div id="respawn-dialog" className="respawn-dialog">
      <div className="respawn-dialog-content">
        <h2 className="respawn-title">You have died!</h2>
        <p className="respawn-message">Your character has fallen in battle.</p>
        <div className="respawn-buttons">
          <button id="respawn-button" className="respawn-button" onClick={handleRespawn}>
            Respawn
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeathManager;
