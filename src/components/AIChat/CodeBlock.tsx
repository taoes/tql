import { useRef, useEffect } from "react";
import hljs from "highlight.js/lib/core";
import sql from "highlight.js/lib/languages/sql";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import css from "highlight.js/lib/languages/css";
import markdown from "highlight.js/lib/languages/markdown";
import "highlight.js/styles/github-dark.css";

hljs.registerLanguage("sql", sql);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);

interface CodeBlockProps {
  domNode?: unknown;
  children?: React.ReactNode;
  lang?: string;
  block?: boolean;
  streamStatus?: "loading" | "done";
  className?: string;
  [key: string]: unknown;
}

/**
 * Syntax-highlighted code block for XMarkdown.
 * Overrides the <code> element: inline code passes through, block code gets highlight.js.
 */
export default function CodeBlock({
  block,
  lang,
  children,
  streamStatus,
  className,
  ...rest
}: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);

  // Inline code — no highlighting
  if (!block) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  // Apply highlight.js when streaming completes
  useEffect(() => {
    if (codeRef.current && streamStatus !== "loading") {
      codeRef.current.querySelectorAll("pre code").forEach((el) => {
        hljs.highlightElement(el as HTMLElement);
      });
    }
  }, [children, streamStatus]);

  const langClass = lang ? `language-${lang}` : "";

  // During streaming: plain rendering, no highlighting yet
  return (
    <code ref={codeRef} className={`${langClass} ${className || ""}`} {...rest}>
      {children}
    </code>
  );
}
