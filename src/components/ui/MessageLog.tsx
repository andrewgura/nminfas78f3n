import React, { useState, useEffect, useRef } from "react";
import { useEventBus } from "../../hooks/useEventBus";

interface Message {
  id: number;
  text: string;
  type: "normal" | "error";
  timestamp: number;
}

const MessageLog: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [counter, setCounter] = useState(0);
  const [lastMessages, setLastMessages] = useState<Map<string, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const MESSAGE_COOLDOWN = 1000; // 1 second cooldown for duplicate messages
  const MESSAGE_FADE_DURATION = 4000;
  const ERROR_FADE_DURATION = 6000;

  useEventBus("ui.message.show", (text: string) => {
    addMessage(text, "normal");
  });

  useEventBus("ui.error.show", (error: string | Error) => {
    const errorMessage = error instanceof Error ? error.message : error;
    addMessage(`Error: ${errorMessage}`, "error");
  });

  const addMessage = (text: string, type: "normal" | "error") => {
    // Prevent duplicate messages in quick succession
    const now = Date.now();
    const lastTime = lastMessages.get(text);
    if (lastTime && now - lastTime < MESSAGE_COOLDOWN) {
      return; // Skip duplicate message during cooldown
    }

    // Update the last time this message was shown
    setLastMessages((prev) => {
      const newMap = new Map(prev);
      newMap.set(text, now);

      // Clean up old entries (older than 10 seconds)
      if (newMap.size > 20) {
        const cutoffTime = now - 10000;
        for (const [message, timestamp] of newMap.entries()) {
          if (timestamp < cutoffTime) {
            newMap.delete(message);
          }
        }
      }

      return newMap;
    });

    // Add the new message
    const messageId = counter;
    setCounter((prev) => prev + 1);

    const newMessage: Message = {
      id: messageId,
      text,
      type,
      timestamp: now,
    };

    setMessages((prev) => [...prev, newMessage]);

    // Set up automatic removal
    const duration = type === "error" ? ERROR_FADE_DURATION : MESSAGE_FADE_DURATION;
    setTimeout(() => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    }, duration);
  };

  // Auto-scroll to the newest message
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div id="message-log" className="game-messages" ref={containerRef}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`game-message-item ${message.type === "error" ? "error-message" : ""}`}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
};

export default MessageLog;
