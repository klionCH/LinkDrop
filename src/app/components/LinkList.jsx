'use client'
import { Trash2 } from "lucide-react"
import {
    DndContext,
    closestCenter,
    useSensor,
    useSensors,
    PointerSensor
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import { GripVertical } from 'lucide-react'
import {Button} from "@/components/ui/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator, ContextMenuTrigger
} from "@/components/ui/context-menu";

export function DraggableLink({ link, onDelete }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: link.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        zIndex: isDragging ? 999 : 'auto',
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    ref={setNodeRef}
                    style={style}
                    className="bg-white p-3 rounded shadow flex items-center gap-4 w-full"
                >
                    {/* Drag Handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab text-gray-500 hover:text-black pt-1"
                    >
                        <GripVertical size={18} />
                    </div>

                    {/* Inhalt (Bild + Text + Button) */}
                    <div className="flex items-center justify-between gap-4 w-[calc(100%-2rem)]">

                        {/* Bild + Textblock */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Bild: fix */}
                            {link.image && (
                                <img
                                    src={link.image}
                                    alt="Vorschau"
                                    className="w-14 h-14 object-cover rounded shrink-0"
                                />
                            )}

                            {/* Textblock: passt sich an */}
                            <div className="flex flex-col min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{link.title}</p>
                                <p className="text-sm text-gray-600 truncate">{link.url}</p>
                            </div>
                        </div>

                        {/* Button: shrinkt nicht */}
                        <div className="shrink-0">
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                                <Button className="px-3 py-1 text-sm">Besuchen</Button>
                            </a>
                        </div>
                    </div>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuLabel>Link-Aktion</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem
                    className="text-red-600"
                    onClick={() => onDelete(link.id)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Löschen
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}

export default function LinkList({ links, onReorder, onDelete }) {
    const [items, setItems] = useState([])

    useEffect(() => {
        const list = Object.values(links.Links || {})
        const sorted = list.sort((a, b) => a.position - b.position)
        setItems(sorted)
    }, [links])

    const sensors = useSensors(useSensor(PointerSensor))

    const handleDragEnd = (event) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        setItems(newItems)
        if (onReorder) onReorder(newItems)
    }

    return (
        <div className="w-full max-w-xl  p-4 space-y-2">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="flex flex-col gap-3 max-w-[90vw] md:max-w-[700px] w-full mx-auto">
                        {items.length === 0 ? (
                        <p className="text-gray-600">Keine Links vorhanden.</p>
                        ) : (
                            items.map(link => <DraggableLink key={link.id} link={link} onDelete={onDelete} />)
                        )}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
