export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  role: Role;
  content: string;
  created_at?: string | null;
};

export type ChatSummary = {
  id: number;
  topic: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type HealthInfo = {
  status: string;
  message: string;
  model: string;
  ollama: string;
};

export type StreamHandlers = {
  signal: AbortSignal;
  onToken: (token: string) => void;
};
