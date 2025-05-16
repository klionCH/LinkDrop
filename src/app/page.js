'use client'
import AddLinkInput from "@/app/components/AddLinkInput"
import LinkList from "@/app/components/LinkList"
import {useEffect, useRef, useState} from "react"
import {Button} from "@/components/ui/button";

export default function Home() {
    const [data, setData] = useState({ Links: {} })
    const [loadingLinks, setLoadingLinks] = useState({})
    // Cache für Link-Vorschauen
    const [previewCache, setPreviewCache] = useState({})

    useEffect(() => {
        const stored = localStorage.getItem("list")
        if (stored) {
            try {
                setData(JSON.parse(stored))
            } catch (e) {
                console.error("Fehler beim Parsen der gespeicherten Daten:", e)
                localStorage.setItem("list", JSON.stringify({ Links: {} }))
            }
        } else {
            localStorage.setItem("list", JSON.stringify({ Links: {} }))
        }

        // Cache für Link-Vorschauen aus dem LocalStorage laden
        const storedCache = localStorage.getItem("previewCache")
        if (storedCache) {
            try {
                setPreviewCache(JSON.parse(storedCache))
            } catch (e) {
                console.error("Fehler beim Parsen des Preview-Cache:", e)
            }
        }
    }, [])

    useEffect(() => {
        localStorage.setItem("list", JSON.stringify(data))
    }, [data])

    // Cache für Link-Vorschauen speichern
    useEffect(() => {
        localStorage.setItem("previewCache", JSON.stringify(previewCache))
    }, [previewCache])

    const addLink = async (newUrl) => {
        // Normalisiere URL für konsistente Darstellung
        let formattedUrl = newUrl
        if (!formattedUrl.startsWith('http')) {
            formattedUrl = `https://${formattedUrl}`
        }

        // Generiere eine temporäre ID für den Ladezustand
        const tempId = `temp-${Date.now()}`

        // Bestimme die neue Position
        const newPosition = Object.keys(data.Links).length + 1

        // Erstelle einen neuen Eintrag mit Ladezustand
        const loadingEntry = {
            id: tempId,
            url: formattedUrl,
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
            // Prüfen, ob die Vorschau bereits im Cache ist
            const cacheKey = encodeURIComponent(formattedUrl)
            let preview = previewCache[cacheKey]

            if (!preview) {
                // Wenn nicht im Cache, anfragen
                // Hole die Link-Vorschau mit Timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 Sekunden Timeout

                const response = await fetch(`/api/link-preview?url=${encodeURIComponent(formattedUrl)}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok && response.status !== 408) { // 408 = Timeout, trotzdem weiter verarbeiten
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                preview = await response.json();

                // Cache aktualisieren
                if (!preview.error) {
                    setPreviewCache(prev => ({
                        ...prev,
                        [cacheKey]: preview
                    }))
                }
            }

            const links = data.Links
            const newId = Object.keys(links).length + 1

            // Sicherstellen, dass wir einen Fallback-Titel haben
            let title = preview.title || "Unbekannte Webseite"
            let image = preview.image || ''

            // Fallback: Domain als Titel verwenden
            if (title === "Unbekannte Webseite") {
                try {
                    const urlObj = new URL(formattedUrl);
                    title = urlObj.hostname;
                } catch (e) {
                    // URL konnte nicht geparst werden, beim Fallback bleiben
                }
            }

            const newEntry = {
                id: newId,
                url: formattedUrl,
                title,
                image,
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

            // URL-Objekt erstellen, um den Hostnamen zu extrahieren
            let hostname;
            try {
                const urlObj = new URL(formattedUrl);
                hostname = urlObj.hostname;
            } catch (e) {
                hostname = formattedUrl;
            }

            const fallbackEntry = {
                id: newId,
                url: formattedUrl,
                title: hostname || formattedUrl,
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
        // Wenn es sich um einen Link im Ladezustand handelt
        if (id.toString().startsWith('temp-')) {
            setLoadingLinks(prev => {
                const updated = {...prev}
                delete updated[id]
                return updated
            })
            return
        }

        // Ansonsten normalen Link löschen
        const updatedLinks = { ...data.Links }
        delete updatedLinks[id]

        const updatedData = { Links: updatedLinks }
        setData(updatedData)
        localStorage.setItem("list", JSON.stringify(updatedData))
    }


    const reorderLinks = (sortedItems) => {
        // Filtere temporäre Lade-Links heraus, da wir nur die echten Links neu ordnen wollen
        const realLinks = sortedItems.filter(item => !item.id.toString().startsWith('temp-'))

        const reorderedLinks = {}
        realLinks.forEach((item, index) => {
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
                setData(parsed) // State direkt setzen statt Seite neu zu laden
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