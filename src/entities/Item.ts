import { ItemDictionary } from "@/services/ItemDictionaryService";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import { eventBus } from "@/utils/EventBus";
import { useGameStore } from "@/stores/gameStore";
import Phaser from "phaser";
import { ItemBonusStats } from "@/types";

export class Item extends Phaser.Physics.Arcade.Sprite {
  templateId!: string;
  instanceId!: string;
  itemType!: string;
  declare name: string;
  isPickupable!: boolean;
  isHighlighted!: boolean;
  isHovered!: boolean;
  glowSprite!: Phaser.GameObjects.Sprite | null;
  hoverEndTimer!: Phaser.Time.TimerEvent | null;
  bonusStats?: ItemBonusStats;
  isSetItem: boolean = false;
  setType?: string;
  sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  sparkleGraphics: Phaser.GameObjects.Graphics | null = null;
  quantity?: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    templateId: string,
    instanceId: string,
    bonusStats?: ItemBonusStats,
    quantity?: number
  ) {
    // Create an item instance object for consistent handling
    const instance = {
      templateId,
      instanceId,
      bonusStats,
    };

    // Get combined stats that include bonus stats if any
    const itemData = ItemInstanceManager.getCombinedStats(instance);

    // Get the texture (fall back to ItemDictionary if needed)
    const texture = itemData?.texture
      ? ItemDictionary.getItemTexture(templateId)
      : "item-placeholder";

    // Super call must be first, before any other logic
    super(scene, x, y, texture);

    try {
      // Add to scene and enable physics
      scene.add.existing(this);
      scene.physics.add.existing(this);

      // Item properties
      this.templateId = templateId;
      this.instanceId = instanceId;
      this.itemType = ItemDictionary.getItemType(templateId);
      this.bonusStats = bonusStats;
      this.quantity = quantity;

      // Check if this is a set item
      this.isSetItem = !!itemData?.set;
      this.setType = itemData?.set;

      // Always use ItemInstanceManager for name display
      this.name = ItemInstanceManager.getDisplayName(instance);

      this.isPickupable = true;
      this.isHighlighted = false;

      // Hover-related properties
      this.isHovered = false;
      this.glowSprite = null;
      this.hoverEndTimer = null;
      this.sparkleEmitter = null;
      this.sparkleGraphics = null;

      // Set display properties based on item type
      this.configureItemAppearance();

      // Add floating effect
      this.startFloatingEffect();

      // Add appropriate sparkle effect based on item properties
      this.addSparkleEffect();

      // Setup direct overlap with playerCharacter
      this.setupDirectPlayerCharacterInteraction();

      // Emit item created event
      eventBus.emit("item.created", {
        id: this.instanceId,
        templateId: this.templateId,
        name: this.name,
        position: { x: this.x, y: this.y },
        isSetItem: this.isSetItem,
        setType: this.setType,
        bonusStats: this.bonusStats,
      });
    } catch (error) {
      console.error(`Error creating item ${templateId}:`, error);
      eventBus.emit("error.item.create", {
        templateId,
        instanceId,
        error,
      });
    }
  }

  setupDirectPlayerCharacterInteraction(): void {
    try {
      if (this.scene && (this.scene as any).playerCharacter) {
        // Create direct overlap with playerCharacter sprite
        this.scene.physics.add.overlap(this, (this.scene as any).playerCharacter, () => {
          // When playerCharacter directly overlaps with item, add to nearby items
          if (
            (this.scene as any).playerCharacter &&
            !(this.scene as any).playerCharacter.nearbyItems.includes(this)
          ) {
            (this.scene as any).playerCharacter.addNearbyItem(this);
            this.highlightItem();
          }
        });
      } else {
        // Try again later if playerCharacter isn't available yet
        this.scene.time.delayedCall(500, this.setupDirectPlayerCharacterInteraction, [], this);
      }
    } catch (error) {
      console.error(`Error setting up player interaction for item ${this.instanceId}:`, error);
      eventBus.emit("error.item.interaction", {
        instanceId: this.instanceId,
        error,
      });
    }
  }

  highlightItem(): void {
    try {
      if (!this.isHighlighted) {
        this.isHighlighted = true;
        this.setTint(0xffff00); // Yellow highlight

        // Try to add some animation for better visibility
        this.scene.tweens.add({
          targets: this,
          angle: { from: -3, to: 3 },
          duration: 800,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });

        // Show pickup hint through event system
        if ((this.scene as any).playerCharacter.nearbyItems.length === 1) {
          eventBus.emit("ui.message.show", "Press E to pick up item");
        }

        // Emit highlight event
        eventBus.emit("item.highlighted", {
          id: this.instanceId,
          name: this.name,
        });
      }
    } catch (error) {
      console.error(`Error highlighting item ${this.instanceId}:`, error);
      eventBus.emit("error.item.highlight", {
        instanceId: this.instanceId,
        error,
      });
    }
  }

  configureItemAppearance(): void {
    try {
      this.setScale(1);

      // Make sure physics body is appropriate size for easier pickup
      if (this.body) {
        this.body.setSize(48, 48);
        this.body.setOffset(-8, -8);
      }

      this.setDepth(5); // Above ground but below playerCharacter
    } catch (error) {
      console.error(`Error configuring item appearance for ${this.instanceId}:`, error);
      eventBus.emit("error.item.appearance", {
        instanceId: this.instanceId,
        error,
      });
    }
  }

  startFloatingEffect(): void {
    try {
      // Create a gentle floating effect
      this.scene.tweens.add({
        targets: this,
        y: this.y - 2,
        duration: 1200,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    } catch (error) {
      console.error(`Error starting float effect for item ${this.instanceId}:`, error);
      eventBus.emit("error.item.float", {
        instanceId: this.instanceId,
        error,
      });
    }
  }

  // Add sparkle effects for special items
  addSparkleEffect(): void {
    try {
      const hasBonusStats = this.bonusStats && Object.keys(this.bonusStats).length > 0;

      if (hasBonusStats || this.isSetItem) {
        // Create sparkle graphics object
        this.sparkleGraphics = this.scene.add.graphics();

        // Set up animation ticker
        this.scene.time.addEvent({
          delay: 100,
          callback: () => {
            if (!this.active || !this.sparkleGraphics) return;

            // Clear previous graphics
            this.sparkleGraphics.clear();

            // Draw new sparkles
            for (let i = 0; i < 3; i++) {
              const angle = Math.random() * Math.PI * 2;
              const distance = Math.random() * 15 + 5;
              const x = this.x + Math.cos(angle) * distance;
              const y = this.y + Math.sin(angle) * distance;
              const size = Math.random() * 2 + 1;

              // Set color based on item type
              if (this.isSetItem && hasBonusStats) {
                // Alternate colors
                const color = i % 2 === 0 ? 0x3498db : 0x2ecc71;
                this.sparkleGraphics.fillStyle(color, 0.7);
              } else if (this.isSetItem) {
                // Green for set items
                this.sparkleGraphics.fillStyle(0x2ecc71, 0.7);
              } else if (hasBonusStats) {
                // Blue for bonus items
                this.sparkleGraphics.fillStyle(0x3498db, 0.7);
              }

              this.sparkleGraphics.fillCircle(x, y, size);
            }
          },
          callbackScope: this,
          loop: true,
        });
      }
    } catch (error) {
      console.error(`Error adding sparkle effect to item ${this.instanceId}:`, error);
      eventBus.emit("error.item.sparkle", {
        instanceId: this.instanceId,
        error,
      });
    }
  }

  removeHighlight(): void {
    try {
      // Remove highlight effect
      this.isHighlighted = false;
      this.clearTint();
      this.setAngle(0);

      // Stop any running tweens
      if (this.scene) {
        this.scene.tweens.killTweensOf(this);
      }

      // Restart the floating effect
      this.startFloatingEffect();

      // Emit unhighlight event
      eventBus.emit("item.unhighlighted", {
        id: this.instanceId,
        name: this.name,
      });
    } catch (error) {
      console.error(`Error removing highlight from item ${this.instanceId}:`, error);
      eventBus.emit("error.item.unhighlight", {
        instanceId: this.instanceId,
        error,
      });
    }
  }

  update(): void {
    try {
      // Check if playerCharacter is still nearby
      if (this.scene && (this.scene as any).playerCharacter) {
        const distance = Phaser.Math.Distance.Between(
          this.x,
          this.y,
          (this.scene as any).playerCharacter.x,
          (this.scene as any).playerCharacter.y
        );

        // If playerCharacter is close, make sure we're in their nearby items
        if (distance <= 50) {
          if (!(this.scene as any).playerCharacter.nearbyItems.includes(this)) {
            (this.scene as any).playerCharacter.addNearbyItem(this);
            this.highlightItem();
          }
        }
        // If playerCharacter is far away, remove from nearby items
        else if (distance > 60) {
          if (this.isHighlighted) {
            this.removeHighlight();
          }

          if ((this.scene as any).playerCharacter.nearbyItems.includes(this)) {
            // PlayerCharacter moved away, remove from nearby items
            (this.scene as any).playerCharacter.removeNearbyItem(this);
          }
        }
      }

      // Update glow sprite position if it exists
      if (this.isHovered && this.glowSprite) {
        this.glowSprite.x = this.x;
        this.glowSprite.y = this.y;
      }
    } catch (error) {
      // Silent fail for update - happens too frequently to log
    }
  }

  destroy(fromScene?: boolean): void {
    try {
      // Clean up hover effects before destroying
      if (this.isHovered) {
        this.clearHoverState();

        // Notify hover system if this item is currently being hovered
        const itemHoverSystem = useGameStore.getState().systems?.itemHoverSystem;
        if (itemHoverSystem?.currentHoveredItem === this) {
          itemHoverSystem.currentHoveredItem = null;
        }
      }

      if (this.glowSprite) {
        this.glowSprite.destroy();
        this.glowSprite = null;
      }

      // Clean up particle emitter
      if (this.sparkleEmitter) {
        this.sparkleEmitter.destroy();
        this.sparkleEmitter = null;
      }

      // Clean up graphics
      if (this.sparkleGraphics) {
        this.sparkleGraphics.destroy();
        this.sparkleGraphics = null;
      }

      // Emit item destroyed event
      eventBus.emit("item.destroyed", {
        id: this.instanceId,
        templateId: this.templateId,
        name: this.name,
      });

      // Call the parent destroy method
      super.destroy(fromScene);
    } catch (error) {
      console.error(`Error destroying item ${this.instanceId}:`, error);
      eventBus.emit("error.item.destroy", {
        instanceId: this.instanceId,
        error,
      });
    }
  }

  // The following methods are included to satisfy the interface,
  // and you should implement the full versions from your original code
  // (I'm abbreviating them to fit within the response limit)

  clearHoverState(): void {
    try {
      if (!this.isHovered) return;

      // Set hover state to false
      this.isHovered = false;

      // Hide tooltip
      eventBus.emit("item.world.tooltip.hide", {
        id: this.instanceId,
      });

      // Remove glow effect
      if (this.glowSprite) {
        this.glowSprite.destroy();
        this.glowSprite = null;
      }

      // Clear any hover timers
      if (this.hoverEndTimer) {
        this.hoverEndTimer.remove();
        this.hoverEndTimer = null;
      }

      // Emit hover end event
      eventBus.emit("item.hover.end", {
        id: this.instanceId,
        name: this.name,
      });
    } catch (error) {
      console.error(`Error clearing hover state for item ${this.instanceId}:`, error);
    }
  }

  showTooltip(): void {
    try {
      // Create tooltip logic
      eventBus.emit("item.tooltip.show", {
        id: this.instanceId,
        templateId: this.templateId,
        name: this.name,
        bonusStats: this.bonusStats,
        isSetItem: this.isSetItem,
        setType: this.setType,
      });
    } catch (error) {
      console.error(`Error showing tooltip for item ${this.instanceId}:`, error);
    }
  }

  hideTooltip(): void {
    try {
      eventBus.emit("item.tooltip.hide", {
        id: this.instanceId,
      });
    } catch (error) {
      console.error(`Error hiding tooltip for item ${this.instanceId}:`, error);
    }
  }

  applyGlowEffect(): void {
    try {
      // Apply glow effect logic
      eventBus.emit("item.glow.start", {
        id: this.instanceId,
        name: this.name,
      });
    } catch (error) {
      console.error(`Error applying glow to item ${this.instanceId}:`, error);
    }
  }

  removeGlowEffect(): void {
    try {
      // Remove glow effect logic
      eventBus.emit("item.glow.end", {
        id: this.instanceId,
        name: this.name,
      });
    } catch (error) {
      console.error(`Error removing glow from item ${this.instanceId}:`, error);
    }
  }
}
