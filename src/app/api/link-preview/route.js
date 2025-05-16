import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

// Edge Runtime für bessere Performance und weniger Einschränkungen bei Vercel
export const config = {
    runtime: 'edge',
}

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'URL fehlt' }, { status: 400 })
    }

    // URL validieren und normalisieren
    let normalizedUrl;
    try {
        normalizedUrl = url.startsWith('http') ? url : `https://${url}`
        new URL(normalizedUrl); // Überprüfen, ob es eine gültige URL ist
    } catch (e) {
        return NextResponse.json({ error: 'Ungültiges URL-Format' }, { status: 400 })
    }

    try {
        // Timeout für die Anfrage setzen (wichtig für Serverless Functions)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 Sekunden Timeout

        // Erweiterte Header, um mehr wie ein Browser zu wirken
        const response = await fetch(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/90.0.4430.93 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.google.com/',
                'DNT': '1',
            },
            signal: controller.signal,
            redirect: 'follow', // Folge Redirects
            cache: 'no-store', // Kein Caching
        })

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        // Mehrere Möglichkeiten für den Titel durchgehen
        const title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text() ||
            new URL(normalizedUrl).hostname || ''

        // Mehrere Möglichkeiten für das Bild durchgehen
        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('meta[property="og:image:url"]').attr('content') ||
            ''

        // Relative URLs für Bilder zu absoluten machen
        if (image && !image.startsWith('http')) {
            const baseUrl = new URL(normalizedUrl)
            if (image.startsWith('//')) {
                image = `https:${image}`
            } else if (image.startsWith('/')) {
                image = `${baseUrl.origin}${image}`
            } else {
                image = `${baseUrl.origin}/${image}`
            }
        }

        // Als Fallback: Erstes Bild von der Seite nehmen (wenn kein Meta-Tag gefunden wurde)
        if (!image) {
            const firstImg = $('img[src]').first().attr('src')
            if (firstImg && firstImg.length > 10) { // Minimale Länge für valide Bildpfade
                if (!firstImg.startsWith('http')) {
                    const baseUrl = new URL(normalizedUrl)
                    if (firstImg.startsWith('//')) {
                        image = `https:${firstImg}`
                    } else if (firstImg.startsWith('/')) {
                        image = `${baseUrl.origin}${firstImg}`
                    } else {
                        image = `${baseUrl.origin}/${firstImg}`
                    }
                } else {
                    image = firstImg
                }
            }
        }

        // Zusätzliche Sicherheitsprüfung für das Bild
        if (image && !image.match(/^https?:\/\//)) {
            image = ''  // Ignoriere das Bild, wenn es kein http/https-Protokoll hat
        }

        return NextResponse.json({
            title: title.trim(),
            image: image.trim(),
            url: normalizedUrl
        })
    } catch (err) {
        console.error('Fehler bei der Link-Vorschau:', err)

        // Bei Timeout eine spezifische Antwort geben
        if (err.name === 'AbortError') {
            return NextResponse.json({
                error: 'Zeitüberschreitung bei der Anfrage',
                title: new URL(normalizedUrl).hostname,
                url: normalizedUrl
            }, { status: 408 })
        }

        // Bei anderen Fehlern zumindest die Domain als Titel zurückgeben
        try {
            const urlObj = new URL(normalizedUrl)
            return NextResponse.json({
                title: urlObj.hostname,
                image: '',
                url: normalizedUrl
            }, { status: 200 }) // Auch bei Fehler 200 zurückgeben, damit der Link trotzdem gespeichert wird
        } catch (e) {
            return NextResponse.json({
                error: 'Fehler beim Abrufen',
                url: normalizedUrl
            }, { status: 500 })
        }
    }
}