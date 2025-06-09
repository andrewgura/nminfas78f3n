import React, { useState, useEffect, useRef } from "react";
import { useEventBus, useEmitEvent } from "../../hooks/useEventBus";
import { MainQuets } from "../../data/main-quests";
import { Riddles } from "../../data/riddles";
import { SideQuests } from "@/data/side-quests.";

enum QuestTab {
  MAIN = "main",
  SIDE = "side",
  RIDDLES = "riddles",
}

interface MainQuestStep {
  page: number;
  step: number;
  task: string;
  img: string;
}

interface SideQuest {
  name: string;
  type: string;
  amount: number;
  reward: number;
  description: string;
  isRepeatable: boolean;
}

interface Riddle {
  name: string;
  img: string;
  reward: number;
}

const QuestLog: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<QuestTab>(QuestTab.MAIN);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedQuest, setSelectedQuest] = useState<string | null>(null);
  const questItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const emitEvent = useEmitEvent();

  // Data organization
  const mainQuestsByPage = MainQuets.reduce<Record<number, MainQuestStep[]>>((acc, quest) => {
    if (!acc[quest.page]) {
      acc[quest.page] = [];
    }
    acc[quest.page].push(quest);
    return acc;
  }, {});

  const maxPages = Math.max(...Object.keys(mainQuestsByPage).map(Number));

  // Calculate total quest points (from completed quests)
  const calculateTotalQuestPoints = (): number => {
    let total = 0;

    // Add points from completed side quests
    SideQuests.forEach((quest) => {
      const progress = getSideQuestProgress(quest);
      if (progress >= quest.amount) {
        total += quest.reward;
      }
    });

    // Add points from completed riddles
    Riddles.forEach((riddle) => {
      if (isRiddleCompleted(riddle.name)) {
        total += riddle.reward;
      }
    });

    return total;
  };

  // When side tab is activated, select the first quest by default
  useEffect(() => {
    if (activeTab === QuestTab.SIDE && SideQuests.length > 0 && !selectedQuest) {
      setSelectedQuest(SideQuests[0].name);
    }
  }, [activeTab, selectedQuest]);

  useEventBus("quests.toggle", (data: { visible: boolean }) => {
    setVisible(data.visible);
  });

  // Toggle visibility when 'P' key is pressed
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "p") {
        setVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Scroll to selected quest when it changes
  useEffect(() => {
    if (selectedQuest && questItemRefs.current[selectedQuest]) {
      questItemRefs.current[selectedQuest]?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedQuest]);

  // Mock completion status (would come from game state in a real implementation)
  const isStepCompleted = (step: number, page: number): boolean => {
    // For demo purposes: steps 1 and 2 of page 1 are completed
    return page === 1 && (step === 1 || step === 2);
  };

  const isCurrentStep = (step: number, page: number): boolean => {
    // For demo purposes: step 3 of page 1 is current
    return page === 1 && step === 3;
  };

  const isRiddleCompleted = (name: string): boolean => {
    // For demo purposes: first and third riddles are completed
    return name === "FireSword" || name === "Abc2";
  };

  const getSideQuestProgress = (quest: SideQuest): number => {
    // For demo purposes: fixed progress values
    if (quest.name === "SkeletonKiller") return 3;
    if (quest.name === "GoblinKiller") return 19;
    if (quest.name === "BerryCollect") return 3;
    return Math.floor(Math.random() * quest.amount);
  };

  const handleClose = () => {
    setVisible(false);
    emitEvent("ui.message.show", "Quest Log closed.");
  };

  const handleNextPage = () => {
    if (currentPage < maxPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleSelectQuest = (questName: string) => {
    setSelectedQuest(questName);
  };

  const renderMainQuests = () => {
    const pageQuests = mainQuestsByPage[currentPage] || [];
    pageQuests.sort((a, b) => a.step - b.step);

    return (
      <div className="quest-book">
        <div className="quest-book-left">
          <div className="quest-image-container">
            <img
              src={`assets/quests/${pageQuests[0]?.img || "riddle.png"}`}
              alt="Quest"
              className="quest-image"
            />
          </div>
        </div>
        <div className="quest-book-right">
          <div className="quest-page-number">Page {currentPage}</div>
          <div className="quest-steps">
            {pageQuests.map((quest) => {
              const completed = isStepCompleted(quest.step, quest.page);
              const current = isCurrentStep(quest.step, quest.page);

              // Only show steps that are completed or current
              if (!completed && !current) return null;

              return (
                <div
                  key={`${quest.page}-${quest.step}`}
                  className={`quest-step ${completed ? "completed" : ""} ${current ? "current" : ""}`}
                >
                  <span className="quest-step-number">{quest.step}.</span>
                  <span className="quest-step-text">{quest.task}</span>
                </div>
              );
            })}
          </div>
          <div className="quest-navigation">
            <button
              className={`quest-nav-button ${currentPage <= 1 ? "disabled" : ""}`}
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              ←
            </button>
            <button
              className={`quest-nav-button ${currentPage >= maxPages ? "disabled" : ""}`}
              onClick={handleNextPage}
              disabled={currentPage >= maxPages}
            >
              →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSideQuests = () => {
    return (
      <div className="side-quests-container">
        {/* Navigation panel */}
        <div className="side-quest-navigation">
          {SideQuests.map((quest) => (
            <div
              key={quest.name}
              className={`side-quest-nav-item ${selectedQuest === quest.name ? "active" : ""}`}
              onClick={() => handleSelectQuest(quest.name)}
            >
              {quest.name}
            </div>
          ))}
        </div>

        {/* Content panel */}
        <div className="side-quest-content">
          {SideQuests.map((quest) => {
            const progress = getSideQuestProgress(quest);
            const progressPercentage = Math.min(100, (progress / quest.amount) * 100);
            const isComplete = progress >= quest.amount;

            return (
              <div
                key={quest.name}
                className={`side-quest-item ${isComplete ? "completed" : ""}`}
                ref={(el) => (questItemRefs.current[quest.name] = el)}
              >
                <div className="side-quest-header">
                  <div className="side-quest-name">{quest.name}</div>
                  <div className="side-quest-reward">{quest.reward} Quest Point</div>
                </div>
                <div className="side-quest-description">{quest.description}</div>
                <div className="side-quest-progress">
                  <div className="side-quest-progress-text">
                    Progress: {progress}/{quest.amount}
                  </div>
                  <div className="side-quest-progress-bar-container">
                    <div
                      className="side-quest-progress-bar-fill"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="side-quest-type-tag">
                  {quest.type === "kill" ? "Hunt" : "Collect"} •
                  {quest.isRepeatable ? " Repeatable" : " One-time"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRiddles = () => {
    return (
      <div className="riddles-container">
        {Riddles.map((riddle) => {
          const completed = isRiddleCompleted(riddle.name);

          return (
            <div key={riddle.name} className={`riddle-card ${completed ? "completed" : "hidden"}`}>
              <div className="riddle-image-container">
                {completed ? (
                  <img
                    src={`assets/quests/${riddle.img}`}
                    alt={riddle.name}
                    className="riddle-image"
                  />
                ) : (
                  <div className="riddle-unknown">?</div>
                )}
              </div>
              <div className="riddle-info">
                <div className="riddle-name">{completed ? riddle.name : "???"}</div>
                {completed && <div className="riddle-reward">{riddle.reward} Quest Points</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="quest-log-container">
      <div className="quest-log-header">
        <h2>Quest Log</h2>
        <div className="total-quest-points">
          <span>{calculateTotalQuestPoints()} Quest Points</span>
        </div>
        <button className="close-button" onClick={handleClose}>
          ✕
        </button>
      </div>

      <div className="quest-tabs">
        <div
          className={`quest-tab ${activeTab === QuestTab.MAIN ? "active" : ""}`}
          onClick={() => setActiveTab(QuestTab.MAIN)}
        >
          Main
        </div>
        <div
          className={`quest-tab ${activeTab === QuestTab.SIDE ? "active" : ""}`}
          onClick={() => setActiveTab(QuestTab.SIDE)}
        >
          Side
        </div>
        <div
          className={`quest-tab ${activeTab === QuestTab.RIDDLES ? "active" : ""}`}
          onClick={() => setActiveTab(QuestTab.RIDDLES)}
        >
          Riddles
        </div>
      </div>

      <div className="quest-content">
        {activeTab === QuestTab.MAIN && renderMainQuests()}
        {activeTab === QuestTab.SIDE && renderSideQuests()}
        {activeTab === QuestTab.RIDDLES && renderRiddles()}
      </div>
    </div>
  );
};

export default QuestLog;
