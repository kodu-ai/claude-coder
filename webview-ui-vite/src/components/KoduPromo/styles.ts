import styled from 'styled-components';

export const PromoContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--vscode-editor-inactiveSelectionBackground);
  color: var(--vscode-textLink-foreground);
  padding: 6px 8px;
  border-radius: 3px;
  margin: 0 0 8px 0px;
  font-size: 12px;
  cursor: pointer;
`;

export const PromoLink = styled.a`
  text-decoration: none;
  color: inherit;
  outline: none;
  display: flex;
  align-items: center;

  i {
    margin-right: 6px;
    font-size: 16px;
  }
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  font-size: 12px;
  opacity: 0.7;
  padding: 0;
  margin-left: 4px;
  margin-top: 2px;

  &:hover {
    opacity: 1;
  }
`;