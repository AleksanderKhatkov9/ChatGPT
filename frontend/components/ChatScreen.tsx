"use client";

import { useEffect, useState } from "react";
import { useChatApp } from "@/hooks/useChatApp";
import { Composer } from "./Composer";
import { Sidebar } from "./Sidebar";
import { Thread } from "./Thread";
import styles from "./chat.module.scss";

export function ChatScreen() {
  const chat = useChatApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectChat = (id: number) => {
    setSidebarOpen(false);
    void chat.openChat(id);
  };

  const newChat = () => {
    setSidebarOpen(false);
    chat.startNewChat();
  };

  return (
    <div className={styles.shell}>
      <Sidebar
        chats={chat.chats}
        activeId={chat.active?.id ?? null}
        model={chat.model}
        models={chat.models}
        open={sidebarOpen}
        booting={chat.booting}
        onClose={() => setSidebarOpen(false)}
        onNew={newChat}
        onSelect={selectChat}
        onDelete={(id) => void chat.removeChat(id)}
        onModel={chat.chooseModel}
      />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setSidebarOpen(true)}
            aria-label="Открыть чаты"
          >
            <span />
            <span />
            <span />
          </button>
          <h2>{chat.active?.topic || "Новый чат"}</h2>
        </header>

        {chat.error && (
          <div className={styles.banner}>
            <span>{chat.error}</span>
            <button type="button" onClick={() => void chat.retry()}>
              Повторить
            </button>
          </div>
        )}

        <Thread
          messages={chat.messages}
          streaming={chat.streaming}
          opening={chat.opening}
          onSuggest={(text) => void chat.submit(text)}
        />
        <Composer
          value={chat.draft}
          busy={chat.streaming}
          onChange={chat.setDraft}
          onSend={() => void chat.submit(chat.draft)}
          onStop={chat.stop}
        />
      </main>
    </div>
  );
}
