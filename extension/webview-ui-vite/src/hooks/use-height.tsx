import { useEffect, useState, RefObject } from "react";

/**
 * Custom hook that calculates and tracks the height of a referenced element
 * @param ref - React ref object pointing to the target element
 * @returns The current height of the referenced element in pixels
 */
export function useHeight(ref: RefObject<HTMLElement>): number {
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    const calculateHeight = () => {
      if (ref.current) {
        const elementHeight = ref.current.getBoundingClientRect().height;
        setHeight(elementHeight);
      }
    };

    // Initial height calculation
    calculateHeight();

    // Recalculate on window resize
    window.addEventListener("resize", calculateHeight);

    // Cleanup
    return () => {
      window.removeEventListener("resize", calculateHeight);
    };
  }, [ref]);

  return height;
}