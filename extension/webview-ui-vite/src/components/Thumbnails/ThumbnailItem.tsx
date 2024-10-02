import React, { useState } from 'react';

interface ThumbnailItemProps {
  image: string;
  index: number;
  isDeletable: boolean;
  onDelete: (index: number) => void;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({ image, index, isDeletable, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={image}
        alt={`Thumbnail ${index + 1}`}
        style={{
          width: 34,
          height: 34,
          objectFit: "cover",
          borderRadius: 4,
        }}
      />
      {isDeletable && isHovered && (
        <div
          onClick={() => onDelete(index)}
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 13,
            height: 13,
            borderRadius: "50%",
            backgroundColor: "var(--vscode-badge-background)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <span
            className="codicon codicon-close"
            style={{
              color: "var(--vscode-foreground)",
              fontSize: 10,
              fontWeight: "bold",
            }}
          ></span>
        </div>
      )}
    </div>
  );
};

export default ThumbnailItem;