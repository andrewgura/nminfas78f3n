import React, { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useEventBus, useEmitEvent } from "../../hooks/useEventBus";
import { ItemDictionary } from "@/services/ItemDictionaryService";
import { ShopItem } from "@/services/NPCService";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";

interface BuyItemRowProps {
  item: ShopItem;
  onBuy: (item: ShopItem) => void;
  canAfford: boolean;
}

const BuyItemRow: React.FC<BuyItemRowProps> = ({ item, onBuy, canAfford }) => {
  const itemData = ItemDictionary.getItem(item.itemId);

  if (!itemData) return null;

  const folder = ItemDictionary.getItemFolder(itemData);
  const imageSrc = `assets/equipment/${folder}/${itemData.texture}.png`;

  return (
    <div className="shop-item-row" data-item-id={item.itemId} data-price={item.price}>
      <div className="item-image-container">
        <img src={imageSrc} alt={itemData.name} />
      </div>
      <div className="item-details">
        <div className="item-name">{itemData.name}</div>
        <div className="item-description">{itemData.description || ""}</div>
      </div>
      <div className="item-price">{item.price} gold</div>
      <button
        className={`buy-button ${!canAfford ? "disabled" : ""}`}
        onClick={() => canAfford && onBuy(item)}
        disabled={!canAfford}
      >
        Buy
      </button>
    </div>
  );
};

interface SellItemRowProps {
  instanceId: string;
  templateId: string;
  sellValue: number;
  onSell: (instanceId: string, sellValue: number) => void;
}

const SellItemRow: React.FC<SellItemRowProps> = ({ instanceId, templateId, sellValue, onSell }) => {
  const itemData = ItemDictionary.getItem(templateId);

  if (!itemData) return null;

  const folder = ItemDictionary.getItemFolder(itemData);
  const imageSrc = `assets/equipment/${folder}/${itemData.texture}.png`;

  return (
    <div className="shop-item-row" data-instance-id={instanceId} data-price={sellValue}>
      <div className="item-image-container">
        <img src={imageSrc} alt={itemData.name} />
      </div>
      <div className="item-details">
        <div className="item-name">{itemData.name}</div>
        <div className="item-description">{itemData.description || ""}</div>
      </div>
      <div className="item-price">{sellValue} gold</div>
      <button className="sell-button" onClick={() => onSell(instanceId, sellValue)}>
        Sell
      </button>
    </div>
  );
};

const Shop: React.FC = () => {
  const {
    playerCharacter,
    updatePlayerGold,
    addItemInstanceToInventory,
    removeItemInstanceFromInventory,
  } = useGameStore();

  const [visible, setVisible] = useState(false);
  const [npcId, setNpcId] = useState("");
  const [npcName, setNpcName] = useState("");
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);

  const emitEvent = useEmitEvent();

  // Listen for shop.open event
  useEventBus("shop.open", (data: { npcId: string; npcName: string; shopItems: ShopItem[] }) => {
    setNpcId(data.npcId);
    setNpcName(data.npcName);
    setShopItems(data.shopItems);
    setVisible(true);

    // Focus input
    emitEvent("input.focused", true);
  });

  // Listen for ESC key to close shop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  // Close shop
  const handleClose = () => {
    setVisible(false);
    emitEvent("input.focused", false);
  };

  // Buy an item
  const handleBuy = (item: ShopItem) => {
    // Check if player has enough gold
    if (playerCharacter.gold < item.price) {
      emitEvent("ui.message.show", "You don't have enough gold for that!");
      return;
    }

    // Create a new item instance
    const itemInstance = ItemInstanceManager.createItemInstance(item.itemId);

    // Add to inventory
    addItemInstanceToInventory(itemInstance);

    // Deduct gold
    updatePlayerGold(playerCharacter.gold - item.price);

    // Show message
    const itemData = ItemDictionary.getItem(item.itemId);
    emitEvent("ui.message.show", `Purchased ${itemData?.name || item.itemId}!`);
  };

  // Sell an item
  const handleSell = (instanceId: string, sellValue: number) => {
    // Remove from inventory
    const removed = removeItemInstanceFromInventory(instanceId);

    if (!removed) {
      console.error("Failed to remove item from inventory:", instanceId);
      return;
    }

    // Add gold
    updatePlayerGold(playerCharacter.gold + sellValue);

    // Show message
    emitEvent("ui.message.show", `Sold item for ${sellValue} gold!`);
  };

  // Check if player can afford item
  const canAfford = (price: number): boolean => {
    return playerCharacter.gold >= price;
  };

  // Get sellable items from inventory
  const getSellableItems = () => {
    return playerCharacter.inventory
      .map((instance) => {
        const template = ItemDictionary.getItem(instance.templateId);

        if (!template || !template.sellValue || template.sellValue <= 0) {
          return null;
        }

        return {
          instanceId: instance.instanceId,
          templateId: instance.templateId,
          sellValue: template.sellValue,
        };
      })
      .filter((item) => item !== null);
  };

  if (!visible) {
    return null;
  }

  const sellableItems = getSellableItems();

  return (
    <div className="shop-container">
      <div className="shop-header">
        <h2 id="shop-title">{npcName}'s Shop</h2>
        <div id="player-gold">Gold: {playerCharacter.gold}</div>
        <button className="shop-close-button" onClick={handleClose}>
          ✕
        </button>
      </div>

      <div className="shop-content">
        <div className="buy-panel">
          <h3>Buy Items</h3>
          <div id="buy-items-container" className="items-container">
            {shopItems.length === 0 ? (
              <div className="no-items-message">No items available for purchase</div>
            ) : (
              shopItems.map((item) => (
                <BuyItemRow
                  key={item.itemId}
                  item={item}
                  onBuy={handleBuy}
                  canAfford={canAfford(item.price)}
                />
              ))
            )}
          </div>
        </div>

        <div className="sell-panel">
          <h3>Sell Items</h3>
          <div id="sell-items-container" className="items-container">
            {sellableItems.length === 0 ? (
              <div className="no-items-message">No items to sell</div>
            ) : (
              sellableItems.map(
                (item) =>
                  item && (
                    <SellItemRow
                      key={item.instanceId}
                      instanceId={item.instanceId}
                      templateId={item.templateId}
                      sellValue={item.sellValue}
                      onSell={handleSell}
                    />
                  )
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;
