"use client";

import { useEffect, useState } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import styles from "./chat.module.scss";

type CodeBlockProps = {
  code: string;
  language: string;
};

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node) return;
    node.textContent = code;
    try {
      hljs.highlightElement(node);
    } catch {
      /* unknown language stays as plain text */
    }
  }, [node, code, language]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.code}>
      <div className={styles.codeHeader}>
        <span>{language || "text"}</span>
        <button type="button" onClick={copy}>
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre>
        <code
          ref={setNode}
          className={language ? `language-${language}` : ""}
        />
      </pre>
    </div>
  );
}
