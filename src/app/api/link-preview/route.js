// app/api/link-preview/route.js
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio'; // Change this line

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is missing' }, { status: 400 });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 Sekunden Timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok && response.status !== 408) {
            return NextResponse.json({ error: `HTTP error! status: ${response.status}` }, { status: response.status });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        let title = $('title').text() || $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || '';
        let image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || '';

        // Sicherstellen, dass wir einen Fallback-Titel haben
        if (!title) {
            try {
                const urlObj = new URL(url);
                title = urlObj.hostname;
            } catch (e) {
                title = "Unbekannte Webseite";
            }
        }

        const absoluteImageURL = image && (image.startsWith('http') ? image : (new URL(image, url)).href);

        return NextResponse.json({ title, image: absoluteImageURL || '' });

    } catch (error) {
        console.error('Fehler beim Abrufen der Link-Vorschau:', error);
        return NextResponse.json({ error: 'Fehler beim Abrufen der Link-Vorschau' }, { status: 500 });
    }
}