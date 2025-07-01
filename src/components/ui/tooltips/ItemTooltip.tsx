import React, { useState, useEffect } from "react";
import { ItemData, ItemInstance, ItemType } from "../../../types";
import { ItemInstanceManager } from "../../../utils/ItemInstanceManager";

interface ItemTooltipProps {
  itemInstance?: ItemInstance;
  visible: boolean;
}

const ItemTooltip: React.FC<ItemTooltipProps> = ({ itemInstance, visible }) => {
  const [itemData, setItemData] = useState<ItemData | null>(null);

  // Update item data when instance changes
  useEffect(() => {
    if (itemInstance) {
      const combinedData = ItemInstanceManager.getCombinedStats(itemInstance);
      setItemData(combinedData);
    } else {
      setItemData(null);
    }
  }, [itemInstance]);

  if (!visible || !itemData) return null;

  // Get folder for item image
  const getItemFolder = (item: ItemData): string => {
    const categoryToFolderMap: Record<string, string> = {
      weapon_melee: "melee-weapons",
      weapon_magic: "magic",
      weapon_ranged: "ranged",
      armor: "chest",
      shield: "offhand",
      helmet: "helmet",
      amulet: "necklace",
      trinket: "trinket",
      food: "food",
      product: "products",
      currency: "valuables",
      material: "valuables",
      consumable: "valuables",
      quest: "valuables",
    };

    return item.category ? categoryToFolderMap[item.category] || "valuables" : "valuables";
  };

  // Get image URL
  const getImageUrl = (): string => {
    if (!itemData?.texture) return "";
    const folder = getItemFolder(itemData);
    return `assets/equipment/${folder}/${itemData.texture}.png`;
  };

  // Check item types
  const hasBonuses = itemInstance?.bonusStats && Object.keys(itemInstance.bonusStats).length > 0;
  const isSetItem = !!itemData.set;
  const isFood = itemData.type === ItemType.FOOD;
  const isProduct = itemData.type === ItemType.PRODUCT; // Add product type check

  // Get quantity for stackable items
  const quantity = itemInstance?.quantity || 1;

  // Calculate total weight for stackable items
  const totalWeight = itemData.weight ? itemData.weight * quantity : 0;

  // Get item name color based on properties and type
  const getItemNameColor = () => {
    if (isSetItem) return "#2ecc71"; // Green for set items
    if (hasBonuses) return "#6ab5ff"; // Blue for bonus items
    if (isFood) return "#ffd280"; // Gold for food items
    if (isProduct) return "#ff9d5a"; // Orange/copper for products
    return "#d0e0ff"; // White for normal items
  };

  // Get display-friendly category name
  const getCategoryDisplayName = (category?: string) => {
    if (!category) return "Unknown";

    const categoryNames: Record<string, string> = {
      weapon_melee: "Melee Weapon",
      weapon_magic: "Magic Weapon",
      weapon_ranged: "Ranged Weapon",
      armor: "Armor",
      shield: "Shield",
      helmet: "Helmet",
      amulet: "Amulet",
      trinket: "Trinket",
      consumable: "Consumable",
      food: "Food",
      material: "Material",
      product: "Product",
      currency: "Currency",
      quest: "Quest Item",
    };

    return categoryNames[category] || category;
  };

  // Get instruction text based on item type
  const getInstructionText = () => {
    if (isFood) return "Right-click to consume";
    if (isProduct) return "Right-click for options • Used for trading and crafting";
    return "Drag to equip or right-click for actions";
  };

  // Calculate better positioning
  const getTooltipStyle = () => {
    const baseStyle = {
      display: visible ? "block" : "none",
      position: "fixed" as const,
      zIndex: 2000,
      pointerEvents: "none" as const,
      maxWidth: "320px",
      width: "auto",
    };

    return {
      ...baseStyle,
      right: 235, // Adjusted to account for sidebar
      bottom: 30,
    };
  };

  return (
    <div className="game-item-tooltip" style={getTooltipStyle()}>
      <div className={`item-tooltip-content ${isProduct ? "product-tooltip" : ""}`}>
        <div className="item-tooltip-header">
          <div className="item-tooltip-image-container">
            <img src={getImageUrl()} alt={itemData.name} className="item-tooltip-image" />
          </div>
          <div className="item-tooltip-title-section">
            <span className="item-name" style={{ color: getItemNameColor() }}>
              {itemData.name}
              {quantity > 1 && (
                <span
                  style={{
                    color: "#ffd280",
                    fontSize: "12px",
                    fontWeight: "bold",
                    marginLeft: "4px",
                  }}
                >
                  {" "}
                  ×{quantity}
                </span>
              )}
            </span>
            {/* Category display */}
            {itemData.category && (
              <div
                className={`item-category ${isProduct ? "product-category" : ""}`}
                style={{
                  fontSize: "10px",
                  color: isProduct ? "#cc7a00" : "#7e91b5",
                  fontWeight: "500",
                  marginTop: "3px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {getCategoryDisplayName(itemData.category)}
              </div>
            )}
          </div>
        </div>

        <div className="item-tooltip-divider"></div>

        <div className="item-tooltip-stats">
          {/* Food items show hp/mp regen */}
          {isFood ? (
            <>
              {itemData.hpRegen && (
                <div className="stat-row">
                  <span className="stat-icon">💗</span>
                  <span className="stat-label">HP Regen:</span>
                  <span className="stat-value positive">+{itemData.hpRegen}</span>
                </div>
              )}
              {itemData.mpRegen && (
                <div className="stat-row">
                  <span className="stat-icon">💙</span>
                  <span className="stat-label">MP Regen:</span>
                  <span className="stat-value positive">+{itemData.mpRegen}</span>
                </div>
              )}
              <div className="stat-row">
                <span className="stat-icon">⚖️</span>
                <span className="stat-label">Weight:</span>
                <span className="stat-value neutral">{totalWeight}</span>
              </div>
            </>
          ) : isProduct ? (
            // Products show special product-focused stats
            <>
              <div className="stat-row product-stat">
                <span className="stat-icon">⚖️</span>
                <span className="stat-label">Unit Weight:</span>
                <span className="stat-value neutral">{itemData.weight || 0}</span>
              </div>
              {quantity > 1 && (
                <div className="stat-row product-stat">
                  <span className="stat-icon">📊</span>
                  <span className="stat-label">Total Weight:</span>
                  <span className="stat-value neutral">{totalWeight}</span>
                </div>
              )}
              {itemData.sellValue && (
                <div className="stat-row product-stat">
                  <span className="stat-icon">💰</span>
                  <span className="stat-label">Value:</span>
                  <span className="stat-value gold">{itemData.sellValue} gold</span>
                </div>
              )}
            </>
          ) : (
            // Regular items show power/armor
            <>
              {itemData.power && (
                <div className="stat-row">
                  <span className="stat-icon">⚔️</span>
                  <span className="stat-label">Power:</span>
                  <span className="stat-value neutral">{itemData.power}</span>
                </div>
              )}
              {itemData.armor && (
                <div className="stat-row">
                  <span className="stat-icon">🛡️</span>
                  <span className="stat-label">Armor:</span>
                  <span className="stat-value neutral">{itemData.armor}</span>
                </div>
              )}
              {itemData.weight && (
                <div className="stat-row">
                  <span className="stat-icon">⚖️</span>
                  <span className="stat-label">Weight:</span>
                  <span className="stat-value neutral">{itemData.weight}</span>
                </div>
              )}
            </>
          )}
        </div>

        {itemData.description && (
          <div className={`item-tooltip-description ${isProduct ? "product-description" : ""}`}>
            {itemData.description}
          </div>
        )}

        {/* Set item section */}
        {isSetItem && (
          <div className="tooltip-set-section">
            <div className="tooltip-set-title">Set: {itemData.set}</div>
            <div className="tooltip-set-count">2 of 6 pieces equipped</div>
            {itemData.setBonus && (
              <div className="tooltip-bonus-section">
                <div className="tooltip-bonus-title">Set Bonuses:</div>
                {Object.entries(itemData.setBonus).map(([stat, value]) => (
                  <div key={stat} className="tooltip-bonus-item">
                    +{value} {stat.charAt(0).toUpperCase() + stat.slice(1)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bonus stats section - Only show for non-set items! */}
        {hasBonuses && !isSetItem && (
          <div className="item-tooltip-bonuses">
            <div className="bonus-title">Item Bonuses:</div>
            {itemInstance?.bonusStats &&
              Object.entries(itemInstance.bonusStats).map(([stat, value]) => (
                <div key={stat} className="bonus-stat">
                  +{value} {stat.charAt(0).toUpperCase() + stat.slice(1)}
                </div>
              ))}
          </div>
        )}

        {/* Product-specific information section */}
        {isProduct && (
          <div className="product-info-section">
            <div className="product-info-title">📦 Trade Goods</div>
            <div className="product-info-text">
              This item is valuable for trading with merchants and may be used in crafting recipes.
            </div>
          </div>
        )}

        <div className={`item-tooltip-instruction ${isProduct ? "product-instruction" : ""}`}>
          {getInstructionText()}
        </div>
      </div>
    </div>
  );
};

export default ItemTooltip;
