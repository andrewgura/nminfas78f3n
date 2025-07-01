// App.tsx with Resources Component and Creatures
import React from "react";
import { GameProvider } from "./contexts/GameContext";
import { UIProvider } from "./contexts/UIContext";
import PhaserGame from "./components/game/PhaserGame";
import ActionBar from "./components/ui/ActionBar";
import MessageLog from "./components/ui/MessageLog";
import Inventory from "./components/ui/Inventory";
import UINavBar from "./components/ui/UINavBar";
import SetCollection from "./components/ui/SetCollection";
import AbilityInterface from "./components/ui/AbilityInterface";
import Shop from "./components/ui/Shop";
import DeathManager from "./components/ui/DeathManager";
import GameItemTooltip from "./components/ui/GameItemTooltip";
import QuestLog from "./components/ui/QuestLog";
import MapNameLabel from "./components/ui/MapNameLabel";
import SkillsWindow from "./components/ui/Skills";
import Resources from "./components/ui/Resources";
import Creatures from "./components/ui/Creatures";
import CurrencyDisplay from "./components/ui/CurrencyDisplay";

function App() {
  const [windowSize, setWindowSize] = React.useState({
    width: window.innerWidth - 220, // Subtract UI sidebar width
    height: window.innerHeight,
  });

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth - 220,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add global context menu prevention
  React.useEffect(() => {
    // Prevent context menu throughout the entire application
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Add the event listener to the document
    document.addEventListener("contextmenu", preventContextMenu);

    // Clean up on component unmount
    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  return (
    <GameProvider>
      <UIProvider>
        <div className="app-container">
          <div className="game-container">
            <PhaserGame width={windowSize.width} height={windowSize.height} />
            <div className="ui-overlay">
              <MessageLog />
              <MapNameLabel />
              <Resources />
              <div className="bottom-ui">
                <ActionBar />
              </div>
              <SetCollection />
              <AbilityInterface />
              <SkillsWindow />
              <Shop />
              <DeathManager />
              <GameItemTooltip />
              <QuestLog />
              <Creatures />
            </div>
          </div>
          <div className="ui-sidebar">
            <UINavBar />
            <div className="sidebar-content">
              <div className="resources-container">
                <div className="resource-row">
                  <CurrencyDisplay icon="💰" label="GOLD" className="gold-container" />
                </div>
              </div>
              <Inventory />
            </div>
          </div>
        </div>
      </UIProvider>
    </GameProvider>
  );
}

export default App;
