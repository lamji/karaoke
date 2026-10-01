"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SongThumbnail } from "@/components/song-thumbnail";
import { cn } from "@/lib/utils";
import type { QueueItem } from "@/types/queue";

type SortableQueueProps = {
  items: QueueItem[];
  onReorder: (items: QueueItem[]) => void;
  onRemove: (item: QueueItem) => void;
  removingId: string | null;
};

/** Host-only queue with drag-and-drop reordering and remove buttons. */
export function SortableQueue({ items, onReorder, onRemove, removingId }: SortableQueueProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    onReorder(arrayMove(items, from, to));
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No songs waiting.</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              index={index}
              removing={removingId === item.id}
              onRemove={onRemove}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

type SortableRowProps = {
  item: QueueItem;
  index: number;
  removing: boolean;
  onRemove: (item: QueueItem) => void;
};

function SortableRow({ item, index, removing, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-2",
        isDragging && "relative z-10 border-primary shadow-lg",
      )}
    >
      <button
        type="button"
        aria-label={`Drag ${item.title}`}
        className="cursor-grab touch-none p-1 text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-5" />
      </button>
      <span className="w-5 text-center text-sm font-bold tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <SongThumbnail src={item.thumbnail} className="w-16" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.requested_by}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${item.title}`}
        disabled={removing}
        onClick={() => onRemove(item)}
      >
        {removing ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
      </Button>
    </li>
  );
}
