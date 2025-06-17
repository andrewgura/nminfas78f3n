import { MovementComponent } from "../player/MovementComponent";
import { Monster } from "../Monster";
import { MonsterAttackType } from "@/types";
import { eventBus } from "@/utils/EventBus";
import { MapService } from "@/services/MapService";
import { useGameStore } from "@/stores/gameStore";

export class MonsterMovementComponent extends MovementComponent {
  private speed: number = 120; // FIXED: Add monster-specific speed property
  private isAggressive: boolean = false;
  private isProvoked: boolean = false;
  private runawayPercent: number = 0;
  private aggroRange: number = 800; // 25 tiles
  private preferredDistance: number = 32; // Default 1 tile for melee
  private loseAggroRange: number = 800; // 25 tiles - distance to lose aggro
  public isMoving: boolean = false;
  private attackType: string = "melee";
  private initialPosition: { x: number; y: number } = { x: 0, y: 0 };
  private wanderRange: number = 128;
  private wanderTimer: Phaser.Time.TimerEvent | null = null;
  private moveInProgress: boolean = false;
  private continuousPursuit: boolean = false;

  // Movement parameters
  private moveChance: number = 0.8; // Increased chance to move
  private decisionDelay: number = 500; // Faster decisions for ranged/magic
  private lastDecisionTime: number = 0;
  private moveInterval: number = 1000; // Faster movement interval for ranged/magic

  constructor(entity: Monster, speed: number = 120, isAggressive: boolean = false) {
    super(entity);

    // FIXED: Store monster speed from MonsterDictionary
    this.speed = speed;
    this.isAggressive = isAggressive;

    // Override parent's moveSpeed for monsters
    (this as any).moveSpeed = speed;

    if (!isAggressive) {
      this.setupWanderingBehavior();
    }

    // Emit initialization event
    eventBus.emit("monster.movement.initialized", {
      entityId: this.entity.id,
      isAggressive,
      speed: this.speed,
      attackType: this.attackType,
    });
  }

  get monster(): Monster {
    return this.entity as Monster;
  }

  /**
   * Override parent getMoveSpeed to return monster speed
   */
  getMoveSpeed(): number {
    return this.speed;
  }

  /**
   * Convert Tiled tile coordinates to world coordinates using MapService
   */
  private tiledTileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      if (!MapService.tiledToPhaser || !currentMap) {
        throw new Error("MapService not available");
      }

      return MapService.tiledToPhaser(currentMap, tileX, tileY);
    } catch (error) {
      // Fallback to basic coordinate math
      return {
        x: tileX * this.tileSize + this.tileSize / 2,
        y: tileY * this.tileSize + this.tileSize / 2,
      };
    }
  }

  /**
   * Convert world coordinates to Tiled tile coordinates using MapService
   */
  private worldToTiledTile(worldX: number, worldY: number): { x: number; y: number } {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      if (!MapService.phaserToTiled || !currentMap) {
        throw new Error("MapService not available");
      }

      return MapService.phaserToTiled(currentMap, worldX, worldY);
    } catch (error) {
      // Fallback to basic tile math during map transitions
      return {
        x: Math.floor(worldX / this.tileSize),
        y: Math.floor(worldY / this.tileSize),
      };
    }
  }

  setAggression(aggressive: boolean): void {
    this.isAggressive = aggressive;

    if (!aggressive && !this.wanderTimer) {
      this.setupWanderingBehavior();
    } else if (aggressive && this.wanderTimer) {
      this.wanderTimer.remove();
      this.wanderTimer = null;
    }

    // Emit aggression state event
    eventBus.emit("monster.movement.aggression", {
      entityId: this.entity.id,
      isAggressive: aggressive,
    });
  }

  setProvokedState(provoked: boolean): void {
    this.isProvoked = provoked;

    if (provoked && this.wanderTimer) {
      this.wanderTimer.remove();
      this.wanderTimer = null;
    }

    // Emit provoked state event
    eventBus.emit("monster.movement.provoked", {
      entityId: this.entity.id,
      isProvoked: provoked,
    });
  }

  setAggroRange(range: number): void {
    this.aggroRange = range;
  }

  setInitialPosition(x: number, y: number): void {
    this.initialPosition = { x, y };
  }

  setAttackTypeAndDistance(attackType: string): void {
    this.attackType = attackType;

    if (attackType === MonsterAttackType.Magic) {
      this.preferredDistance = 160; // 5 tiles for magic
    } else if (attackType === MonsterAttackType.Ranged) {
      this.preferredDistance = 160; // 5 tiles for ranged
    } else {
      this.preferredDistance = 32; // 1 tile for melee
    }

    // Emit attack type update event
    eventBus.emit("monster.movement.attackType", {
      entityId: this.entity.id,
      attackType,
      preferredDistance: this.preferredDistance,
    });
  }

  private setupWanderingBehavior(): void {
    if (!this.isAggressive && !this.isProvoked) {
      if (this.wanderTimer) {
        this.wanderTimer.remove();
      }

      this.wanderTimer = this.entity.scene.time.addEvent({
        delay: 5000 + Math.random() * 2000,
        callback: this.wander,
        callbackScope: this,
        loop: true,
      });
    }
  }

  /**
   * FIXED: Move to tile with proper speed handling - matches parent signature
   */
  moveToTile(tileX: number, tileY: number): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        if (this.moveInProgress) {
          resolve();
          return;
        }

        this.moveInProgress = true;

        const worldPos = this.tiledTileToWorld(tileX, tileY);

        // Calculate direction for animation
        const currentTiledTile = this.worldToTiledTile(this.entity.x, this.entity.y);
        const dx = tileX - currentTiledTile.x;
        const dy = tileY - currentTiledTile.y;

        let direction = "";
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? "right" : "left";
        } else {
          direction = dy > 0 ? "down" : "up";
        }

        this.isMoving = true;

        (this.entity as Monster).playAnimation(direction, true);

        // Emit movement start event
        eventBus.emit("monster.movement.start", {
          entityId: this.entity.id,
          direction,
          targetPosition: { x: worldPos.x, y: worldPos.y },
        });

        // FIXED: Calculate duration based on monster's speed
        let moveDuration = 400; // Base duration
        const baseMoveSpeed = 120; // Base monster speed
        moveDuration = moveDuration * (baseMoveSpeed / this.speed);

        // If it's a ranged or magic monster maintaining distance, move faster
        if (
          (this.attackType === MonsterAttackType.Magic ||
            this.attackType === MonsterAttackType.Ranged) &&
          (this.isAggressive || this.isProvoked)
        ) {
          moveDuration *= 0.8; // 20% faster
        }

        this.entity.scene.tweens.add({
          targets: this.entity,
          x: worldPos.x,
          y: worldPos.y,
          duration: Math.max(50, moveDuration),
          ease: "Linear",
          onComplete: () => {
            this.isMoving = false;
            this.moveInProgress = false;

            // Emit movement complete event
            eventBus.emit("monster.movement.complete", {
              entityId: this.entity.id,
              position: { x: worldPos.x, y: worldPos.y },
            });

            if (this.continuousPursuit && (this.isAggressive || this.isProvoked)) {
              // For all monster types, continue pursuit if needed
              this.continuePursuit();
            } else if (this.isAggressive || this.isProvoked) {
              this.facePlayer();
            } else {
              (this.entity as Monster).playAnimation(direction, false);
            }

            resolve();
          },
        });
      } catch (error) {
        this.moveInProgress = false;
        this.isMoving = false;
        console.error(`Error in monster ${this.entity.id} moveToTile:`, error);
        eventBus.emit("error.monster.move", {
          entityId: this.entity.id,
          error,
        });
        resolve();
      }
    });
  }

  /**
   * Monster-specific move method with continuous pursuit support
   */
  moveToTileWithPursuit(
    tileX: number,
    tileY: number,
    isContinuous: boolean = false
  ): Promise<void> {
    this.continuousPursuit = isContinuous;
    return this.moveToTile(tileX, tileY);
  }

  // Continue pursuit without delay for all aggressive monsters
  private continuePursuit(): void {
    try {
      // FIXED: Add validation check to prevent the error
      if (!this.entity || !this.entity.scene || !this.entity.active || this.monster.isDead) {
        return;
      }

      const gameScene = this.entity.scene as any;
      if (!gameScene || !gameScene.playerCharacter) return;

      const player = gameScene.playerCharacter;

      const distance = Phaser.Math.Distance.Between(
        this.entity.x,
        this.entity.y,
        player.x,
        player.y
      );

      // Different behavior based on attack type
      if (this.attackType === MonsterAttackType.Melee) {
        // Melee monsters always chase until in range
        if (distance > this.preferredDistance) {
          this.continueChasing();
        } else {
          this.facePlayer();
        }
      } else if (
        this.attackType === MonsterAttackType.Magic ||
        this.attackType === MonsterAttackType.Ranged
      ) {
        // If too close to player, retreat
        if (distance < this.preferredDistance * 0.8) {
          this.continueRetreating();
        }
        // If too far from player, chase
        else if (distance > this.preferredDistance * 1.2) {
          this.continueChasing();
        }
        // If at good distance, face player
        else {
          this.facePlayer();
        }
      }
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} continuePursuit:`, error);
      eventBus.emit("error.monster.pursuit", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  private continueChasing(): void {
    const move = this.calculateNextMove(true);
    if (!move) {
      this.facePlayer();
      return;
    }

    const currentTiledTile = this.worldToTiledTile(this.entity.x, this.entity.y);
    this.moveToTileWithPursuit(currentTiledTile.x + move.dx, currentTiledTile.y + move.dy, true);

    // Emit chasing event
    eventBus.emit("monster.chasing", {
      entityId: this.entity.id,
      direction: move.dx !== 0 ? (move.dx > 0 ? "right" : "left") : move.dy > 0 ? "down" : "up",
    });
  }

  private continueRetreating(): void {
    const move = this.calculateNextMove(false);
    if (!move) {
      this.facePlayer();
      return;
    }

    const currentTiledTile = this.worldToTiledTile(this.entity.x, this.entity.y);
    this.moveToTileWithPursuit(currentTiledTile.x + move.dx, currentTiledTile.y + move.dy, true);

    // Emit retreating event
    eventBus.emit("monster.retreating", {
      entityId: this.entity.id,
      direction: move.dx !== 0 ? (move.dx > 0 ? "right" : "left") : move.dy > 0 ? "down" : "up",
    });
  }

  calculateNextMove(towards: boolean = true): { dx: number; dy: number } | null {
    try {
      const gameScene = this.entity.scene as any;

      // Safety checks
      if (
        gameScene.isChangingMap ||
        !gameScene.playerCharacter ||
        !this.entity.active ||
        this.entity.scene !== gameScene
      ) {
        return null;
      }

      const player = gameScene.playerCharacter;
      const monsterTile = this.worldToTiledTile(this.entity.x, this.entity.y);
      const playerTile = this.worldToTiledTile(player.x, player.y);

      const diffX = playerTile.x - monsterTile.x;
      const diffY = playerTile.y - monsterTile.y;

      return this.calculateMovementDirection(monsterTile, diffX, diffY, towards);
    } catch (error) {
      eventBus.emit("error.monster.pathfinding", {
        entityId: this.entity.id,
        error,
      });
      return null;
    }
  }

  private calculateMovementDirection(
    monsterTile: { x: number; y: number },
    diffX: number,
    diffY: number,
    towards: boolean
  ): { dx: number; dy: number } | null {
    let dx = 0,
      dy = 0;

    // Prioritize horizontal or vertical movement
    if (Math.abs(diffX) > Math.abs(diffY)) {
      dx = diffX > 0 ? 1 : -1;
      if (!towards) dx = -dx;

      if (this.canMoveTo(monsterTile.x + dx, monsterTile.y)) {
        return { dx, dy: 0 };
      }

      // Try vertical as fallback
      dy = diffY > 0 ? 1 : -1;
      if (!towards) dy = -dy;

      if (this.canMoveTo(monsterTile.x, monsterTile.y + dy)) {
        return { dx: 0, dy };
      }
    } else {
      dy = diffY > 0 ? 1 : -1;
      if (!towards) dy = -dy;

      if (this.canMoveTo(monsterTile.x, monsterTile.y + dy)) {
        return { dx: 0, dy };
      }

      // Try horizontal as fallback
      dx = diffX > 0 ? 1 : -1;
      if (!towards) dx = -dx;

      if (this.canMoveTo(monsterTile.x + dx, monsterTile.y)) {
        return { dx, dy: 0 };
      }
    }

    // Try random directions if direct path blocked
    return this.findAlternativeDirection(monsterTile);
  }

  private findAlternativeDirection(monsterTile: {
    x: number;
    y: number;
  }): { dx: number; dy: number } | null {
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    // Randomize direction order
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    // Find first valid direction
    for (const dir of directions) {
      if (this.canMoveTo(monsterTile.x + dir.dx, monsterTile.y + dir.dy)) {
        return dir;
      }
    }

    return null;
  }

  canMoveTo(tileX: number, tileY: number): boolean {
    try {
      const gameScene = this.entity.scene as any;

      // Safety checks
      if (gameScene.isChangingMap || !gameScene.groundLayer || !this.entity.active) {
        return false;
      }

      const worldPos = this.tiledTileToWorld(tileX, tileY);
      const localTileX = Math.floor(worldPos.x / this.tileSize);
      const localTileY = Math.floor(worldPos.y / this.tileSize);

      // Check collision layer
      if (gameScene.collisionLayer) {
        const tile = gameScene.collisionLayer.getTileAt(localTileX, localTileY);
        if (tile?.collides) {
          return false;
        }
      }

      // FIXED: Restore monster-to-monster collision detection
      if (gameScene.monsters) {
        const monsters = gameScene.monsters.getChildren();
        for (const monster of monsters) {
          if (monster === this.entity) continue; // Skip self

          const monsterTile = this.worldToTiledTile(monster.x, monster.y);
          if (monsterTile.x === tileX && monsterTile.y === tileY) {
            return false; // Position occupied by another monster
          }
        }
      }

      return true;
    } catch (error) {
      // If there's any error, assume movement is not safe
      return false;
    }
  }

  approachPlayer(distance: number, attackType: string): void {
    try {
      if (this.moveInProgress) return;

      const now = Date.now();

      // Check if player is too far to maintain aggro
      if (distance > this.loseAggroRange) {
        // Lost aggro, return to wandering behavior
        this.isProvoked = false;
        this.setAggression(false);
        this.setupWanderingBehavior();

        // Emit lost aggro event
        eventBus.emit("monster.lostAggro", {
          entityId: this.entity.id,
        });
        return;
      }

      // Different behavior based on attack type
      if (attackType === MonsterAttackType.Melee) {
        // Melee monsters always chase aggressively
        if (distance > this.preferredDistance) {
          const move = this.calculateNextMove(true);
          if (!move) {
            this.facePlayer();
            return;
          }

          const currentTiledTile = this.worldToTiledTile(this.entity.x, this.entity.y);
          this.moveToTileWithPursuit(
            currentTiledTile.x + move.dx,
            currentTiledTile.y + move.dy,
            true
          );

          // Emit chasing event
          eventBus.emit("monster.chasing", {
            entityId: this.entity.id,
            attackType: "melee",
          });
        } else {
          this.facePlayer();
        }
      } else if (
        attackType === MonsterAttackType.Magic ||
        attackType === MonsterAttackType.Ranged
      ) {
        // Ranged/Magic monsters are now more aggressive

        // Quick decisions for ranged/magic monsters
        if (now - this.lastDecisionTime < 250) return; // Only 250ms between decisions
        this.lastDecisionTime = now;

        // If too close to player, retreat
        if (distance < this.preferredDistance * 0.8) {
          const move = this.calculateNextMove(false);
          if (!move) {
            this.facePlayer();
            return;
          }

          const currentTiledTile = this.worldToTiledTile(this.entity.x, this.entity.y);
          this.moveToTileWithPursuit(
            currentTiledTile.x + move.dx,
            currentTiledTile.y + move.dy,
            true
          ); // Continuous retreat

          // Emit retreating event
          eventBus.emit("monster.retreating", {
            entityId: this.entity.id,
            attackType: attackType,
          });
        }
        // If too far from player, chase aggressively
        else if (distance > this.preferredDistance * 1.2) {
          const move = this.calculateNextMove(true);
          if (!move) {
            this.facePlayer();
            return;
          }

          const currentTiledTile = this.worldToTiledTile(this.entity.x, this.entity.y);
          this.moveToTileWithPursuit(
            currentTiledTile.x + move.dx,
            currentTiledTile.y + move.dy,
            true
          ); // Continuous pursuit

          // Emit chasing event
          eventBus.emit("monster.chasing", {
            entityId: this.entity.id,
            attackType: attackType,
          });
        }
        // If at good distance, face the player
        else {
          this.facePlayer();

          // Emit positioned event
          eventBus.emit("monster.positioned", {
            entityId: this.entity.id,
            attackType: attackType,
            distance: distance,
          });
        }
      }
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} approachPlayer:`, error);
      eventBus.emit("error.monster.approach", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  facePlayer(): void {
    try {
      // FIXED: Add validation check
      if (!this.entity || !this.entity.scene || !this.entity.active || this.monster.isDead) {
        return;
      }

      const gameScene = this.entity.scene as any;
      if (!gameScene || !gameScene.playerCharacter) return;

      const player = gameScene.playerCharacter;

      const dx = player.x - this.entity.x;
      const dy = player.y - this.entity.y;

      let direction;
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? "right" : "left";
      } else {
        direction = dy > 0 ? "down" : "up";
      }

      (this.entity as Monster).playAnimation(direction, false);

      // Emit facing event
      eventBus.emit("monster.facing", {
        entityId: this.entity.id,
        direction: direction,
      });
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} facePlayer:`, error);
      eventBus.emit("error.monster.face", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  private wander(): void {
    try {
      if (this.monster.isDead || this.isAggressive || this.isProvoked || this.moveInProgress) {
        return;
      }

      const gameScene = this.entity.scene as any;
      if (gameScene.isChangingMap) {
        return;
      }

      // 70% chance to just play animation without moving
      if (Math.random() < 0.7) {
        const directions = ["down", "left", "up", "right"];
        const randomDirection = directions[Math.floor(Math.random() * directions.length)];
        this.monster.playAnimation(randomDirection, false);
        return;
      }

      const currentTile = this.worldToTiledTile(this.entity.x, this.entity.y);
      const initialTile = this.worldToTiledTile(this.initialPosition.x, this.initialPosition.y);

      const movement = this.calculateWanderMovement(currentTile, initialTile);

      if (movement && this.canMoveTo(currentTile.x + movement.dx, currentTile.y + movement.dy)) {
        this.moveToTile(currentTile.x + movement.dx, currentTile.y + movement.dy);

        eventBus.emit("monster.wandering", {
          entityId: this.entity.id,
          direction:
            movement.dx !== 0
              ? movement.dx > 0
                ? "right"
                : "left"
              : movement.dy > 0
                ? "down"
                : "up",
        });
      }
    } catch (error) {
      console.error(`Monster ${this.entity.id}: Error in wander:`, error);
      eventBus.emit("error.monster.wander", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  private calculateWanderMovement(
    currentTile: { x: number; y: number },
    initialTile: { x: number; y: number }
  ): { dx: number; dy: number } | null {
    const distFromInitial = Math.sqrt(
      Math.pow(currentTile.x - initialTile.x, 2) + Math.pow(currentTile.y - initialTile.y, 2)
    );

    let dx = 0,
      dy = 0;

    if (distFromInitial > this.wanderRange / this.tileSize) {
      // Return to initial position
      if (currentTile.x < initialTile.x) dx = 1;
      else if (currentTile.x > initialTile.x) dx = -1;
      else if (currentTile.y < initialTile.y) dy = 1;
      else if (currentTile.y > initialTile.y) dy = -1;
    } else {
      // Random movement
      const randomDirection = Math.floor(Math.random() * 4);
      switch (randomDirection) {
        case 0:
          dx = 1;
          break;
        case 1:
          dx = -1;
          break;
        case 2:
          dy = 1;
          break;
        case 3:
          dy = -1;
          break;
      }
    }

    return { dx, dy };
  }

  destroy(): void {
    try {
      if (this.wanderTimer) {
        this.wanderTimer.remove();
        this.wanderTimer = null;
      }

      super.destroy();
    } catch (error) {
      console.error(`Error destroying MonsterMovementComponent for ${this.entity.id}:`, error);
      eventBus.emit("error.component.destroy", {
        entityId: this.entity.id,
        componentId: "MonsterMovementComponent",
        error,
      });
    }
  }
}
