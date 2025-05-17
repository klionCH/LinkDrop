import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const config = {
    runtime: 'edge',
}

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'URL fehlt' }, { status: 400 })
    }

    let normalizedUrl;
    try {
        normalizedUrl = url.startsWith('http') ? url : `https://${url}`
        new URL(normalizedUrl);
    } catch (e) {
        return NextResponse.json({ error: 'Ungültiges URL-Format' }, { status: 400 })
    }

    // Spezialfall für YouTube-URLs
    const isYouTube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');
    const youtubeVideoId = extractYouTubeVideoId(normalizedUrl);

    if (isYouTube && youtubeVideoId) {
        try {
            // Direkte Nutzung der YouTube oEmbed API für YouTube-Links
            const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`;
            const response = await fetch(oEmbedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/99.0.9999.99 Safari/537.36',
                },
                cache: 'no-store',
            });

            if (response.ok) {
                const data = await response.json();
                return NextResponse.json({
                    title: data.title || 'YouTube Video',
                    image: `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
                    url: normalizedUrl
                });
            }

            // Fallback, wenn oEmbed fehlschlägt
            return NextResponse.json({
                title: 'YouTube Video',
                image: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
                url: normalizedUrl
            });
        } catch (err) {
            console.error('Fehler bei YouTube oEmbed:', err);
            // Fallback für YouTube
            return NextResponse.json({
                title: 'YouTube Video',
                image: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
                url: normalizedUrl
            });
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 Sekunden Timeout

        // Verbesserte Headers für höhere Erfolgsrate
        const response = await fetch(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/99.0.9999.99 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            },
            signal: controller.signal,
            redirect: 'follow',
            cache: 'no-store',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
            // Handle non-HTML responses
            const domain = new URL(normalizedUrl).hostname;
            return NextResponse.json({
                title: domain,
                url: normalizedUrl,
                image: ''
            });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Bessere Titel-Extraktion
        const title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text() ||
            $('h1').first().text() ||
            new URL(normalizedUrl).hostname || '';

        // Bessere Bild-Extraktion
        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[property="og:image:secure_url"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('meta[name="twitter:image:src"]').attr('content') ||
            $('meta[itemprop="image"]').attr('content') ||
            '';

        // Korrektur relativer Bild-URLs
        if (image && !image.match(/^https?:\/\//)) {
            const baseUrl = new URL(normalizedUrl);
            if (image.startsWith('//')) {
                image = `https:${image}`;
            } else if (image.startsWith('/')) {
                image = `${baseUrl.origin}${image}`;
            } else {
                image = `${baseUrl.origin}/${image}`;
            }
        }

        // Fallback auf das erste große Bild, wenn kein Meta-Bild gefunden wurde
        if (!image) {
            $('img[src]').each((_, img) => {
                const src = $(img).attr('src');
                const width = parseInt($(img).attr('width') || '0');
                const height = parseInt($(img).attr('height') || '0');

                // Suche nach Bildern mit vernünftiger Größe oder ohne Dimensionen
                if (src && src.length > 10 &&
                    (!width || !height || (width > 100 && height > 100))) {
                    if (!src.match(/^https?:\/\//)) {
                        const baseUrl = new URL(normalizedUrl);
                        if (src.startsWith('//')) {
                            image = `https:${src}`;
                        } else if (src.startsWith('/')) {
                            image = `${baseUrl.origin}${src}`;
                        } else {
                            image = `${baseUrl.origin}/${src}`;
                        }
                    } else {
                        image = src;
                    }
                    return false; // Breche die each-Schleife ab
                }
            });
        }

        // Vermeide ungültige Bild-URLs
        if (image && !image.match(/^https?:\/\//)) {
            image = '';
        }

        // Optional: Vermeide bestimmte kleine Bilder, Icons usw.
        if (image && (image.includes('favicon') || image.includes('icon'))) {
            // Versuche ein anderes Bild zu finden
            $('img[src]').each((_, img) => {
                const src = $(img).attr('src');
                if (src && src.length > 10 &&
                    !src.includes('favicon') && !src.includes('icon') &&
                    src.match(/^https?:\/\//)) {
                    image = src;
                    return false;
                }
            });
        }

        return NextResponse.json({
            title: title.trim(),
            image: image.trim(),
            url: normalizedUrl
        });
    } catch (err) {
        console.error('Fehler bei der Link-Vorschau:', err);

        if (err.name === 'AbortError') {
            return NextResponse.json({
                error: 'Zeitüberschreitung bei der Anfrage',
                title: new URL(normalizedUrl).hostname,
                url: normalizedUrl
            }, { status: 408 });
        }

        try {
            const urlObj = new URL(normalizedUrl);
            return NextResponse.json({
                title: urlObj.hostname,
                image: '',
                url: normalizedUrl
            }, { status: 200 });
        } catch (e) {
            return NextResponse.json({
                error: 'Fehler beim Abrufen',
                url: normalizedUrl
            }, { status: 500 });
        }
    }
}

// Hilfsfunktion zum Extrahieren von YouTube Video IDs
function extractYouTubeVideoId(url) {
    try {
        const urlObj = new URL(url);

        // Format: youtube.com/watch?v=VIDEO_ID
        if (urlObj.hostname.includes('youtube.com')) {
            return urlObj.searchParams.get('v');
        }

        // Format: youtu.be/VIDEO_ID
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.substring(1);
        }

        return null;
    } catch (e) {
        return null;
    }
}