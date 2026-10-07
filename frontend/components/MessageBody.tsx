"use client";

import type { ReactNode } from "react";
import { parseMarkdown } from "@/lib/markdown";
import { CodeBlock } from "./CodeBlock";
import styles from "./chat.module.scss";

type MessageBodyProps = {
  content: string;
  caret?: boolean;
};

export function MessageBody({ content, caret = false }: MessageBodyProps) {
  const blocks = parseMarkdown(content);
  if (blocks.length === 0) {
    return caret ? <span className={styles.caret} /> : null;
  }

  return (
    <>
      {blocks.map((block, index) => {
        const last = caret && index === blocks.length - 1;
        if (block.type === "heading") {
          const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4";
          return (
            <Tag key={index}>
              {renderInline(block.text)}
              {last && <span className={styles.caret} />}
            </Tag>
          );
        }
        if (block.type === "code") {
          return (
            <div key={index}>
              <CodeBlock code={block.code} language={block.language} />
              {last && <span className={styles.caret} />}
            </div>
          );
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(item)}
                  {last && itemIndex === block.items.length - 1 && (
                    <span className={styles.caret} />
                  )}
                </li>
              ))}
            </ListTag>
          );
        }
        if (block.type === "rule") return <hr key={index} />;
        return (
          <p key={index}>
            {renderInline(block.text)}
            {last && <span className={styles.caret} />}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+`)/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("***")) {
      nodes.push(
        <strong key={index}>
          <em>{token.slice(3, -3)}</em>
        </strong>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={index} className={styles.inlineCode}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={index}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
    index += 1;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
