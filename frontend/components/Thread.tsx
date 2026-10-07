"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import { MessageBody } from "./MessageBody";
import styles from "./chat.module.scss";

const SUGGESTIONS = [
  "Объясни SOLID простыми словами",
  "Сравни SQL JOIN на примере",
  "Помоги отрефакторить функцию",
];

type ThreadProps = {
  messages: ChatMessage[];
  streaming: boolean;
  opening: boolean;
  onSuggest: (text: string) => void;
};

export function Thread({ messages, streaming, opening, onSuggest }: ThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
  }, [messages, streaming, opening]);

  if (opening) {
    return (
      <div className={styles.thread}>
        <div className={styles.empty}>
          <div className={styles.dots} aria-label="Загрузка">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={styles.thread}>
        <div className={styles.empty}>
          <div className={styles.emptyGlow} />
          <div className={styles.emptyMark}>C</div>
          <h1>Чем могу помочь?</h1>
          <p>Локальная модель через Ollama. История остаётся в ваших чатах.</p>
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((text) => (
              <button key={text} type="button" onClick={() => onSuggest(text)}>
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.thread}>
      <div className={styles.column}>
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          const showCaret = streaming && isLast && message.role === "assistant" && !!message.content;
          const showDots = streaming && isLast && message.role === "assistant" && !message.content;

          if (message.role === "user") {
            return (
              <div key={index} className={styles.rowUser}>
                <div className={styles.bubble}>{message.content}</div>
              </div>
            );
          }

          return (
            <div key={index} className={styles.rowAssistant}>
              <span className={styles.avatar}>C</span>
              <div className={styles.assistantBody}>
                {showDots ? (
                  <div className={styles.dots} aria-label="Модель отвечает">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : (
                  <MessageBody content={message.content} caret={showCaret} />
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
