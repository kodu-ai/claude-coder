import React, { useEffect, useRef } from 'react';

interface TerminalMirrorProps {
  textareaValue: string;
  cursorPosition: number;
  isFocused: boolean;
  shouldAllowInput: boolean;
}

const TerminalMirror: React.FC<TerminalMirrorProps> = ({
  textareaValue,
  cursorPosition,
  isFocused,
  shouldAllowInput,
}) => {
  const mirrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mirrorRef.current) return;

    const textBeforeCursor = textareaValue.substring(0, cursorPosition);
    const textAfterCursor = textareaValue.substring(cursorPosition);

    mirrorRef.current.innerHTML = '';
    mirrorRef.current.appendChild(document.createTextNode(textBeforeCursor));

    const caretEle = document.createElement('span');
    caretEle.classList.add('terminal-cursor');
    if (isFocused) {
      caretEle.classList.add('terminal-cursor-focused');
    }
    if (!shouldAllowInput) {
      caretEle.classList.add('terminal-cursor-hidden');
    }
    caretEle.innerHTML = '&nbsp;';
    mirrorRef.current.appendChild(caretEle);

    mirrorRef.current.appendChild(document.createTextNode(textAfterCursor));
  }, [textareaValue, cursorPosition, isFocused, shouldAllowInput]);

  return <div ref={mirrorRef} className="terminal-mirror"></div>;
};

export default TerminalMirror;