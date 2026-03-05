import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-time fetcher for Flathub verified apps
// Baking this into JSON avoids CORS headaches and runtime latency

const CONFIG = {
    API_ENDPOINT: 'https://flathub.org/api/v2/search',
    OUTPUT_FILE: '../src/lib/verified-flatpaks.json',
    HITS_PER_PAGE: 250, // Flathub's max page size
    MAX_RETRIES: 3,
    TIMEOUT_MS: 15_000,
};

// resolvePath helper because ESM __dirname is awkward
const resolvePath = (rel) => path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Robust fetch wrapper - APIs are flaky, we are resilient
async function fetchWithRetry(url, options, retries = CONFIG.MAX_RETRIES) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            const delay = 1000 * (CONFIG.MAX_RETRIES - retries + 1);
            console.warn(`Request failed (${error.message}). Retrying in ${delay}ms...`);
            await sleep(delay);
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

async function fetchPage(page) {
    const data = await fetchWithRetry(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: '',
            filter: 'verification_verified=true',
            page,
            hitsPerPage: CONFIG.HITS_PER_PAGE,
        }),
    });

    return {
        ids: (data.hits || []).filter(h => h.verification_verified && h.app_id).map(h => h.app_id),
        totalPages: data.totalPages || 0
    };
}

async function main() {
    console.log(`\n📦 Syncing Flathub verified apps...`);
    const startTime = Date.now();

    try {
        // Grab page 1 to see what we're dealing with
        const firstPage = await fetchPage(1);
        const allApps = new Set(firstPage.ids);

        // Cap at 50 pages because if there are >12,000 verified apps, we have bigger problems
        const totalPages = Math.min(firstPage.totalPages, 50);

        if (totalPages > 1) {
            // Blast the remaining pages in parallel
            // console.log(`Fetching ${totalPages - 1} more pages...`);
            const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

            const results = await Promise.all(
                pages.map(p => fetchPage(p).then(r => r.ids).catch(() => []))
            );
            results.flat().forEach(id => allApps.add(id));
        }

        // Sort for deterministic output (git diffs will thank us)
        const apps = Array.from(allApps).sort();
        const outputPath = resolvePath(CONFIG.OUTPUT_FILE);

        await fs.writeFile(outputPath, JSON.stringify({
            meta: { fetchedAt: new Date().toISOString() },
            count: apps.length,
            apps
        }, null, 2));

        const time = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Cached ${apps.length} verified apps in ${time}s`);

    } catch (e) {
        console.error(`💥 Failed to sync verified apps:`, e);
        process.exit(1);
    }
}

main();
