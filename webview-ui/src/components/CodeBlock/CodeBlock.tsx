import React, { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getLanguageFromPath } from "../../utils/getLanguageFromPath";
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme";
import {
  removeLeadingNonAlphanumeric,
  containerStyle,
  pathHeaderStyle,
  pathTextStyle,
  codeContainerStyle,
  syntaxHighlighterCustomStyle,
} from "./utils";

interface CodeBlockProps {
  code?: string;
  diff?: string;
  language?: string | undefined;
  path?: string;
  syntaxHighlighterStyle: SyntaxHighlighterStyle;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  diff,
  language,
  path,
  syntaxHighlighterStyle,
  isExpanded,
  onToggleExpand,
}) => {
  const inferredLanguage = useMemo(
    () => code && (language ?? (path ? getLanguageFromPath(path) : undefined)),
    [path, language, code]
  );

  return (
    <div style={containerStyle}>
      {path && (
        <div style={pathHeaderStyle} onClick={onToggleExpand}>
          <span style={pathTextStyle}>
            {removeLeadingNonAlphanumeric(path) + "\u200E"}
          </span>
          <span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
        </div>
      )}
      {(!path || isExpanded) && (
        <div style={codeContainerStyle}>
          <SyntaxHighlighter
            wrapLines={false}
            language={diff ? "diff" : inferredLanguage}
            style={{
              ...syntaxHighlighterStyle,
              'code[class*="language-"]': {
                background: "var(--vscode-editor-background)",
              },
              'pre[class*="language-"]': {
                background: "var(--vscode-editor-background)",
              },
            }}
            customStyle={syntaxHighlighterCustomStyle}
          >
            {code ?? diff ?? ""}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

export default CodeBlock;