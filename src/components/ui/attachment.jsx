import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

const AttachmentContext = createContext({ size: "default", orientation: "horizontal" });

export function Attachment({ state = "done", size = "default", orientation = "horizontal", className, ...props }) {
  return <AttachmentContext.Provider value={{ size, orientation }}>
    <div data-state={state} data-size={size} data-orientation={orientation} className={cn("study-attachment", `study-attachment-${state}`, `study-attachment-${size}`, `study-attachment-${orientation}`, className)} {...props} />
  </AttachmentContext.Provider>;
}

export function AttachmentMedia({ className, children, ...props }) {
  return <div className={cn("study-attachment-media", className)} {...props}>{children}</div>;
}

export function AttachmentContent({ className, ...props }) {
  return <div className={cn("study-attachment-content", className)} {...props} />;
}

export function AttachmentTitle({ className, ...props }) {
  return <strong className={cn("study-attachment-title", className)} {...props} />;
}

export function AttachmentDescription({ className, ...props }) {
  return <span className={cn("study-attachment-description", className)} {...props} />;
}

export function AttachmentActions({ className, ...props }) {
  return <div className={cn("study-attachment-actions", className)} {...props} />;
}

export function AttachmentAction({ size, className, ...props }) {
  const context = useContext(AttachmentContext);
  return <button type="button" className={cn("study-attachment-action", `study-attachment-action-${size || (context.size === "xs" ? "xs" : "sm")}`, className)} {...props} />;
}

export function AttachmentTrigger({ className, ...props }) {
  return <button type="button" className={cn("study-attachment-trigger", className)} {...props} />;
}

export function AttachmentGroup({ className, ...props }) {
  return <div role="group" className={cn("study-attachment-group", className)} {...props} />;
}
