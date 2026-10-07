export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "rule" };

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    const fence = trimmed.match(/^```([\w-]*)\s*$/);

    if (fence) {
      const language = fence[1] ?? "";
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language, code: code.join("\n") });
      continue;
    }

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    const listMatch = trimmed.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d+\./.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^([-*]|\d+\.)\s+(.+)$/);
        if (!item) break;
        const itemOrdered = /^\d+\./.test(item[1]);
        if (itemOrdered !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && isParagraphLine(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    const text = paragraph.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
  }

  return blocks;
}

function isParagraphLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("```")) return false;
  if (/^(#{1,4})\s+/.test(trimmed)) return false;
  if (/^([-*]|\d+\.)\s+/.test(trimmed)) return false;
  if (/^([-*_])\1{2,}$/.test(trimmed)) return false;
  return true;
}
