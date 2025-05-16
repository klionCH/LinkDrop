'use client'
import AddLinkInput from "@/app/components/AddLinkInput"
import LinkList from "@/app/components/LinkList"
import {useEffect, useRef, useState} from "react"
import {Button} from "@/components/ui/button";

export default function Home() {
    const [data, setData] = useState({ Links: {} })
    const [loadingLinks, setLoadingLinks] = useState({})

    useEffect(() => {
        const stored = localStorage.getItem("list")
        if (stored) {
            setData(JSON.parse(stored))
        } else {
            localStorage.setItem("list", JSON.stringify({ Links: {} }))
        }
    }, [])

    useEffect(() => {
        localStorage.setItem("list", JSON.stringify(data))
    }, [data])

    const addLink = async (newUrl) => {
        // Generiere eine temporäre ID für den Ladezustand
        const tempId = `temp-${Date.now()}`

        // Erstelle einen neuen Eintrag mit Ladezustand
        const newPosition = Object.keys(data.Links).length + 1
        const loadingEntry = {
            id: tempId,
            url: newUrl,
            title: "Wird geladen...",
            image: '',
            position: newPosition,
            isLoading: true
        }

        // Füge den Ladezustand zum State hinzu
        setLoadingLinks(prev => ({
            ...prev,
            [tempId]: loadingEntry
        }))

        try {
            // Hole die Link-Vorschau
            const response = await fetch(`/api/link-preview?url=${encodeURIComponent(newUrl)}`)
            const preview = await response.json()

            const links = data.Links
            const newId = Object.keys(links).length + 1

            const newEntry = {
                id: newId,
                url: newUrl,
                title: preview.title || newUrl,
                image: preview.image || '',
                position: newPosition
            }

            // Füge den neuen Link hinzu
            setData(prev => ({
                Links: {
                    ...prev.Links,
                    [newId]: newEntry
                }
            }))

            // Entferne den Ladezustand
            setLoadingLinks(prev => {
                const updated = {...prev}
                delete updated[tempId]
                return updated
            })
        } catch (error) {
            console.error("Fehler beim Laden der Link-Vorschau:", error)

            // Bei einem Fehler fügen wir trotzdem einen Link hinzu, aber ohne Vorschau
            const links = data.Links
            const newId = Object.keys(links).length + 1

            const fallbackEntry = {
                id: newId,
                url: newUrl,
                title: newUrl,
                image: '',
                position: newPosition
            }

            setData(prev => ({
                Links: {
                    ...prev.Links,
                    [newId]: fallbackEntry
                }
            }))

            // Entferne den Ladezustand
            setLoadingLinks(prev => {
                const updated = {...prev}
                delete updated[tempId]
                return updated
            })
        }
    }

    const handleDelete = (id) => {
        const updatedLinks = { ...data.Links }
        delete updatedLinks[id]

        const updatedData = { Links: updatedLinks }
        setData(updatedData)
        localStorage.setItem("list", JSON.stringify(updatedData))
    }


    const reorderLinks = (sortedItems) => {
        const reorderedLinks = {}
        sortedItems.forEach((item, index) => {
            reorderedLinks[item.id] = {
                ...item,
                position: index + 1
            }
        })

        setData({ Links: reorderedLinks })
    }

    const handleExportAsWlFile = () => {
        const json = JSON.stringify(data)
        const blob = new Blob([json], {
            type: 'application/octet-stream' // NICHT application/json!
        })
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = 'wishlist-export.wl' // .wl oder .json → dein Format
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    const handleImportFromFile = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const result = event.target.result
                const parsed = JSON.parse(result)
                if (!parsed || typeof parsed !== "object" || !parsed.Links) {
                    throw new Error("Ungültige Struktur")
                }

                localStorage.setItem("list", JSON.stringify(parsed))
                window.location.reload() // oder setData(parsed), wenn State
            } catch (err) {
                alert("Fehler beim Importieren: Ungültige Datei.")
                console.error(err)
            }
        }
        reader.readAsText(file)
    }

    const fileInputRef = useRef(null)

    const handleOpenFileDialog = () => {
        fileInputRef.current?.click()
    }

    return (
        <div className="flex flex-col items-center pt-20">
            <AddLinkInput onUrlChange={addLink} />
            <LinkList
                links={data}
                loadingLinks={loadingLinks}
                onReorder={reorderLinks}
                onDelete={handleDelete}
            />

            {/* Fixed Export/Import Buttons */}
            <div className="fixed bottom-4 right-4 flex gap-2 z-50">
                <Button onClick={handleExportAsWlFile}>Exportieren</Button>
                <Button variant="outline" onClick={handleOpenFileDialog}>Importieren</Button>
                <input
                    type="file"
                    accept=".wl"
                    onChange={handleImportFromFile}
                    ref={fileInputRef}
                    className="hidden"
                />
            </div>
        </div>
    )
}