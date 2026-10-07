import { API_URL } from "./config";
import type { ChatMessage, ChatSummary, HealthInfo, StreamHandlers } from "./types";

const OFFLINE =
  "Не удалось связаться с сервером. Запустите backend на порту 8000.";

export interface ChatClient {
  health(): Promise<HealthInfo>;
  listModels(): Promise<string[]>;
  listChats(): Promise<ChatSummary[]>;
  createChat(topic?: string): Promise<ChatSummary>;
  deleteChat(id: number): Promise<void>;
  listMessages(id: number): Promise<ChatMessage[]>;
  streamMessage(
    chatId: number,
    content: string,
    model: string,
    handlers: StreamHandlers
  ): Promise<void>;
}

export const chatApi: ChatClient = {
  health: () => getJson<HealthInfo>("/api/health"),
  listModels: async () => {
    const data = await getJson<{ models: string[] }>("/api/models");
    return data.models ?? [];
  },
  listChats: () => getJson<ChatSummary[]>("/api/chats"),
  createChat: (topic = "Новый чат") =>
    sendJson<ChatSummary>("/api/chats", { topic }),
  deleteChat: async (id) => {
    const response = await fetch(`${API_URL}/api/chats/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await readError(response));
  },
  listMessages: (id) => getJson<ChatMessage[]>(`/api/chats/${id}/messages`),
  streamMessage: (chatId, content, model, handlers) =>
    readStream(chatId, content, model, handlers),
};

async function getJson<T>(path: string): Promise<T> {
  const response = await request(path);
  return response.json() as Promise<T>;
}

async function sendJson<T>(path: string, body: unknown): Promise<T> {
  const response = await request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new Error(OFFLINE);
  }
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function readStream(
  chatId: number,
  content: string,
  model: string,
  handlers: StreamHandlers
): Promise<void> {
  const response = await request(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ content, model: model || undefined }),
    signal: handlers.signal,
  });

  if (!response.body) throw new Error("Пустой ответ сервера");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawToken = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const dataLine = part
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const payload = JSON.parse(dataLine.slice(5).trim()) as {
        type?: string;
        text?: string;
        detail?: string;
      };
      if (payload.type === "token" && payload.text) {
        sawToken = true;
        handlers.onToken(payload.text);
      } else if (payload.type === "error" && !sawToken) {
        throw new Error(payload.detail || "Ошибка модели");
      }
    }
  }
}

async function readError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const data = JSON.parse(body) as { detail?: unknown };
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  } catch {
    /* response is not JSON */
  }
  return body.trim() || `Ошибка API (${response.status})`;
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Что-то пошло не так";
}
