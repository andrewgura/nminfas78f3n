import Phaser from "phaser";
import { useGameStore } from "../stores/gameStore";
import { eventBus } from "../utils/EventBus";

export class MapTransitionScene extends Phaser.Scene {
  private targetMap: string = "";
  private targetX: number = 0;
  private targetY: number = 0;
  private message: string = "";

  constructor() {
    super({ key: "map-transition" });
  }

  init(data: { targetMap: string; targetX: number; targetY: number; message?: string }): void {
    this.targetMap = data.targetMap;
    this.targetX = data.targetX;
    this.targetY = data.targetY;
    this.message = data.message || "";
  }

  create(): void {
    // Create a black screen for the transition
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

    // Update the game state with the new map and position
    const store = useGameStore.getState();
    store.updatePlayerMap(this.targetMap);

    // Set teleport position
    store.playerCharacter.teleportPosition = {
      x: this.targetX,
      y: this.targetY,
    };

    // Emit map change event
    eventBus.emit("map.changed", this.targetMap);

    // Emit message if provided
    if (this.message) {
      eventBus.emit("ui.message.show", this.message);
    }

    // Wait a short time to ensure everything is properly cleaned up
    this.time.delayedCall(100, () => {
      // Stop the current game scene and start a new one
      this.scene.stop("game");

      // Create a new game scene
      this.scene.start("game");

      // When the game scene is ready, remove this transition scene
      this.scene.get("game").events.once("create", () => {
        this.scene.stop();
      });
    });
  }
}
