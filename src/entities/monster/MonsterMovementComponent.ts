import { MovementComponent } from "../player/MovementComponent";
import { Monster } from "../Monster";
import { MonsterAttackType } from "@/types";
import { eventBus } from "@/utils/EventBus";

export class MonsterMovementComponent extends MovementComponent {
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
    super(entity, speed);
    this.isAggressive = isAggressive;
    this.moveDelay = this.moveInterval;

    if (!isAggressive) {
      this.setupWanderingBehavior();
    }

    // Emit initialization event
    eventBus.emit("monster.movement.initialized", {
      entityId: this.entity.id,
      isAggressive,
      speed,
      attackType: this.attackType,
    });
  }

  get monster(): Monster {
    return this.entity as Monster;
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

  private wander(): void {
    try {
      if (this.monster.isDead || this.isAggressive || this.isProvoked || this.moveInProgress)
        return;

      if (Math.random() < 0.7) {
        const directions = ["down", "left", "up", "right"];
        const randomDirection = directions[Math.floor(Math.random() * directions.length)];
        this.monster.playAnimation(randomDirection, false);
        return;
      }

      const currentTileX = Math.floor(this.entity.x / this.tileSize);
      const currentTileY = Math.floor(this.entity.y / this.tileSize);

      const initialTileX = Math.floor(this.initialPosition.x / this.tileSize);
      const initialTileY = Math.floor(this.initialPosition.y / this.tileSize);

      const distFromInitial = Math.sqrt(
        Math.pow(currentTileX - initialTileX, 2) + Math.pow(currentTileY - initialTileY, 2)
      );

      let dx = 0,
        dy = 0;

      if (distFromInitial > this.wanderRange / this.tileSize) {
        if (currentTileX < initialTileX) dx = 1;
        else if (currentTileX > initialTileX) dx = -1;
        else if (currentTileY < initialTileY) dy = 1;
        else if (currentTileY > initialTileY) dy = -1;
      } else {
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

      if (this.canMoveTo(currentTileX + dx, currentTileY + dy)) {
        this.moveToTile(currentTileX + dx, currentTileY + dy);

        // Emit wandering event
        eventBus.emit("monster.wandering", {
          entityId: this.entity.id,
          direction: dx !== 0 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up",
        });
      }
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} wander:`, error);
      eventBus.emit("error.monster.wander", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  moveToTile(tileX: number, tileY: number, isContinuous: boolean = false): void {
    try {
      if (this.moveInProgress) return;
      this.moveInProgress = true;

      const x = tileX * this.tileSize + this.tileSize / 2;
      const y = tileY * this.tileSize + this.tileSize / 2;

      const currentTileX = Math.floor(this.entity.x / this.tileSize);
      const currentTileY = Math.floor(this.entity.y / this.tileSize);

      const dx = tileX - currentTileX;
      const dy = tileY - currentTileY;

      let direction = "";
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? "right" : "left";
      } else {
        direction = dy > 0 ? "down" : "up";
      }

      this.isMoving = true;
      this.continuousPursuit = isContinuous;

      (this.entity as Monster).playAnimation(direction, true);

      // Emit movement start event
      eventBus.emit("monster.movement.start", {
        entityId: this.entity.id,
        direction,
        targetPosition: { x, y },
        isContinuous,
      });

      // Faster movement for all aggressive monsters
      let moveDuration = 400;
      if (isContinuous) {
        // Scale duration based on monster speed
        moveDuration = (this.tileSize / this.speed) * 1000;
      }

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
        x: x,
        y: y,
        duration: moveDuration,
        ease: "Linear",
        onComplete: () => {
          this.isMoving = false;
          this.moveInProgress = false;
          this.lastMoveTime = Date.now();

          // Emit movement complete event
          eventBus.emit("monster.movement.complete", {
            entityId: this.entity.id,
            position: { x, y },
          });

          if (this.continuousPursuit && (this.isAggressive || this.isProvoked)) {
            // For all monster types, continue pursuit if needed
            this.continuePursuit();
          } else if (this.isAggressive || this.isProvoked) {
            this.facePlayer();
          } else {
            (this.entity as Monster).playAnimation(direction, false);
          }
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
    }
  }

  // Continue pursuit without delay for all aggressive monsters
  private continuePursuit(): void {
    try {
      const gameScene = this.entity.scene as any;
      if (!gameScene.playerCharacter) return;

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

    const tileX = Math.floor(this.entity.x / this.tileSize);
    const tileY = Math.floor(this.entity.y / this.tileSize);

    this.moveToTile(tileX + move.dx, tileY + move.dy, true);

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

    const tileX = Math.floor(this.entity.x / this.tileSize);
    const tileY = Math.floor(this.entity.y / this.tileSize);

    this.moveToTile(tileX + move.dx, tileY + move.dy, true);

    // Emit retreating event
    eventBus.emit("monster.retreating", {
      entityId: this.entity.id,
      direction: move.dx !== 0 ? (move.dx > 0 ? "right" : "left") : move.dy > 0 ? "down" : "up",
    });
  }

  calculateNextMove(towards: boolean = true): { dx: number; dy: number } | null {
    try {
      const gameScene = this.entity.scene as any;
      if (!gameScene.playerCharacter) return null;

      const player = gameScene.playerCharacter;

      const monsterTileX = Math.floor(this.entity.x / this.tileSize);
      const monsterTileY = Math.floor(this.entity.y / this.tileSize);
      const playerTileX = Math.floor(player.x / this.tileSize);
      const playerTileY = Math.floor(player.y / this.tileSize);

      const diffX = playerTileX - monsterTileX;
      const diffY = playerTileY - monsterTileY;

      let dx = 0,
        dy = 0;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        dx = diffX > 0 ? 1 : -1;
        if (!towards) dx = -dx;

        if (this.canMoveTo(monsterTileX + dx, monsterTileY)) {
          return { dx, dy: 0 };
        }

        dy = diffY > 0 ? 1 : -1;
        if (!towards) dy = -dy;

        if (this.canMoveTo(monsterTileX, monsterTileY + dy)) {
          return { dx: 0, dy };
        }
      } else {
        dy = diffY > 0 ? 1 : -1;
        if (!towards) dy = -dy;

        if (this.canMoveTo(monsterTileX, monsterTileY + dy)) {
          return { dx: 0, dy };
        }

        dx = diffX > 0 ? 1 : -1;
        if (!towards) dx = -dx;

        if (this.canMoveTo(monsterTileX + dx, monsterTileY)) {
          return { dx, dy: 0 };
        }
      }

      // Try alternative directions
      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];

      for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
      }

      for (const dir of directions) {
        if (this.canMoveTo(monsterTileX + dir.dx, monsterTileY + dir.dy)) {
          return dir;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} calculateNextMove:`, error);
      eventBus.emit("error.monster.pathfinding", {
        entityId: this.entity.id,
        error,
      });
      return null;
    }
  }

  canMoveTo(tileX: number, tileY: number): boolean {
    try {
      const gameScene = this.entity.scene as any;

      if (!gameScene.groundLayer) return false;

      if (gameScene.collisionLayer) {
        const tile = gameScene.collisionLayer.getTileAt(tileX, tileY);
        if (tile && tile.collides) return false;
      }

      if (gameScene.monsters) {
        const monsters = gameScene.monsters.getChildren();
        for (const monster of monsters) {
          if (monster === this.entity) continue;

          const monsterTileX = Math.floor(monster.x / this.tileSize);
          const monsterTileY = Math.floor(monster.y / this.tileSize);

          if (monsterTileX === tileX && monsterTileY === tileY) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} canMoveTo:`, error);
      return false;
    }
  }

  runFromPlayer(): void {
    try {
      const now = Date.now();

      if (now - this.lastDecisionTime < this.decisionDelay || this.moveInProgress) return;
      this.lastDecisionTime = now;

      if (now - this.lastMoveTime < this.moveDelay) return;

      const move = this.calculateNextMove(false);
      if (!move) return;

      const tileX = Math.floor(this.entity.x / this.tileSize);
      const tileY = Math.floor(this.entity.y / this.tileSize);

      this.moveToTile(tileX + move.dx, tileY + move.dy, true); // Continuous retreat

      // Emit fleeing event
      eventBus.emit("monster.fleeing", {
        entityId: this.entity.id,
        direction: move.dx !== 0 ? (move.dx > 0 ? "right" : "left") : move.dy > 0 ? "down" : "up",
      });
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} runFromPlayer:`, error);
      eventBus.emit("error.monster.flee", {
        entityId: this.entity.id,
        error,
      });
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

          const tileX = Math.floor(this.entity.x / this.tileSize);
          const tileY = Math.floor(this.entity.y / this.tileSize);

          this.moveToTile(tileX + move.dx, tileY + move.dy, true);

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

          const tileX = Math.floor(this.entity.x / this.tileSize);
          const tileY = Math.floor(this.entity.y / this.tileSize);
          this.moveToTile(tileX + move.dx, tileY + move.dy, true); // Continuous retreat

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

          const tileX = Math.floor(this.entity.x / this.tileSize);
          const tileY = Math.floor(this.entity.y / this.tileSize);
          this.moveToTile(tileX + move.dx, tileY + move.dy, true); // Continuous pursuit

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
      const gameScene = this.entity.scene as any;
      if (!gameScene.playerCharacter) return;

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
