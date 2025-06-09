import { useState, useEffect } from "react";
import Phaser from "phaser";
import { BootScene } from "@/scenes/BootScene";
import { GameScene } from "@/scenes/GameScene";
import { MapTransitionScene } from "@/scenes/MapTransitionScene";

interface GameConfig {
  width: number;
  height: number;
  parent: HTMLElement | string;
}

/**
 * Custom hook to initialize and manage a Phaser game instance
 */
const usePhaserGame = (config: GameConfig): Phaser.Game | null => {
  const [game, setGame] = useState<Phaser.Game | null>(null);

  useEffect(() => {
    if (!config.parent) return;

    // Full Phaser game configuration
    const gameConfig: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: config.parent,
      width: config.width,
      height: config.height,
      pixelArt: true,
      backgroundColor: "#000000",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, GameScene, MapTransitionScene],
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
      },
    };

    // Create new Phaser instance
    const newGame = new Phaser.Game(gameConfig);
    setGame(newGame);

    // Clean up on unmount
    return () => {
      if (newGame) {
        newGame.destroy(true);
        setGame(null);
      }
    };
  }, [config.parent, config.width, config.height]);

  return game;
};

export default usePhaserGame;
