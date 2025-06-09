import React, { createContext, useContext, useRef, useState, useEffect } from "react";
import Phaser from "phaser";
import { GameScene } from "@/scenes/GameScene";

interface GameContextValue {
  gameInstance: Phaser.Game | null;
  setGameInstance: (game: Phaser.Game | null) => void;
  currentScene: GameScene | null;
  isGameReady: boolean;
  registerScene: (scene: GameScene) => void;
  unregisterScene: () => void;
}

// Create context with default values
const GameContext = createContext<GameContextValue>({
  gameInstance: null,
  setGameInstance: () => {},
  currentScene: null,
  isGameReady: false,
  registerScene: () => {},
  unregisterScene: () => {},
});

// Custom hook to use the game context
export const useGameContext = () => useContext(GameContext);

// Provider component
export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
  const [isGameReady, setIsGameReady] = useState(false);
  const currentSceneRef = useRef<GameScene | null>(null);

  // Register scene
  const registerScene = (scene: GameScene) => {
    currentSceneRef.current = scene;
    setIsGameReady(true);
  };

  // Unregister scene
  const unregisterScene = () => {
    currentSceneRef.current = null;
    setIsGameReady(false);
  };

  // Effect to update game readiness state
  useEffect(() => {
    if (gameInstance && currentSceneRef.current) {
      setIsGameReady(true);
    } else {
      setIsGameReady(false);
    }
  }, [gameInstance]);

  // Create the context value
  const value = {
    gameInstance,
    setGameInstance,
    currentScene: currentSceneRef.current,
    isGameReady,
    registerScene,
    unregisterScene,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
