import { eventBus } from "../utils/EventBus";
import { useGameStore } from "../stores/gameStore";
import { MapTransitionScene } from "@/scenes/MapTransitionScene";
import { BootScene } from "@/scenes/BootScene";
import { GameScene } from "@/scenes/GameScene";

/**
 * Service for managing Phaser scenes and their communication with React
 */
class PhaserSceneManagerService {
  private game: Phaser.Game | null = null;
  private currentScene: Phaser.Scene | null = null;
  private scenesRegistered: boolean = false;
  private initializing: boolean = false;

  /**
   * Initialize with a Phaser game instance
   */
  initialize(game: Phaser.Game): void {
    if (this.initializing) return; // Prevent concurrent initialization
    this.initializing = true;

    try {
      if (this.game) {
        console.warn("A game instance already exists, destroying previous instance");
        this.game.destroy(true);
      }

      this.game = game;

      // Register scenes if not already registered
      this.registerScenes(game);

      // Make sure currentScene is set immediately if a scene is active
      const activeScenes = game.scene.getScenes(true);
      if (activeScenes && activeScenes.length > 0) {
        this.currentScene = activeScenes[0];
      } else {
        console.log("PhaserSceneManager initialized but no active scene found");
      }

      // Listen for scene transitions
      this.setupEventListeners();

      // Emit initialization event
      eventBus.emit("phaserSceneManager.initialized", { game });
    } catch (error) {
      console.error("Error initializing PhaserSceneManager:", error);
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Set up event listeners for scene transitions
   */
  private setupEventListeners(): void {
    if (!this.game) return;

    // Listen for scene transitions using events
    this.game.scene.scenes.forEach((scene) => {
      // When a scene starts or resumes
      scene.events.on("create", () => {
        this.currentScene = scene;
        eventBus.emit("scene.switched", scene);
      });

      // Also track when a scene becomes active
      scene.events.on("start", () => {
        this.currentScene = scene;
        eventBus.emit("scene.started", scene);
      });

      // Track when a scene resumes
      scene.events.on("resume", () => {
        this.currentScene = scene;
        eventBus.emit("scene.resumed", scene);
      });
    });

    // Listen for map change events
    eventBus.on("map.changed", this.handleMapChanged.bind(this));
  }

  /**
   * Handle map change events
   */
  private handleMapChanged(mapKey: string): void {
    // Store might already be updated by the service triggering this event
    // This is just to ensure synchronization
    useGameStore.getState().updatePlayerMap(mapKey);
  }

  /**
   * Get the current active scene
   */
  getCurrentScene<T extends Phaser.Scene = Phaser.Scene>(): T | null {
    // First, use our cached current scene if it's active
    if (this.currentScene && this.currentScene.scene.isActive()) {
      return this.currentScene as T;
    }

    // If cached scene isn't active, try to find an active scene
    if (this.game) {
      // Get all active scenes
      const activeScenes = this.game.scene.getScenes(true);
      if (activeScenes && activeScenes.length > 0) {
        // Update our cached scene
        this.currentScene = activeScenes[0];
        return this.currentScene as T;
      }
    }

    return null;
  }

  /**
   * Get a specific scene by key
   */
  getScene<T extends Phaser.Scene = Phaser.Scene>(key: string): T | null {
    if (!this.game) return null;
    try {
      const scene = this.game.scene.getScene(key);
      return scene as T;
    } catch (error) {
      console.error(`Error getting scene ${key}:`, error);
      return null;
    }
  }

  /**
   * Get the game instance
   */
  getGame(): Phaser.Game | null {
    return this.game;
  }

  /**
   * Register the scenes with the game - only if they haven't been registered yet
   */
  registerScenes(game: Phaser.Game): void {
    // Check if scenes are already registered
    if (this.scenesRegistered) return;

    // If a scene already exists with these keys, don't add them again
    const bootExists = game.scene.getScene("boot");
    const gameExists = game.scene.getScene("game");
    const transitionExists = game.scene.getScene("map-transition");

    // Only add scenes that don't already exist
    if (!bootExists) {
      game.scene.add("boot", BootScene);
    }

    if (!gameExists) {
      game.scene.add("game", GameScene);
    }

    if (!transitionExists) {
      game.scene.add("map-transition", MapTransitionScene);
    }

    // Start the boot scene if it's not already running
    if (game.scene && !game.scene.isActive("boot") && !game.scene.isActive("game")) {
      game.scene.start("boot");
    }

    // Mark scenes as registered
    this.scenesRegistered = true;
  }

  /**
   * Start a scene by key
   */
  startScene(key: string, data?: any): void {
    if (!this.game) return;

    try {
      this.game.scene.start(key, data);
    } catch (error) {
      console.error(`Error starting scene ${key}:`, error);
    }
  }

  /**
   * Stop a scene by key
   */
  stopScene(key: string): void {
    if (!this.game) return;

    try {
      this.game.scene.stop(key);
    } catch (error) {
      console.error(`Error stopping scene ${key}:`, error);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (!this.game) return;

    // Remove event listeners
    this.game.scene.scenes.forEach((scene) => {
      scene.events.off("create");
      scene.events.off("start");
      scene.events.off("resume");
    });

    eventBus.off("map.changed", this.handleMapChanged);

    this.currentScene = null;
    this.game = null;
    this.scenesRegistered = false;
  }
}

// Create singleton instance
export const PhaserSceneManager = new PhaserSceneManagerService();
