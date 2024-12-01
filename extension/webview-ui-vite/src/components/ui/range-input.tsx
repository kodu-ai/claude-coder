"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface RangeInputProps {
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (value: number) => void
  label?: string
  description?: string
  className?: string
}

export function RangeInput({
  min = 2000,
  max = 200000,
  step = 1000,
  value,
  onChange,
  label = "Compression Threshold",
  description = "Compress terminal output to reduce token usage when the output exceeds the threshold",
  className,
}: RangeInputProps) {
  const handleSliderChange = (newValue: number[]) => {
    onChange(newValue[0])
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value)
    if (!isNaN(newValue)) {
      onChange(Math.min(Math.max(newValue, min), max))
    }
  }

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="grid gap-2">
        <Label htmlFor="range">{label}</Label>
        <div className="grid gap-4">
          <div className="flex items-center gap-4">
            <Input
              id="range"
              type="number"
              value={value}
              onChange={handleInputChange}
              min={min}
              max={max}
              step={step}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">
              ({min.toLocaleString()} - {max.toLocaleString()})
            </span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[value]}
            onValueChange={handleSliderChange}
            className="w-full"
          />
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}