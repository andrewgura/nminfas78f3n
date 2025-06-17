import { Component } from "../Component";
import { Character } from "../Character";
import { MovementComponent } from "./MovementComponent";
import { eventBus } from "@/utils/EventBus";
import { useGameStore } from "@/stores/gameStore";
import { autoAttackSystem } from "@/services/AutoAttackSystem";
// REMOVED: import { ChestLootTables } from "@/data/chest-loot-tables";

export class PlayerInputComponent extends Component {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasdKeys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  } | null = null;
  private pickupKey: Phaser.Input.Keyboard.Key | null = null;
  private movementComponent: MovementComponent | null = null;
  private targetingEnabled: boolean = true;

  constructor(entity: Character) {
    super(entity);
  }

  initialize(): void {
    try {
      const keyboard = this.entity.scene.input.keyboard;
      if (!keyboard) return;

      // Setup keyboard controls
      this.cursors = keyboard.createCursorKeys();
      this.wasdKeys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      // Additional keys
      this.pickupKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

      // Get reference to movement component
      this.movementComponent = this.entity.components.get<MovementComponent>("movement") || null;

      // Setup item pickup handler
      keyboard.on("keydown-E", this.handleItemPickup, this);

      // Setup monster targeting with mouse
      this.setupLeftClick();

      // Emit input initialized event
      eventBus.emit("player.input.initialized", {
        entityId: this.entity.id,
      });

      super.initialize();
    } catch (error) {
      console.error("Error initializing PlayerInputComponent:", error);
      eventBus.emit("error.component", {
        entityId: this.entity.id,
        componentId: "PlayerInputComponent",
        error,
      });
    }
  }

  setupLeftClick(): void {
    try {
      // Remove existing listeners
      this.entity.scene.input.off("pointerdown");

      // Set up the unified click handler
      this.entity.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!this.isEnabled || pointer.button !== 0) return;

        const inputFocused = useGameStore.getState().inputFocused;
        if (inputFocused) return;

        // Get world point from screen coordinates
        const worldPoint = this.entity.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // Check what was clicked in priority order
        if (this.targetingEnabled && this.checkMonsterClick(worldPoint)) {
          // Monster was clicked and targeting is enabled
          return;
        }

        // Add additional click handlers here:
        // if (this.checkNPCClick(worldPoint)) return;
        // if (this.checkItemClick(worldPoint)) return;
        if (this.checkChestClick(worldPoint)) return;

        // Nothing was clicked - clear target
        autoAttackSystem.clearTarget();
      });
    } catch (error) {
      console.error("Error setting up interaction system:", error);
    }
  }

  // UPDATED: Replace the entire checkChestClick method with sprite-based detection
  private checkChestClick(worldPoint: Phaser.Math.Vector2): boolean {
    try {
      const gameScene = this.entity.scene as any;

      // Check if GameScene has the sprite-based chest methods
      if (!gameScene.canOpenChestAtPosition) {
        console.warn("GameScene doesn't have sprite-based chest methods");
        return false;
      }

      // Find any chest near the click position
      const chest = gameScene.canOpenChestAtPosition(worldPoint.x, worldPoint.y);

      if (!chest) {
        // No chest found at this position
        return false;
      }

      // Check if player is close enough to the chest
      const playerX = this.entity.x;
      const playerY = this.entity.y;
      const distanceToChest = Phaser.Math.Distance.Between(playerX, playerY, chest.x, chest.y);
      const distanceInTiles = distanceToChest / 32;

      if (distanceInTiles > 1.5) {
        eventBus.emit("ui.message.show", "You are too far away to open this chest");
        return true;
      }

      // Try to open the chest using GameScene's method
      if (gameScene.openChest && gameScene.openChest(chest)) {
        // Chest was successfully opened
        return true;
      } else {
        // Chest couldn't be opened (probably already open)
        eventBus.emit("ui.message.show", "This chest is already open");
        return true;
      }
    } catch (error) {
      console.error("Error checking for chest click:", error);
      return false;
    }
  }

  private checkMonsterClick(worldPoint: Phaser.Math.Vector2): boolean {
    try {
      const gameScene = this.entity.scene as any;
      if (!gameScene.monsters) {
        console.warn("No monsters group found in scene");
        return false;
      }

      // Log debugging information
      const monsters = gameScene.monsters.getChildren();

      let targetedMonster = null;
      let closestDistance = Number.MAX_VALUE;

      for (const monster of monsters) {
        // Skip inactive monsters
        if (!monster.active) continue;

        // Calculate distance to monster center
        const distance = Phaser.Math.Distance.Between(
          worldPoint.x,
          worldPoint.y,
          monster.x,
          monster.y
        );

        // Use a reasonable click radius (monster size + some tolerance)
        const clickRadius = 40; // Adjust based on your monster sprite size

        if (distance <= clickRadius && distance < closestDistance) {
          targetedMonster = monster;
          closestDistance = distance;
        }
      }

      if (targetedMonster) {
        autoAttackSystem.setTarget(targetedMonster);
        // Show a message in UI
        eventBus.emit("ui.message.show", `Attacking ${targetedMonster.monsterName}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking for monster click:", error);
      return false;
    }
  }

  update(time: number, delta: number): void {
    try {
      if (!this.isEnabled) return;

      // Check if input is focused in the UI
      const inputFocused = useGameStore.getState().inputFocused;

      if (!inputFocused) {
        this.handleGridMovement(time);
      }
    } catch (error) {
      console.error("Error in PlayerInputComponent update:", error);
      eventBus.emit("error.component.update", {
        entityId: this.entity.id,
        componentId: "PlayerInputComponent",
        error,
      });
    }
  }

  handleGridMovement(time: number): void {
    try {
      if (!this.movementComponent || !this.cursors || !this.wasdKeys) return;

      const direction = this.getMovementDirection();
      if (!direction.dx && !direction.dy) return;

      const nextPosition = this.getNextPosition(direction.dx, direction.dy);

      if (this.movementComponent.isValidMove(this.entity.scene, nextPosition.x, nextPosition.y)) {
        this.movementComponent.moveToPosition(nextPosition.x, nextPosition.y, time);

        // Emit movement input event
        eventBus.emit("player.input.movement", {
          entityId: this.entity.id,
          direction: this.movementComponent.facing,
          isMoving: true,
        });
      } else {
        // Even if movement is blocked, we still want to play the animation in the facing direction
        const character = this.entity as any;
        if (character && typeof character.playAnimation === "function") {
          // Get the current facing direction from movementComponent
          const currentDirection = this.movementComponent.facing;
          // Play idle animation in the facing direction
          character.playAnimation(currentDirection, false);

          // Emit direction change event
          eventBus.emit("player.direction.changed", {
            entityId: this.entity.id,
            direction: currentDirection,
            isMoving: false,
          });
        }
      }
    } catch (error) {
      console.error("Error in PlayerInputComponent.handleGridMovement:", error);
      eventBus.emit("error.player.movement", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  private getMovementDirection(): { dx: number; dy: number } {
    let dx = 0,
      dy = 0;
    let direction = "";
    let isMoving = false;

    if (!this.cursors || !this.wasdKeys || !this.movementComponent) {
      return { dx, dy };
    }

    // Get character reference
    const character = this.entity as any;

    if (this.cursors.left.isDown || this.wasdKeys.left.isDown) {
      dx = -1;
      direction = "left";
      isMoving = true;
    } else if (this.cursors.right.isDown || this.wasdKeys.right.isDown) {
      dx = 1;
      direction = "right";
      isMoving = true;
    } else if (this.cursors.up.isDown || this.wasdKeys.up.isDown) {
      dy = -1;
      direction = "up";
      isMoving = true;
    } else if (this.cursors.down.isDown || this.wasdKeys.down.isDown) {
      dy = 1;
      direction = "down";
      isMoving = true;
    } else {
      // No movement, use current facing direction for idle animation
      direction = this.movementComponent.facing;
      isMoving = false;
    }

    // Update the movement component's facing direction
    this.movementComponent.facing = direction;

    // Play appropriate animation if we have access to the method
    if (character && typeof character.playAnimation === "function") {
      character.playAnimation(direction, isMoving);

      // Only emit direction change if not moving to avoid spamming
      if (!isMoving && direction !== this.movementComponent.facing) {
        eventBus.emit("player.direction.changed", {
          entityId: this.entity.id,
          direction,
          isMoving,
        });
      }
    }

    return { dx, dy };
  }

  private getNextPosition(dx: number, dy: number): { x: number; y: number } {
    if (!this.movementComponent) {
      return { x: this.entity.x, y: this.entity.y };
    }

    const tileSize = this.movementComponent.tileSize;

    return {
      x: Math.floor(this.entity.x / tileSize) * tileSize + tileSize / 2 + dx * tileSize,
      y: Math.floor(this.entity.y / tileSize) * tileSize + tileSize / 2 + dy * tileSize,
    };
  }

  handleItemPickup(): void {
    try {
      const interactionComponent = this.entity.components.get("interaction");
      if (
        interactionComponent &&
        typeof (interactionComponent as any).pickupNearbyItem === "function"
      ) {
        (interactionComponent as any).pickupNearbyItem();

        // Emit item pickup event
        eventBus.emit("player.item.pickup.attempt", {
          entityId: this.entity.id,
        });
      }
    } catch (error) {
      console.error("Error in PlayerInputComponent.handleItemPickup:", error);
      eventBus.emit("error.player.pickup", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  enableTargeting(): void {
    this.targetingEnabled = true;
  }

  disableTargeting(): void {
    this.targetingEnabled = false;
  }

  destroy(): void {
    try {
      // Remove keyboard listeners
      if (this.entity.scene.input.keyboard) {
        this.entity.scene.input.keyboard.off("keydown-E", this.handleItemPickup, this);
      }

      // Remove pointer listeners
      this.entity.scene.input.off("pointerdown");

      this.cursors = null;
      this.wasdKeys = null;
      this.pickupKey = null;
      super.destroy();
    } catch (error) {
      console.error("Error destroying PlayerInputComponent:", error);
      eventBus.emit("error.component.destroy", {
        entityId: this.entity.id,
        componentId: "PlayerInputComponent",
        error,
      });
    }
  }
}
