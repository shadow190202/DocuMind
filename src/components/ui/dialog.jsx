"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useId,
  forwardRef,
  useImperativeHandle,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DialogContext = createContext({
  open: false,
  setOpen: () => {},
  dialogRef: null,
  titleId: "",
  descriptionId: "",
});

export function Dialog({ children, open: controlledOpen, onOpenChange }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dialogRef = useRef(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const baseId = useId();
  const titleId = `${baseId}-dialog-title`;
  const descriptionId = `${baseId}-dialog-description`;

  const setOpen = useCallback(
    (value) => {
      if (!isControlled) {
        setUncontrolledOpen(value);
      }
      if (onOpenChange) {
        onOpenChange(value);
      }
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider
      value={{ open, setOpen, dialogRef, titleId, descriptionId }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ children, asChild }) {
  const { setOpen } = useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        setOpen(true);
      },
    });
  }

  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

export const DialogContent = forwardRef(function DialogContent(
  { className, children, ...props },
  forwardedRef
) {
  const { open, setOpen, dialogRef: contextRef, titleId, descriptionId } =
    useContext(DialogContext);
  const internalRef = useRef(null);
  const dialogRef = contextRef || internalRef;
  const previouslyFocusedElement = useRef(null);

  useImperativeHandle(forwardedRef, () => dialogRef.current);

  // Exclude `open` prop so it is never passed to <dialog> HTML attributes
  const {
    open: _ignoredOpen,
    "aria-labelledby": customAriaLabelledBy,
    "aria-describedby": customAriaDescribedBy,
    ...restProps
  } = props;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        try {
          if (typeof document !== "undefined") {
            previouslyFocusedElement.current = document.activeElement;
          }
          dialog.showModal();
        } catch {
          // ignore if already open
        }
      }
    } else {
      if (dialog.open) {
        try {
          dialog.close();
        } catch {
          // ignore if already closed
        }
        if (
          previouslyFocusedElement.current &&
          typeof previouslyFocusedElement.current.focus === "function"
        ) {
          previouslyFocusedElement.current.focus();
        }
      }
    }

    return () => {
      if (dialog && dialog.open) {
        try {
          dialog.close();
        } catch {
          // ignore
        }
        if (
          previouslyFocusedElement.current &&
          typeof previouslyFocusedElement.current.focus === "function"
        ) {
          previouslyFocusedElement.current.focus();
        }
      }
    };
  }, [open, dialogRef]);

  const handleNativeClose = () => {
    setOpen(false);
  };

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      const clickedInDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!clickedInDialog) {
        setOpen(false);
      }
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleNativeClose}
      onCancel={handleNativeClose}
      onClick={handleBackdropClick}
      aria-modal="true"
      aria-labelledby={customAriaLabelledBy || titleId}
      aria-describedby={customAriaDescribedBy || descriptionId}
      className={cn(
        "m-auto p-6 bg-theme-panel text-theme-text rounded-2xl border border-theme-divider shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm max-w-lg w-full relative outline-none",
        className
      )}
      {...restProps}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close dialog"
        className="absolute right-4 top-4 rounded-lg p-1 text-theme-muted hover:text-theme-text hover:bg-theme-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary"
      >
        <X className="w-5 h-5" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </button>
      {children}
    </dialog>
  );
});

export function DialogHeader({ className, children }) {
  return (
    <div className={cn("flex flex-col space-y-2 text-left mb-4", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, id, children }) {
  const { titleId } = useContext(DialogContext);
  return (
    <h2
      id={id || titleId}
      className={cn("text-lg font-semibold text-theme-text", className)}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({ className, id, children }) {
  const { descriptionId } = useContext(DialogContext);
  return (
    <p
      id={id || descriptionId}
      className={cn("text-sm text-theme-muted", className)}
    >
      {children}
    </p>
  );
}

export function DialogFooter({ className, children }) {
  return (
    <div className={cn("flex items-center justify-end space-x-2 pt-4 mt-2 border-t border-theme-divider", className)}>
      {children}
    </div>
  );
}

export function DialogClose({ children, asChild }) {
  const { setOpen } = useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        setOpen(false);
      },
    });
  }

  return (
    <button type="button" onClick={() => setOpen(false)}>
      {children}
    </button>
  );
}
