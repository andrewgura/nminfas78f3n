import { Component } from "../Component";
import { Monster } from "../Monster";
import { MonsterMovementComponent } from "./MonsterMovementComponent";
import { MonsterCombatComponent } from "./MonsterCombatComponent";
import { eventBus } from "@/utils/EventBus";

export class MonsterAIComponent extends Component {
  private isAggressive: boolean = false;
  private isProvoked: boolean = false;
  private runawayPercent: number = 0;
  private aggroRange: number = 800;
  private attackType: string = "melee";
  private lastPlayerCheck: number = 0;
  private checkDelay: number = 500;

  constructor(entity: Monster, isAggressive: boolean = false, attackType: string = "melee") {
    super(entity);
    this.isAggressive = isAggressive;
    this.attackType = attackType;
    this.aggroRange = 800; // 25 tiles regardless of type
  }

  get monster(): Monster {
    return this.entity as Monster;
  }

  setProvokedState(provoked: boolean): void {
    this.isProvoked = provoked;

    // Also update the movement component's provoked state
    const movementComponent = this.monster.components.get<MonsterMovementComponent>("movement");
    if (movementComponent) {
      movementComponent.setProvokedState(provoked);
    }

    // Emit provoked state changed event
    eventBus.emit("monster.provoked", {
      id: this.entity.id,
      type: this.monster.monsterType,
      provoked: provoked,
    });
  }

  setRunawayPercent(percent: number): void {
    this.runawayPercent = percent;
  }

  update(time: number, delta: number): void {
    try {
      if (!this.isEnabled || this.monster.isDead) return;

      // Limit how often we check player position
      const now = Date.now();
      if (now - this.lastPlayerCheck < this.checkDelay) return;
      this.lastPlayerCheck = now;

      this.updateAggro();
    } catch (error) {
      console.error(`Error in MonsterAIComponent update for ${this.entity.id}:`, error);
      eventBus.emit("error.monster.ai.update", {
        id: this.entity.id,
        type: this.monster.monsterType,
        error,
      });
    }
  }

  updateAggro(): void {
    try {
      const gameScene = this.entity.scene as any;
      if (!gameScene.playerCharacter) return;

      const player = gameScene.playerCharacter;

      // Calculate distance to player
      const distance = Phaser.Math.Distance.Between(
        this.entity.x,
        this.entity.y,
        player.x,
        player.y
      );

      // If not yet aggressive or provoked, check if player is in aggro range
      if (!this.isProvoked && !this.isAggressive && distance <= this.aggroRange) {
        // Become aggressive when player enters range
        this.isAggressive = true;

        // Update movement component aggression
        const movementComponent = this.monster.components.get<MonsterMovementComponent>("movement");
        if (movementComponent) {
          movementComponent.setAggression(true);
        }

        // Emit aggression event
        eventBus.emit("monster.aggro", {
          id: this.entity.id,
          type: this.monster.monsterType,
          name: this.monster.monsterName,
        });
      }

      // Check if player is within aggro range or monster is provoked
      if ((this.isAggressive || this.isProvoked) && distance <= this.aggroRange) {
        const movementComponent = this.monster.components.get<MonsterMovementComponent>("movement");
        const combatComponent = this.monster.components.get<MonsterCombatComponent>("combat");

        if (!movementComponent || !combatComponent) return;

        // Move towards player or maintain distance
        movementComponent.approachPlayer(distance, this.attackType);

        // Try to attack player
        const attacked = combatComponent.attackPlayerCharacter();

        // Emit attack event if successful
        if (attacked) {
          eventBus.emit("monster.attack", {
            id: this.entity.id,
            type: this.monster.monsterType,
            name: this.monster.monsterName,
            attackType: this.attackType,
          });
        }
      }
    } catch (error) {
      console.error(`Error in MonsterAIComponent updateAggro for ${this.entity.id}:`, error);
      eventBus.emit("error.monster.ai.aggro", {
        id: this.entity.id,
        type: this.monster.monsterType,
        error,
      });
    }
  }
}
