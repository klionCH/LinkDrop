import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'URL fehlt' }, { status: 400 })
    }


    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/90.0.4430.93 Safari/537.36',
            },
            next: { revalidate: 0 },
            cache: 'no-store',
        })

        const html = await response.text()
        const $ = cheerio.load(html)

        const title =
            $('meta[property="og:title"]').attr('content') ||
            $('title').text() ||
            ''

        const image =
            $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            ''

        return NextResponse.json({
            title: title.trim(),
            image: image.trim(),
        })
    } catch (err) {
        console.error('Fehler bei der Link-Vorschau:', err)
        return NextResponse.json({ error: 'Fehler beim Abrufen' }, { status: 500 })
    }
}
