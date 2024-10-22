import type { TextareaAutosizeProps } from 'react-textarea-autosize'

export const terminalContainerStyle = `
  .terminal-container {
    position: relative;
    overflow: hidden;
  }

  .terminal-textarea {
    background: transparent;
    caret-color: transparent;
    position: relative;
    z-index: 1;
  }

  .terminal-mirror {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
    color: transparent;
    z-index: 0;
  }

  .terminal-cursor {
    border: 1px solid var(--vscode-terminal-foreground, #FFFFFF);
    position: absolute;
    width: 4px;
    margin-top: -0.5px;
  }

  .terminal-cursor-focused {
    background-color: var(--vscode-terminal-foreground, #FFFFFF);
    animation: blink 1s step-end infinite;
  }

  .terminal-cursor-hidden {
    display: none;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
`

export const textAreaStyle: TextareaAutosizeProps['style'] = {
	fontFamily: 'var(--vscode-editor-font-family)',
	fontSize: 'var(--vscode-editor-font-size)',
	padding: '10px',
	border: '1px solid var(--vscode-editorGroup-border)',
	outline: 'none',
	whiteSpace: 'pre-wrap',
	overflow: 'hidden',
	width: '100%',
	boxSizing: 'border-box',
	resize: 'none',
	caretColor: 'transparent',
	color: 'var(--vscode-terminal-foreground)',
	borderRadius: '3px',
}
