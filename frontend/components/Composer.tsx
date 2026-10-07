"use client";

import { useEffect, useRef } from "react";
import styles from "./chat.module.scss";

type ComposerProps = {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
};

export function Composer({ value, busy, onChange, onSend, onStop }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 180)}px`;
  }, [value]);

  return (
    <div className={styles.composerDock}>
      <div className={styles.composer}>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder="Спросите что угодно"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!busy) onSend();
            }
          }}
        />
        {busy ? (
          <button type="button" className={styles.stopButton} onClick={onStop} aria-label="Остановить">
            <span />
          </button>
        ) : (
          <button
            type="button"
            className={styles.sendButton}
            onClick={onSend}
            disabled={!value.trim()}
            aria-label="Отправить"
          >
            <Arrow />
          </button>
        )}
      </div>
      <p className={styles.hint}>Локальная модель Ollama. Проверяйте важные ответы.</p>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
