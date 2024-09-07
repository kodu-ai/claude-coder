import React from 'react';
import { formatDate } from './utils';

interface TaskCardProps {
  id: string;
  task: string;
  ts: number;
  tokensIn: number;
  tokensOut: number;
  cacheWrites?: number;
  cacheReads?: number;
  totalCost: number;
  onSelect: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  id,
  task,
  ts,
  tokensIn,
  tokensOut,
  cacheWrites,
  cacheReads,
  totalCost,
  onSelect,
}) => (
  <div className="task-card is-clickable" onClick={() => onSelect(id)}>
    <div
      style={{
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      {task}
    </div>
    <div className="text-light">{formatDate(ts)}</div>
    <div className="text-light flex-line wrap" style={{ justifyContent: "space-between" }}>
      <div className="flex-line nowrap">
        Tokens:
        <code>
          <span>↑</span>
          {tokensIn.toLocaleString()}
        </code>
        <code>
          <span>↓</span>
          {tokensOut.toLocaleString()}
        </code>
      </div>
      {cacheWrites && cacheReads && (
        <div className="flex-line nowrap">
          Cache:
          <code>
            <span>+</span>
            {cacheWrites.toLocaleString()}
          </code>
          <code>
            <span>→</span>
            {cacheReads.toLocaleString()}
          </code>
        </div>
      )}
      <div className="flex-line nowrap">
        API Cost:
        <code>
          <span>$</span>
          {totalCost.toFixed(4)}
        </code>
      </div>
    </div>
  </div>
);

export default TaskCard;