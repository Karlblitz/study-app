import { ChevronRight } from "lucide-react";

export function Breadcrumb({ className = "", ...props }) {
  return <nav aria-label="breadcrumb" className={`study-breadcrumb ${className}`} {...props} />;
}

export function BreadcrumbList({ className = "", ...props }) {
  return <ol className={`study-breadcrumb-list ${className}`} {...props} />;
}

export function BreadcrumbItem({ className = "", ...props }) {
  return <li className={`study-breadcrumb-item ${className}`} {...props} />;
}

export function BreadcrumbLink({ className = "", href = "#", ...props }) {
  return <a href={href} className={`study-breadcrumb-link ${className}`} {...props} />;
}

export function BreadcrumbPage({ className = "", ...props }) {
  return <span aria-current="page" aria-disabled="true" className={`study-breadcrumb-page ${className}`} {...props} />;
}

export function BreadcrumbSeparator({ className = "", children, ...props }) {
  return <li aria-hidden="true" className={`study-breadcrumb-separator ${className}`} {...props}>{children || <ChevronRight size={13} />}</li>;
}
