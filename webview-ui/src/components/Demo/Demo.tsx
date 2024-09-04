import React from 'react';
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import DataGridDemo from './DataGridDemo';
import TextFieldWithButtons from './TextFieldWithButtons';
import MiscElements from './MiscElements';

const Demo: React.FC = () => {
  return (
    <main>
      <h1>Hello World!</h1>
      <VSCodeButton>Howdy!</VSCodeButton>

      <div className="grid gap-3 p-2 place-items-start">
        <DataGridDemo />
        <TextFieldWithButtons />
        <MiscElements />
      </div>
    </main>
  );
};

export default Demo;