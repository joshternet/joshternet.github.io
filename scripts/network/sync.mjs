import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";
import sharp from "sharp";

import {
    assertPublicURL,
    chooseDescription,
    framePolicy,
    chooseTitle,
    projectRegistry,
    screenshotPath,
    stableSiteID,
} from "./lib.mjs";

import {
    captureIsFresh,
    fallbackEntry,
    removeOrphanScreenshots,
} from "./state.mjs";

const DEFAULT_REGISTRY_URL =
    "https://raw.githubusercontent.com/joshternet/index-data/main/registry.json";

const DEFAULT_DATA_PATH = "_data/network.json";
const DEFAULT_SCREENSHOT_ROOT = "assets/network/sites";

const NAVIGATION_TIMEOUT_MS = 20_000;
const SETTLE_TIME_MS = 1_500;
const SITE_TIMEOUT_MS = 30_000;

const registrySource =
    process.env.NETWORK_REGISTRY_URL || DEFAULT_REGISTRY_URL;

const refreshAll =
    process.env.NETWORK_REFRESH_ALL === "1" ||
    process.env.NETWORK_REFRESH_ALL === "true";

function nowISO() {
    return new Date().toISOString();
}

async function readJSONIfExists(filePath, fallback) {
    try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch (error) {
        if (error?.code === "ENOENT") {
            return fallback;
        }

        throw error;
    }
}

async function loadRegistry(source) {
    if (
        source.startsWith("https://") ||
        source.startsWith("http://")
    ) {
        const response = await fetch(source, {
            headers: {
                Accept: "application/json",
                "User-Agent": "Joshternet-Network-Sync",
            },
            redirect: "error",
            signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
            throw new Error(
                `registry request failed with ${response.status}`,
            );
        }

        return response.json();
    }

    const data = await fs.readFile(path.resolve(source), "utf8");

    return JSON.parse(data);
}

function existingByOrigin(entries) {
    const index = new Map();

    if (!Array.isArray(entries)) {
        return index;
    }

    for (const entry of entries) {
        if (
            entry &&
            typeof entry === "object" &&
            typeof entry.origin === "string"
        ) {
            index.set(entry.origin, entry);
        }
    }

    return index;
}

function headerObject(headers) {
    const result = {};

    for (const header of headers) {
        result[header.name.toLowerCase()] = header.value;
    }

    return result;
}

async function captureParticipant(browser, participant) {
    const dnsCache = new Map();

    await assertPublicURL(participant.origin, {
        cache: dnsCache,
    });

    const context = await browser.newContext({
        viewport: {
            width: 1440,
            height: 900,
        },
        deviceScaleFactor: 1,
        javaScriptEnabled: true,
        serviceWorkers: "block",
        ignoreHTTPSErrors: false,
        userAgent:
            "Joshternet-Network-Capture (+https://joshternet.org/network/)",
    });

    const page = await context.newPage();

    let mainResponseHeaders = {};

    await page.route("**/*", async (route) => {
        const request = route.request();

        try {
            const requestURL = new URL(request.url());

            if (
                requestURL.protocol !== "https:" &&
                requestURL.protocol !== "http:"
            ) {
                await route.abort("blockedbyclient");
                return;
            }

            await assertPublicURL(requestURL.href, {
                cache: dnsCache,
            });

            await route.continue();
        } catch {
            await route.abort("blockedbyclient");
        }
    });

    try {
        const response = await page.goto(participant.origin, {
            waitUntil: "domcontentloaded",
            timeout: NAVIGATION_TIMEOUT_MS,
        });

        if (!response) {
            throw new Error("homepage returned no main response");
        }

        const finalURL = new URL(page.url());

        await assertPublicURL(finalURL.href, {
            cache: dnsCache,
        });

        mainResponseHeaders = await response.allHeaders();

        await page.waitForTimeout(SETTLE_TIME_MS);

        const metadata = await page.evaluate(() => {
            function meta(selector) {
                return (
                    document
                        .querySelector(selector)
                        ?.getAttribute("content") || ""
                );
            }

            return {
                ogSiteName: meta(
                    'meta[property="og:site_name"]',
                ),
                applicationName: meta(
                    'meta[name="application-name"]',
                ),
                ogTitle: meta(
                    'meta[property="og:title"]',
                ),
                documentTitle: document.title || "",
                description: meta(
                    'meta[name="description"]',
                ),
                ogDescription: meta(
                    'meta[property="og:description"]',
                ),
            };
        });

        const png = await page.screenshot({
            type: "png",
            fullPage: false,
            animations: "disabled",
        });

        const id = stableSiteID(participant.origin);
        const outputPath = path.join(
            DEFAULT_SCREENSHOT_ROOT,
            `${id}.webp`,
        );

        await fs.mkdir(path.dirname(outputPath), {
            recursive: true,
        });

        await sharp(png)
            .resize(1440, 900, {
                fit: "cover",
                position: "top",
            })
            .webp({
                quality: 82,
                effort: 5,
            })
            .toFile(outputPath);

        const title = chooseTitle({
            ...metadata,
            domain: participant.domain,
        });

        const description = chooseDescription(metadata);

        const framing = framePolicy({
            origin: participant.origin,
            headers: mainResponseHeaders,
        });

        return {
            origin: participant.origin,
            domain: participant.domain,
            identity: participant.identity,
            title,
            description,
            screenshot: screenshotPath(participant.origin),
            embeddable: framing.embeddable,
            frame_reason: framing.reason,
            captured_at: nowISO(),
        };
    } finally {
        await context.close();
    }
}

async function withTimeout(promise, timeoutMS, label) {
    let timer;

    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(
                        new Error(
                            `${label} exceeded ${timeoutMS}ms`,
                        ),
                    );
                }, timeoutMS);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function shouldRefresh(previous) {
    return refreshAll || !captureIsFresh(previous);
}

async function writeJSONAtomic(filePath, value) {
    const directory = path.dirname(filePath);
    const temporary = `${filePath}.tmp-${process.pid}`;

    await fs.mkdir(directory, {
        recursive: true,
    });

    await fs.writeFile(
        temporary,
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8",
    );

    await fs.rename(temporary, filePath);
}

const registry = await loadRegistry(registrySource);
const participants = projectRegistry(registry);

const existing = await readJSONIfExists(
    DEFAULT_DATA_PATH,
    [],
);

const previous = existingByOrigin(existing);

process.stdout.write(
    `Registry contains ${participants.length} participant` +
    `${participants.length === 1 ? "" : "s"}.\n`,
);

const browser = await chromium.launch({
    headless: true,
    args: [
        "--disable-dev-shm-usage",
    ],
});

const nextEntries = [];

try {
    for (const participant of participants) {
        const oldEntry = previous.get(
            participant.origin,
        );

        if (!shouldRefresh(oldEntry)) {
            nextEntries.push({
                ...oldEntry,
                identity: participant.identity,
                domain: participant.domain,
                frame_reason:
                    oldEntry.frame_reason ||
                    (
                        oldEntry.embeddable
                            ? "allowed"
                            : "unknown"
                    ),
            });

            process.stdout.write(
                `keep ${participant.origin}\n`,
            );

            continue;
        }

        process.stdout.write(
            `capture ${participant.origin}\n`,
        );

        try {
            const captured = await withTimeout(
                captureParticipant(
                    browser,
                    participant,
                ),
                SITE_TIMEOUT_MS,
                participant.origin,
            );

            nextEntries.push(captured);

            process.stdout.write(
                `captured ${participant.origin}\n`,
            );
        } catch (error) {
            nextEntries.push(
                fallbackEntry(
                    participant,
                    oldEntry,
                ),
            );

            process.stderr.write(
                `capture failed ${participant.origin}: ` +
                `${error.message}\n`,
            );
        }
    }
} finally {
    await browser.close();
}

nextEntries.sort((left, right) => {
    return left.domain.localeCompare(
        right.domain,
        undefined,
        {
            numeric: true,
            sensitivity: "base",
        },
    );
});

await removeOrphanScreenshots(
    nextEntries,
    DEFAULT_SCREENSHOT_ROOT,
);
await writeJSONAtomic(
    DEFAULT_DATA_PATH,
    nextEntries,
);

process.stdout.write(
    `Wrote ${nextEntries.length} network entr` +
    `${nextEntries.length === 1 ? "y" : "ies"}.\n`,
);
