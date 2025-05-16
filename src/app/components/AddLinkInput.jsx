'use client'
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function AddLinkInput({ onUrlChange }) {
    const [value, setValue] = useState("")

    const handleSubmit = (e) => {
        e.preventDefault()
        if (value.trim() !== "") {
            onUrlChange(value.trim())
            setValue("")
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
                type="text"
                placeholder="Neuer Link hier einfügen"
                value={value}
                onChange={(e) => setValue(e.target.value)}
            />
            <Button type="submit" disabled={!value.trim()}>
                Hinzufügen
            </Button>
        </form>
    )
}
