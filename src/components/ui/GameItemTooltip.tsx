import React, { useState, useEffect } from "react";
import { useEventBus } from "../../hooks/useEventBus";
import ItemTooltip from "./ItemTooltip";

const GameItemTooltip: React.FC = () => {
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    itemInstance?: any;
  }>({
    visible: false,
    itemInstance: undefined,
  });

  // Listen for tooltip show/hide events
  useEventBus("item.world.tooltip.show", (data) => {
    if (data) {
      setTooltipData({
        visible: true,
        itemInstance: data.itemInstance,
      });
    }
  });

  useEventBus("item.world.tooltip.hide", () => {
    setTooltipData((prev) => ({ ...prev, visible: false }));
  });

  // Hide tooltip when mouse leaves the game area or window loses focus
  useEffect(() => {
    const handleMouseLeave = () => {
      setTooltipData((prev) => ({ ...prev, visible: false }));
    };

    const handleWindowBlur = () => {
      setTooltipData((prev) => ({ ...prev, visible: false }));
    };

    // Add event listeners
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  return <ItemTooltip itemInstance={tooltipData.itemInstance} visible={tooltipData.visible} />;
};

export default GameItemTooltip;
