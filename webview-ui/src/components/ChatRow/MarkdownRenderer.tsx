import React from 'react';
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme";

interface MarkdownRendererProps {
  markdown: string;
  syntaxHighlighterStyle: SyntaxHighlighterStyle;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown, syntaxHighlighterStyle }) => {
  const parsed = markdown.replace(/<thinking>([\s\S]*?)<\/thinking>/g, (match, content) => {
    return `_<thinking>_\n\n${content}\n\n_</thinking>_`;
  });

  return (
    <div style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
      <Markdown
        children={parsed}
        components={{
          p(props) {
            const { style, ...rest } = props;
            return (
              <p
                style={{
                  ...style,
                  margin: 0,
                  marginTop: 0,
                  marginBottom: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
                {...rest}
              />
            );
          },
          ol(props) {
            const { style, ...rest } = props;
            return (
              <ol
                style={{
                  ...style,
                  padding: "0 0 0 20px",
                  margin: "10px 0",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
                {...rest}
              />
            );
          },
          ul(props) {
            const { style, ...rest } = props;
            return (
              <ul
                style={{
                  ...style,
                  padding: "0 0 0 20px",
                  margin: "10px 0",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
                {...rest}
              />
            );
          },
          code(props) {
            const { children, className, node, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              <SyntaxHighlighter
                {...(rest as any)}
                PreTag="div"
                children={String(children).replace(/\n$/, "")}
                language={match[1]}
                style={{
                  ...syntaxHighlighterStyle,
                  'code[class*="language-"]': {
                    background: "var(--vscode-editor-background)",
                  },
                  'pre[class*="language-"]': {
                    background: "var(--vscode-editor-background)",
                  },
                }}
                customStyle={{
                  overflowX: "auto",
                  overflowY: "hidden",
                  maxWidth: "100%",
                  margin: 0,
                  padding: "10px",
                  borderRadius: 3,
                  border: "1px solid var(--vscode-sideBar-border)",
                  fontSize: "var(--vscode-editor-font-size)",
                  lineHeight: "var(--vscode-editor-line-height)",
                  fontFamily: "var(--vscode-editor-font-family)",
                }}
              />
            ) : (
              <code
                {...rest}
                className={className}
                style={{
                  whiteSpace: "pre-line",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {children}
              </code>
            );
          },
        }}
      />
    </div>
  );
};

export default MarkdownRenderer;