"use client";

import { useState } from "react";
import type { ChatSummary } from "@/lib/types";
import styles from "./chat.module.scss";

type SidebarProps = {
  chats: ChatSummary[];
  activeId: number | null;
  model: string;
  models: string[];
  open: boolean;
  booting: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onModel: (model: string) => void;
};

const SUGGESTION_GROUPS = ["Сегодня", "Ранее"] as const;

export function Sidebar({
  chats,
  activeId,
  model,
  models,
  open,
  booting,
  onClose,
  onNew,
  onSelect,
  onDelete,
  onModel,
}: SidebarProps) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const groups = groupChats(chats);
  const options = model && !models.includes(model) ? [model, ...models] : models;

  return (
    <>
      <button
        type="button"
        className={`${styles.backdrop} ${open ? styles.backdropOn : ""}`}
        aria-label="Закрыть список чатов"
        onClick={onClose}
      />
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>C</span>
            <span>ChatBot</span>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <button type="button" className={styles.newChat} onClick={onNew}>
          <span>+</span>
          Новый чат
        </button>

        <div className={styles.chatList}>
          {booting &&
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={styles.skeleton} />
            ))}
          {!booting &&
            SUGGESTION_GROUPS.map((label) => {
              const items = label === "Сегодня" ? groups.today : groups.earlier;
              if (items.length === 0) return null;
              return (
                <section key={label}>
                  <p className={styles.groupLabel}>{label}</p>
                  {items.map((chat) => {
                    const pending = pendingId === chat.id;
                    const active = chat.id === activeId;
                    return (
                      <div
                        key={chat.id}
                        className={`${styles.chatRow} ${active ? styles.chatRowActive : ""}`}
                      >
                        <button
                          type="button"
                          className={styles.chatItem}
                          onClick={() => {
                            setPendingId(null);
                            onSelect(chat.id);
                          }}
                        >
                          {chat.topic || "Новый чат"}
                        </button>
                        <button
                          type="button"
                          className={styles.chatDelete}
                          onClick={() => {
                            if (!pending) {
                              setPendingId(chat.id);
                              return;
                            }
                            setPendingId(null);
                            onDelete(chat.id);
                          }}
                        >
                          {pending ? "Да" : "×"}
                        </button>
                      </div>
                    );
                  })}
                </section>
              );
            })}
        </div>

        <label className={styles.modelBox}>
          <span>Модель</span>
          {booting ? (
            <em>Загрузка…</em>
          ) : options.length > 0 ? (
            <select value={model} onChange={(event) => onModel(event.target.value)}>
              {options.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <em>{model || "Ollama недоступна"}</em>
          )}
        </label>
      </aside>
    </>
  );
}

function groupChats(chats: ChatSummary[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today: ChatSummary[] = [];
  const earlier: ChatSummary[] = [];
  for (const chat of chats) {
    const stamp = chat.updated_at ?? chat.created_at;
    const date = stamp ? new Date(stamp) : null;
    if (date && !Number.isNaN(date.getTime()) && date >= start) today.push(chat);
    else earlier.push(chat);
  }
  return { today, earlier };
}
