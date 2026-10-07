"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi, errorMessage, isAbort, type ChatClient } from "@/lib/api";
import { MODEL_KEY } from "@/lib/config";
import type { ChatMessage, ChatSummary } from "@/lib/types";

export function useChatApp(client: ChatClient = chatApi) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [booting, setBooting] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const runId = useRef(0);

  const loadShell = useCallback(async () => {
    const [list, modelList, health] = await Promise.all([
      client.listChats(),
      client.listModels().catch(() => [] as string[]),
      client.health().catch(() => null),
    ]);
    setChats(list);
    setModels(modelList);
    const saved = window.localStorage.getItem(MODEL_KEY);
    const savedOk = saved && (modelList.length === 0 || modelList.includes(saved));
    setModel(savedOk ? saved : health?.model || modelList[0] || "");
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadShell();
        if (!cancelled) setError(null);
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadShell]);

  const chooseModel = (value: string) => {
    setModel(value);
    window.localStorage.setItem(MODEL_KEY, value);
  };

  const startNewChat = () => {
    runId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setOpening(false);
    setActiveId(null);
    setMessages([]);
    setDraft("");
    setError(null);
  };

  const openChat = async (id: number) => {
    const ticket = ++runId.current;
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setOpening(true);
    setActiveId(id);
    setError(null);
    try {
      const history = await client.listMessages(id);
      if (ticket !== runId.current) return;
      setMessages(history.filter((item) => item.role === "user" || item.role === "assistant"));
    } catch (loadError) {
      if (ticket !== runId.current) return;
      setMessages([]);
      setError(errorMessage(loadError));
    } finally {
      if (ticket === runId.current) setOpening(false);
    }
  };

  const removeChat = async (id: number) => {
    if (activeId === id) {
      runId.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      setStreaming(false);
      setActiveId(null);
      setMessages([]);
    }
    await client.deleteChat(id);
    setChats((prev) => prev.filter((chat) => chat.id !== id));
  };

  const stop = () => abortRef.current?.abort();

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;

    const ticket = runId.current;
    setDraft("");
    setError(null);
    setStreaming(true);

    try {
      let chatId = activeId;
      if (!chatId) {
        const created = await client.createChat();
        if (ticket !== runId.current) return;
        chatId = created.id;
        setActiveId(created.id);
        setChats((prev) => [created, ...prev.filter((chat) => chat.id !== created.id)]);
      }

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "" },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      await client.streamMessage(chatId, text, model, {
        signal: controller.signal,
        onToken: (token) => {
          if (ticket !== runId.current) return;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") return prev;
            next[next.length - 1] = { ...last, content: last.content + token };
            return next;
          });
        },
      });

      if (ticket !== runId.current) return;
      const list = await client.listChats();
      if (ticket === runId.current) setChats(list);
    } catch (sendError) {
      if (ticket !== runId.current) return;
      if (isAbort(sendError)) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
          return prev;
        });
        return;
      }
      const detail = errorMessage(sendError);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) {
          next[next.length - 1] = { ...last, content: detail };
          return next;
        }
        return [...prev, { role: "assistant", content: detail }];
      });
    } finally {
      if (ticket === runId.current) {
        setStreaming(false);
        abortRef.current = null;
      }
    }
  };

  const retry = async () => {
    setError(null);
    setBooting(true);
    try {
      await loadShell();
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBooting(false);
    }
  };

  const active = chats.find((chat) => chat.id === activeId) ?? null;

  return {
    chats,
    active,
    messages,
    draft,
    setDraft,
    streaming,
    booting,
    opening,
    error,
    models,
    model,
    chooseModel,
    startNewChat,
    openChat,
    removeChat,
    stop,
    submit,
    retry,
  };
}
