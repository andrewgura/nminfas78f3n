import { useEffect, useState } from "react";
import { useEventBus } from "./useEventBus";
import { PhaserSceneManager } from "@/services/PhaserSceneManager";

export function usePhaserSceneManager() {
  const [currentScene, setCurrentScene] = useState<Phaser.Scene | null>(null);
  const [game, setGame] = useState<Phaser.Game | null>(PhaserSceneManager.getGame());

  // Listen for scene changes
  useEventBus("scene.switched", (scene: Phaser.Scene) => {
    setCurrentScene(scene);
  });

  // Update game reference when PhaserSceneManager is initialized
  useEventBus("phaserSceneManager.initialized", (data: { game: Phaser.Game }) => {
    setGame(data.game);
  });

  // Initialize the scene manager with the game instance when it changes
  useEffect(() => {
    if (game && !PhaserSceneManager.getGame()) {
      PhaserSceneManager.initialize(game);
    }
  }, [game]);

  const registerScenes = (game: Phaser.Game) => {
    PhaserSceneManager.registerScenes(game);
  };

  const startScene = (key: string, data?: any) => {
    PhaserSceneManager.startScene(key, data);
  };

  const stopScene = (key: string) => {
    PhaserSceneManager.stopScene(key);
  };

  const getScene = <T extends Phaser.Scene = Phaser.Scene>(key: string): T | null => {
    return PhaserSceneManager.getScene<T>(key);
  };

  return {
    currentScene,
    game,
    registerScenes,
    startScene,
    stopScene,
    getScene,
    setGameInstance: setGame,
  };
}
