import React from 'react';
import {
  VSCodeDataGrid,
  VSCodeDataGridRow,
  VSCodeDataGridCell,
} from "@vscode/webview-ui-toolkit/react";

const rowData = [
  {
    cell1: "Cell Data",
    cell2: "Cell Data",
    cell3: "Cell Data",
    cell4: "Cell Data",
  },
  {
    cell1: "Cell Data",
    cell2: "Cell Data",
    cell3: "Cell Data",
    cell4: "Cell Data",
  },
  {
    cell1: "Cell Data",
    cell2: "Cell Data",
    cell3: "Cell Data",
    cell4: "Cell Data",
  },
];

const DataGridDemo: React.FC = () => (
  <VSCodeDataGrid>
    <VSCodeDataGridRow row-type="header">
      <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
        A Custom Header Title
      </VSCodeDataGridCell>
      <VSCodeDataGridCell cell-type="columnheader" grid-column="2">
        Another Custom Title
      </VSCodeDataGridCell>
      <VSCodeDataGridCell cell-type="columnheader" grid-column="3">
        Title Is Custom
      </VSCodeDataGridCell>
      <VSCodeDataGridCell cell-type="columnheader" grid-column="4">
        Custom Title
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
    {rowData.map((row, index) => (
      <VSCodeDataGridRow key={index}>
        <VSCodeDataGridCell grid-column="1">{row.cell1}</VSCodeDataGridCell>
        <VSCodeDataGridCell grid-column="2">{row.cell2}</VSCodeDataGridCell>
        <VSCodeDataGridCell grid-column="3">{row.cell3}</VSCodeDataGridCell>
        <VSCodeDataGridCell grid-column="4">{row.cell4}</VSCodeDataGridCell>
      </VSCodeDataGridRow>
    ))}
  </VSCodeDataGrid>
);

export default DataGridDemo;