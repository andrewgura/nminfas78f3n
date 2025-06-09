import { Character } from "./Character";
import { HealthComponent } from "./HealthComponent";
import { NPCDialogComponent } from "./npc/NPCDialogComponent";
import { eventBus } from "@/utils/EventBus";
import { ShopItem } from "@/services/NPCService";

export interface NPCData {
  id: string;
  name: string;
  texture: string;
  dialog?: string[];
  interactionRadius?: number;
  isMerchant?: boolean;
  shopItems?: ShopItem[];
}

export class NPC extends Character {
  npcName: string = "";
  facing: string = "down";
  dialogData: string[] = [];
  interactionRadius: number = 64;
  isMerchant: boolean = false;
  shopItems: ShopItem[] = [];

  // UI elements

  private merchantIcon: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, npcData: NPCData) {
    // Call the parent constructor with the provided texture
    super(scene, x, y, npcData.texture || "playerCharacter", npcData.id);

    try {
      // Set NPC properties
      this.id = npcData.id;
      this.npcName = npcData.name || "Unnamed NPC";
      this.dialogData = npcData.dialog || ["Hello, adventurer!"];
      this.interactionRadius = npcData.interactionRadius || 64;
      this.isMerchant = npcData.isMerchant || false;
      this.shopItems = npcData.shopItems || [];

      // Set origin to center the sprite on the tile
      this.setOrigin(0.8, 0.8);

      // Add components
      this.addComponents();

      // Set up interaction zone
      this.createInteractionZone();

      // Create visual elements
      if (this.isMerchant) {
        this.createMerchantIcon();
      }

      // Set up click interaction with proper right-click handling
      this.setInteractive();

      // Handle both left and right clicks
      this.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        // Prevent default behavior for right-click
        if (pointer.rightButtonDown()) {
          if (pointer.event) {
            pointer.event.preventDefault();
            pointer.event.stopPropagation();
          }
        }
        this.handleClick();
      });

      // Add a specific handler for right-click context menu prevention
      this.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonReleased() && pointer.event) {
          pointer.event.preventDefault();
          return false;
        }
      });

      // Set default animation
      this.playAnimation("down", false);

      // Emit NPC created event
      eventBus.emit("npc.created", {
        id: this.id,
        name: this.npcName,
        isMerchant: this.isMerchant,
        position: { x: this.x, y: this.y },
      });
    } catch (error) {
      console.error(`Error creating NPC ${npcData.id}:`, error);
      eventBus.emit("error.npc.create", {
        id: npcData.id,
        error,
      });
    }
  }

  private addComponents(): void {
    try {
      // Health component (NPCs typically don't need health, but inheriting from Character requires it)
      this.components.add("health", new HealthComponent(this));

      // Dialog component
      const dialogComponent = new NPCDialogComponent(this, this.dialogData);
      this.components.add("dialog", dialogComponent);
    } catch (error) {
      console.error(`Error adding components to NPC ${this.id}:`, error);
      eventBus.emit("error.npc.components", {
        id: this.id,
        error,
      });
    }
  }

  private createInteractionZone(): void {
    try {
      // Create a circle for interaction detection
      const interactionZone = this.scene.add.circle(
        this.x,
        this.y,
        this.interactionRadius,
        0xffffff,
        0.1
      );

      // Make it invisible in the game
      interactionZone.setVisible(false);

      // Add physics to the interaction zone
      this.scene.physics.add.existing(interactionZone, true);

      // Store the interaction zone
      (this as any).interactionZone = interactionZone;
    } catch (error) {
      console.error(`Error creating interaction zone for NPC ${this.id}:`, error);
      eventBus.emit("error.npc.interactionZone", {
        id: this.id,
        error,
      });
    }
  }

  private createMerchantIcon(): void {
    try {
      // Use a coin symbol as merchant icon with improved styling
      this.merchantIcon = this.scene.add.text(this.x, this.y - 65, "💰", {
        fontSize: "20px", // Larger size
        shadow: {
          offsetX: 1,
          offsetY: 1,
          color: "#000",
          blur: 2,
          fill: true,
        },
      });

      this.merchantIcon.setOrigin(0.5);
      this.merchantIcon.setDepth(10);

      // More pronounced floating animation
      this.scene.tweens.add({
        targets: this.merchantIcon,
        y: this.y - 70,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } catch (error) {
      console.error(`Error creating merchant icon for NPC ${this.id}:`, error);
      eventBus.emit("error.npc.merchantIcon", {
        id: this.id,
        error,
      });
    }
  }

  private handleClick(): void {
    try {
      // Check distance to player
      const scene = this.scene as any;
      if (!scene.playerCharacter) return;

      const player = scene.playerCharacter;
      const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

      // If player is within interaction radius and this is a merchant, open shop
      if (distance <= this.interactionRadius && this.isMerchant) {
        this.openShop();
      } else if (distance <= this.interactionRadius) {
        // For non-merchants, just show dialog
        this.interact();
      }
    } catch (error) {
      console.error(`Error handling click for NPC ${this.id}:`, error);
      eventBus.emit("error.npc.click", {
        id: this.id,
        error,
      });
    }
  }

  openShop(): void {
    try {
      if (!this.isMerchant || this.shopItems.length === 0) {
        // If not a merchant or no items to sell, just show dialog
        this.interact();
        return;
      }

      // Emit an event that the shop UI can listen to
      eventBus.emit("shop.open", {
        npcId: this.id,
        npcName: this.npcName,
        shopItems: this.shopItems,
      });
    } catch (error) {
      console.error(`Error opening shop for NPC ${this.id}:`, error);
      eventBus.emit("error.npc.shop", {
        id: this.id,
        error,
      });
    }
  }

  playAnimation(direction: string, isMoving: boolean = false): void {
    try {
      // Update facing direction if specified
      if (direction) {
        this.facing = direction;
      }

      // Construct animation key (always use idle since NPCs are stationary)
      const animKey = `idle-${this.facing}`;

      // Only play animation if it's not already playing
      if (!this.anims.isPlaying || this.anims.currentAnim?.key !== animKey) {
        this.anims.play(animKey, true);

        // Emit animation event
        eventBus.emit("npc.animation", {
          id: this.id,
          direction: this.facing,
          isMoving: isMoving,
        });
      }
    } catch (error) {
      console.error(`Error playing animation for NPC ${this.id}:`, error);
      eventBus.emit("error.npc.animation", {
        id: this.id,
        error,
      });
    }
  }

  interact(): void {
    try {
      const dialogComponent = this.components.get<NPCDialogComponent>("dialog");
      if (dialogComponent) {
        dialogComponent.startDialog();

        // Emit interaction event
        eventBus.emit("npc.interacted", {
          id: this.id,
          name: this.npcName,
        });
      }
    } catch (error) {
      console.error(`Error interacting with NPC ${this.id}:`, error);
      eventBus.emit("error.npc.interact", {
        id: this.id,
        error,
      });
    }
  }

  update(time: number, delta: number): void {
    try {
      // Update all components
      super.update(time, delta);

      // Update interaction zone position
      if ((this as any).interactionZone) {
        (this as any).interactionZone.x = this.x;
        (this as any).interactionZone.y = this.y;
      }

      // Update merchant icon position (x only since y is animated)
      if (this.merchantIcon) {
        this.merchantIcon.setX(this.x);
      }
    } catch (error) {
      console.error(`Error in NPC ${this.id} update:`, error);
      eventBus.emit("error.npc.update", {
        id: this.id,
        error,
      });
    }
  }

  destroy(): void {
    try {
      // Remove pointer interactivity
      this.off("pointerdown");
      this.off("pointerup");
      this.disableInteractive();

      // Destroy interaction zone
      if ((this as any).interactionZone) {
        (this as any).interactionZone.destroy();
      }

      // Destroy merchant icon
      if (this.merchantIcon) {
        this.merchantIcon.destroy();
        this.merchantIcon = null;
      }

      // Emit destroy event
      eventBus.emit("npc.destroyed", {
        id: this.id,
        name: this.npcName,
      });

      // Call parent destroy to clean up components
      super.destroy();
    } catch (error) {
      console.error(`Error destroying NPC ${this.id}:`, error);
      eventBus.emit("error.npc.destroy", {
        id: this.id,
        error,
      });
    }
  }
}
