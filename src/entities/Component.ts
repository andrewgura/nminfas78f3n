import { Entity } from "./Entity";
import { eventBus } from "@/utils/EventBus";

export abstract class Component {
  protected entity: Entity;
  protected isEnabled: boolean = true;
  protected componentId: string;

  constructor(entity: Entity) {
    this.entity = entity;
    this.componentId = this.constructor.name;
  }

  initialize(): void {
    try {
      // Register component initialization
      eventBus.emit("component.initialized", {
        entityId: this.entity.id,
        componentId: this.componentId,
      });
    } catch (error) {
      console.error(`Error initializing component for entity ${this.entity.id}:`, error);
      eventBus.emit("error.component", {
        entityId: this.entity.id,
        componentId: this.componentId,
        error,
      });
    }
  }

  update(time: number, delta: number): void {
    try {
      if (!this.isEnabled) return;
      // Component-specific update logic should be implemented in subclasses
    } catch (error) {
      console.error(`Error updating component for entity ${this.entity.id}:`, error);
      eventBus.emit("error.component.update", {
        entityId: this.entity.id,
        componentId: this.componentId,
        error,
      });
    }
  }

  destroy(): void {
    try {
      eventBus.emit("component.destroyed", {
        entityId: this.entity.id,
        componentId: this.componentId,
      });
    } catch (error) {
      console.error(`Error destroying component for entity ${this.entity.id}:`, error);
      eventBus.emit("error.component.destroy", {
        entityId: this.entity.id,
        componentId: this.componentId,
        error,
      });
    }
  }

  enable(): void {
    this.isEnabled = true;
    eventBus.emit("component.state.changed", {
      entityId: this.entity.id,
      componentId: this.componentId,
      enabled: true,
    });
  }

  disable(): void {
    this.isEnabled = false;
    eventBus.emit("component.state.changed", {
      entityId: this.entity.id,
      componentId: this.componentId,
      enabled: false,
    });
  }

  isActive(): boolean {
    return this.isEnabled;
  }
}
