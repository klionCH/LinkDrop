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
        new URL(normalizedUrl)
    } catch {
        return NextResponse.json({ error: 'Ungültiges URL-Format' }, { status: 400 })
    }

    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html',
            },
            signal: controller.signal,
            cache: 'no-store',
            redirect: 'follow',
        })

        clearTimeout(timeoutId)

        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('text/html')) {
            return NextResponse.json({
                title: new URL(normalizedUrl).hostname,
                url: normalizedUrl,
                image: '',
            })
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        const title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text() ||
            $('h1').first().text() ||
            new URL(normalizedUrl).hostname

        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[property="og:image:secure_url"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('meta[itemprop="image"]').attr('content') || ''

        if (image && !image.match(/^https?:\/\//)) {
            const base = new URL(normalizedUrl)
            if (image.startsWith('//')) {
                image = `https:${image}`
            } else if (image.startsWith('/')) {
                image = `${base.origin}${image}`
            } else {
                image = `${base.origin}/${image}`
            }
        }

        if (!image || image.includes('favicon') || image.includes('icon')) {
            $('img[src]').each((_, img) => {
                const src = $(img).attr('src') || ''
                const width = parseInt($(img).attr('width') || '0')
                const height = parseInt($(img).attr('height') || '0')

                if (src.length > 10 && (!width || !height || (width > 100 && height > 100))) {
                    if (!src.match(/^https?:\/\//)) {
                        const base = new URL(normalizedUrl)
                        if (src.startsWith('//')) {
                            image = `https:${src}`
                        } else if (src.startsWith('/')) {
                            image = `${base.origin}${src}`
                        } else {
                            image = `${base.origin}/${src}`
                        }
                    } else {
                        image = src
                    }
                    return false
                }
            })
        }

        return NextResponse.json({
            title: title.trim(),
            image: image.trim(),
            url: normalizedUrl,
        })

    } catch (err) {
        console.error('Fehler bei der Link-Vorschau:', err)
        if (err.name === 'AbortError') {
            return NextResponse.json({
                error: 'Timeout',
                title: new URL(normalizedUrl).hostname,
                url: normalizedUrl,
            }, { status: 408 })
        }
        return NextResponse.json({
            title: new URL(normalizedUrl).hostname,
            image: '',
            url: normalizedUrl,
        }, { status: 500 })
    }
}
