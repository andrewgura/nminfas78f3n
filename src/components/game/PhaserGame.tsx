import { useEmitEvent } from "@/hooks/useEventBus";
import { usePhaserSceneManager } from "@/hooks/usePhaserSceneManager";
import React, { useRef, useEffect } from "react";

interface PhaserGameProps {
  width: number;
  height: number;
}

const PhaserGame: React.FC<PhaserGameProps> = ({ width, height }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const { setGameInstance } = usePhaserSceneManager();
  const emitEvent = useEmitEvent();

  useEffect(() => {
    // Prevent right-click context menu on the canvas
    const preventContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Apply to any existing canvas
    document.querySelectorAll("canvas").forEach((canvas) => {
      canvas.addEventListener("contextmenu", preventContextMenu);
    });

    // Make the canvas accept drops and prevent context menu
    const setupCanvas = () => {
      const canvas = document.querySelector("canvas");
      if (canvas) {
        canvas.addEventListener("dragover", (e) => e.preventDefault());
        canvas.addEventListener("dragenter", (e) => e.preventDefault());
        // Add context menu prevention to newly created canvas
        canvas.addEventListener("contextmenu", preventContextMenu);
      }
    };

    // Run after a short delay to ensure canvas is available
    const timerId = setTimeout(setupCanvas, 500);

    return () => {
      clearTimeout(timerId);
      // Clean up event listeners
      document.querySelectorAll("canvas").forEach((canvas) => {
        canvas.removeEventListener("contextmenu", preventContextMenu);
      });
    };
  }, []);

  // Initialize Phaser game only once
  useEffect(() => {
    if (!gameContainerRef.current || gameInstanceRef.current) return;

    // Clean up any existing canvas
    document.querySelectorAll(".phaser-game-container canvas").forEach((canvas) => canvas.remove());

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: gameContainerRef.current,
      width,
      height,
      pixelArt: true,
      backgroundColor: "#000000",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: width,
        height: height,
      },
      scene: [], // Scenes added by scene manager
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
      },
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    // Update the game instance in the scene manager
    setGameInstance(game);

    // Emit game initialized event
    emitEvent("game.initialized", { game });

    // Clean up on unmount
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, [gameContainerRef, setGameInstance, emitEvent]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!gameInstanceRef.current) return;
      const game = gameInstanceRef.current;
      if (document.hidden) {
        // Pause all active scenes
        game.scene.scenes.forEach((scene) => {
          if (scene.scene.isActive()) {
            game.scene.pause(scene.scene.key);
          }
        });
      } else {
        // Resume all paused scenes
        game.scene.scenes.forEach((scene) => {
          if (scene.scene.isPaused()) {
            game.scene.resume(scene.scene.key);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <div
      ref={gameContainerRef}
      id="game-container"
      className="phaser-game-container"
      style={{ width, height }}
    />
  );
};

export default PhaserGame;
