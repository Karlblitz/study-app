import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

function Select(props) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectTrigger({ className = "", children, ...props }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={`profile-select-trigger ${className}`}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="profile-select-chevron" aria-hidden="true">
        <ChevronDown size={16} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectValue(props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectContent({ className = "", children, ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner className="profile-select-positioner" sideOffset={5}>
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={`profile-select-content ${className}`}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className = "", children, ...props }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={`profile-select-item ${className}`}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="profile-select-item-indicator">
        <Check size={15} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
