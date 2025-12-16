export function mediaUrl(r2Key: string) {
    const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL!;
    return `${base.replace(/\/$/, "")}/media/${r2Key}`;
}

export function processMediaUrlsInHtml(html: string): string {
    // Заменяем /media/ пути в атрибутах src и href
    return html.replace(
        /(src|href)=["'](\/media\/[^"']+)["']/g,
        (match, attr, path) => {
            const r2Key = path.replace(/^\/media\//, "");
            return `${attr}="${mediaUrl(r2Key)}"`;
        }
    );
}
  