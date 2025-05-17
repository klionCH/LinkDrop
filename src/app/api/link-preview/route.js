// app/api/link-preview/route.js
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function fetchYouTubeMetadata(url) {
    const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]+)/);
    if (videoIdMatch && videoIdMatch[1]) {
        const videoId = videoIdMatch[1];
        const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        try {
            const response = await fetch(oEmbedUrl);
            if (response.ok) {
                const data = await response.json();
                return { title: data.title || '', image: data.thumbnail_url || '' };
            }
        } catch (error) {
            console.error('Fehler beim Abrufen der YouTube-oEmbed-Daten:', error);
        }
    }
    return null;
}

async function fetchVimeoMetadata(url) {
    const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
    if (videoIdMatch && videoIdMatch[1]) {
        const videoId = videoIdMatch[1];
        const apiUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`;
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                return { title: data.title || '', image: data.thumbnail_url || '' };
            }
        } catch (error) {
            console.error('Fehler beim Abrufen der Vimeo-oEmbed-Daten:', error);
        }
    }
    return null;
}

async function fetchTwitterMetadata(url) {
    const tweetIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?twitter\.com\/(?:.*?\/status\/)(\d+)/);
    if (tweetIdMatch && tweetIdMatch[1]) {
        const tweetId = tweetIdMatch[1];
        const apiUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/i/status/${tweetId}&format=json`;
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();

                return { title: data.text || '', image: '' };
            }
        } catch (error) {
            console.error('Fehler beim Abrufen der Twitter-oEmbed-Daten:', error);
        }
    }
    return null;
}

async function scrapeMetadata(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok && response.status !== 408) {
            console.warn(`Fehler beim Abrufen von ${url}: ${response.statusText}`);
            return { title: '', image: '' };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        let title = $('title').text() || $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || '';
        let image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || '';

        if (!title) {
            try {
                const urlObj = new URL(url);
                title = urlObj.hostname || 'Unbekannte Webseite';
            } catch (e) {
                title = 'Unbekannte Webseite';
            }
        }

        const absoluteImageURL = image && (image.startsWith('http') ? image : (new URL(image, url)).href);

        return { title, image: absoluteImageURL || '' };

    } catch (error) {
        console.error('Fehler beim Scrapen von Metadaten:', error);
        return { title: '', image: '' };
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is missing' }, { status: 400 });
    }

    let metadata = null;

    metadata = await fetchYouTubeMetadata(url);
    if (metadata) {
        return NextResponse.json(metadata);
    }

    metadata = await fetchVimeoMetadata(url);
    if (metadata) {
        return NextResponse.json(metadata);
    }

    metadata = await fetchTwitterMetadata(url);
    if (metadata) {
        return NextResponse.json(metadata);
    }

    metadata = await scrapeMetadata(url);
    return NextResponse.json(metadata);
}