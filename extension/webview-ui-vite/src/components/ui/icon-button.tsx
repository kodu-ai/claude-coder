import * as React from "react"
import { Button } from "./button"
import type { ButtonProps } from "./button"

export interface IconButtonProps extends ButtonProps {
  children: React.ReactNode
}

export function IconButton({ 
  className = "",
  variant = "ghost",
  size = "icon",
  ...props 
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={`h-8 w-8 p-0 ${className}`}
      {...props}
    />
  )
}

IconButton.displayName = "IconButton"