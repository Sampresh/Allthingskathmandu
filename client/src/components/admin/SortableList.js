'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

function Row({ item, label, renderItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-box border border-border bg-surface p-2 ${isDragging ? 'shadow-overlay' : ''}`}
    >
      <button
        type="button"
        className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-box hover:bg-surface-raised"
        aria-label={`Reorder ${label(item)}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>
      <div className="min-w-0 flex-1">{renderItem(item)}</div>
    </li>
  )
}

/**
 * Drag to reorder (Part 4 §3), with mouse, touch or keyboard (Space to lift, arrows to move,
 * Space to drop). Calls onReorder with the items in their new order.
 */
export function SortableList({ items, onReorder, renderItem, label = (i) => i.name ?? i.id }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <Row key={item.id} item={item} label={label} renderItem={renderItem} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
