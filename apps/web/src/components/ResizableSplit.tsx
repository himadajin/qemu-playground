import { Splitter, type SplitterProps } from "@mantine/core";
import { forwardRef } from "react";

type ResizableSplitProps = Omit<
  SplitterProps,
  | "attributes"
  | "classNames"
  | "lineSize"
  | "resetOnDoubleClick"
  | "shiftStep"
  | "step"
  | "withHandle"
> & {
  ariaLabel: string;
  ariaControls?: string;
  ariaValueText?: string;
};

/** Shared Mantine Splitter defaults for the playground's horizontal pane dividers. */
export const ResizableSplit = forwardRef<HTMLDivElement, ResizableSplitProps>(
  function ResizableSplit(
    { ariaLabel, ariaControls, ariaValueText, className, children, ...props },
    ref,
  ) {
    return (
      <Splitter
        {...props}
        ref={ref}
        className={className ? `resizable-split ${className}` : "resizable-split"}
        classNames={{ pane: "resizable-split__pane", handle: "resizable-split__divider" }}
        step="16px"
        shiftStep="16px"
        resetOnDoubleClick={false}
        withHandle={false}
        lineSize={0}
        attributes={{
          handle: {
            "aria-label": ariaLabel,
            ...(ariaControls ? { "aria-controls": ariaControls } : {}),
            ...(ariaValueText ? { "aria-valuetext": ariaValueText } : {}),
          },
        }}
      >
        {children}
      </Splitter>
    );
  },
);
