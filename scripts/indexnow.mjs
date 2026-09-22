import { execFileSync } from "node:child_process";

const HOST = "joshternet.org";
const ORIGIN = `https://${HOST}`;
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const githubToken = process.env.GITHUB_TOKEN ?? "";
const repository = process.env.GITHUB_REPOSITORY ?? "";
const currentRunId = process.env.GITHUB_RUN_ID ?? "";
const currentSha = process.env.CURRENT_SHA ?? "";
const indexNowKey = process.env.INDEXNOW_KEY ?? "";
const forceFull = process.env.FORCE_FULL === "true";

function requireValue(name, value) {
    if (!value) {
        throw new Error(`${name} is required`);
    }
}

requireValue("GITHUB_TOKEN", githubToken);
requireValue("GITHUB_REPOSITORY", repository);
requireValue("GITHUB_RUN_ID", currentRunId);
requireValue("CURRENT_SHA", currentSha);
requireValue("INDEXNOW_KEY", indexNowKey);

if (!/^[A-Za-z0-9-]{8,128}$/.test(indexNowKey)) {
    throw new Error(
        "INDEXNOW_KEY must contain 8-128 letters, numbers, or dashes",
    );
}

const keyLocation = `${ORIGIN}/${indexNowKey}.txt`;

function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

async function github(path) {
    const response = await fetch(
        `https://api.github.com/repos/${repository}${path}`,
        {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${githubToken}`,
                "X-GitHub-Api-Version": "2022-11-28",
            },
        },
    );

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `GitHub API returned HTTP ${response.status}: ` +
            body.slice(0, 500),
        );
    }

    return response.json();
}

async function fetchTextWithRetry(
    url,
    description,
) {
    const attempts = 6;

    for (
        let attempt = 1;
        attempt <= attempts;
        attempt += 1
    ) {
        try {
            const response = await fetch(url, {
                headers: {
                    "Cache-Control": "no-cache",
                },
            });

            if (response.ok) {
                return await response.text();
            }

            if (attempt === attempts) {
                throw new Error(
                    `${description} returned HTTP ` +
                    response.status,
                );
            }
        } catch (error) {
            if (attempt === attempts) {
                throw error;
            }
        }

        await sleep(attempt * 2000);
    }

    throw new Error(
        `${description} could not be fetched`,
    );
}

function decodeXml(value) {
    return value
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", "\"")
        .replaceAll("&#39;", "'");
}

function productionUrl(value) {
    const url = new URL(value, ORIGIN);

    if (
        url.protocol !== "https:" ||
        url.hostname !== HOST ||
        url.port !== ""
    ) {
        throw new Error(
            `Refusing non-production URL: ${url.href}`,
        );
    }

    url.hash = "";

    return url.href;
}

async function productionSitemapUrls() {
    const xml = await fetchTextWithRetry(
        `${SITEMAP_URL}?indexnow=${currentSha.slice(0, 12)}`,
        "Production sitemap",
    );

    const urls = new Set(
        Array.from(
            xml.matchAll(/<loc>(.*?)<\/loc>/gs),
            (match) => productionUrl(
                decodeXml(match[1].trim()),
            ),
        ),
    );

    if (urls.size === 0) {
        throw new Error(
            "Production sitemap did not contain any URLs",
        );
    }

    return urls;
}

async function verifyIndexNowKey() {
    const body = await fetchTextWithRetry(
        `${keyLocation}?indexnow=${currentSha.slice(0, 12)}`,
        "Production IndexNow key file",
    );

    if (body.trim() !== indexNowKey) {
        throw new Error(
            "Production IndexNow key file does not " +
            "match INDEXNOW_KEY",
        );
    }

    console.log(
        "Verified IndexNow key on production.",
    );
}

async function previousIndexNowRun() {
    const currentRun = await github(
        `/actions/runs/${currentRunId}`,
    );

    const result = await github(
        `/actions/workflows/` +
        `${currentRun.workflow_id}/runs?per_page=20`,
    );

    return result.workflow_runs.find(
        (run) => {
            return String(run.id) !==
                String(currentRunId);
        },
    ) ?? null;
}

function git(...args) {
    return execFileSync(
        "git",
        args,
        {
            encoding: "utf8",
            stdio: [
                "ignore",
                "pipe",
                "pipe",
            ],
        },
    ).trim();
}

function fileAtRevision(
    sha,
    path,
) {
    try {
        return git(
            "show",
            `${sha}:${path}`,
        );
    } catch {
        return null;
    }
}

function permalinkFromContent(
    path,
    content,
) {
    if (!content) {
        return null;
    }

    const frontMatter = content.match(
        /^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/,
    );

    if (frontMatter) {
        const permalink =
            frontMatter[1].match(
                /^permalink:\s*(.+?)\s*$/m,
            );

        if (permalink) {
            const value = permalink[1]
                .trim()
                .replace(
                    /^["']|["']$/g,
                    "",
                );

            return productionUrl(value);
        }
    }

    const normalized =
        path.replaceAll("\\", "/");

    if (
        normalized === "index.md" ||
        normalized === "index.html"
    ) {
        return `${ORIGIN}/`;
    }

    if (
        normalized.endsWith("/index.md") ||
        normalized.endsWith("/index.html")
    ) {
        return productionUrl(
            "/" +
            normalized.replace(
                /index\.(md|html)$/,
                "",
            ),
        );
    }

    return productionUrl(
        "/" +
        normalized.replace(
            /\.(md|html)$/,
            ".html",
        ),
    );
}

function ignoredSource(path) {
    return (
        path === "README.md" ||
        path === "package.json" ||
        path === "package-lock.json" ||
        path === "CNAME" ||
        path === "robots.txt" ||
        path === "site.webmanifest" ||
        path.startsWith(".github/") ||
        path.startsWith(".well-known/") ||
        path.startsWith("scripts/") ||
        path.startsWith("test/") ||
        path.startsWith("workers/")
    );
}

function affectsEveryPage(path) {
    return (
        path === "_config.yml" ||
        path === "Gemfile" ||
        path === "Gemfile.lock" ||
        path === "assets/css/main.css" ||
        path ===
            "assets/images/joshternet-social.png" ||
        path.startsWith("_layouts/") ||
        path.startsWith("_includes/") ||
        path.startsWith("_plugins/")
    );
}

const routeDependencies = new Map([
    [
        "_data/network.json",
        [
            "/network/",
            "/wander/",
        ],
    ],
    [
        "network-data.json",
        [
            "/wander/",
        ],
    ],
    [
        "assets/js/network.js",
        [
            "/network/",
        ],
    ],
    [
        "assets/js/wander.js",
        [
            "/wander/",
        ],
    ],
    [
        "assets/js/nominate.js",
        [
            "/nominate/",
        ],
    ],
]);

function addRouteDependencies(
    urls,
    path,
) {
    if (
        path.startsWith(
            "assets/network/sites/",
        )
    ) {
        urls.add(
            productionUrl("/network/"),
        );
        urls.add(
            productionUrl("/wander/"),
        );

        return true;
    }

    const routes =
        routeDependencies.get(path);

    if (!routes) {
        return false;
    }

    for (const route of routes) {
        urls.add(
            productionUrl(route),
        );
    }

    return true;
}

function diffRecords(
    previousSha,
    nextSha,
) {
    const output = git(
        "diff",
        "--name-status",
        "--find-renames",
        previousSha,
        nextSha,
    );

    if (!output) {
        return [];
    }

    return output
        .split("\n")
        .map(
            (line) => line.split("\t"),
        )
        .filter(
            (parts) => parts.length >= 2,
        );
}

function changedUrls(
    previousSha,
    nextSha,
) {
    try {
        git(
            "merge-base",
            "--is-ancestor",
            previousSha,
            nextSha,
        );
    } catch {
        return {
            full: true,
            urls: new Set(),
        };
    }

    const urls = new Set();

    for (
        const parts of diffRecords(
            previousSha,
            nextSha,
        )
    ) {
        const status = parts[0];

        const paths =
            status.startsWith("R")
                ? [
                    parts[1],
                    parts[2],
                ]
                : [
                    parts[1],
                ];

        if (
            paths.some(
                (path) => {
                    return (
                        path &&
                        affectsEveryPage(path)
                    );
                },
            )
        ) {
            return {
                full: true,
                urls: new Set(),
            };
        }

        for (const path of paths) {
            if (
                !path ||
                ignoredSource(path)
            ) {
                continue;
            }

            if (
                addRouteDependencies(
                    urls,
                    path,
                )
            ) {
                continue;
            }

            if (
                path.startsWith("_data/") ||
                path.startsWith("_")
            ) {
                return {
                    full: true,
                    urls: new Set(),
                };
            }
        }

        if (
            status.startsWith("R")
        ) {
            const oldPath = parts[1];
            const newPath = parts[2];

            if (
                /\.(md|html)$/.test(oldPath)
            ) {
                const oldUrl =
                    permalinkFromContent(
                        oldPath,
                        fileAtRevision(
                            previousSha,
                            oldPath,
                        ),
                    );

                if (oldUrl) {
                    urls.add(oldUrl);
                }
            }

            if (
                /\.(md|html)$/.test(newPath)
            ) {
                const newUrl =
                    permalinkFromContent(
                        newPath,
                        fileAtRevision(
                            nextSha,
                            newPath,
                        ),
                    );

                if (newUrl) {
                    urls.add(newUrl);
                }
            }

            continue;
        }

        const path = parts[1];

        if (
            !/\.(md|html)$/.test(path)
        ) {
            continue;
        }

        if (status === "D") {
            const deletedUrl =
                permalinkFromContent(
                    path,
                    fileAtRevision(
                        previousSha,
                        path,
                    ),
                );

            if (deletedUrl) {
                urls.add(deletedUrl);
            }

            continue;
        }

        const oldUrl =
            permalinkFromContent(
                path,
                fileAtRevision(
                    previousSha,
                    path,
                ),
            );

        const newUrl =
            permalinkFromContent(
                path,
                fileAtRevision(
                    nextSha,
                    path,
                ),
            );

        if (oldUrl) {
            urls.add(oldUrl);
        }

        if (newUrl) {
            urls.add(newUrl);
        }
    }

    return {
        full: false,
        urls,
    };
}

async function submitBatch(urlList) {
    const attempts = 3;

    for (
        let attempt = 1;
        attempt <= attempts;
        attempt += 1
    ) {
        const response = await fetch(
            INDEXNOW_ENDPOINT,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json; " +
                        "charset=utf-8",
                },
                body: JSON.stringify({
                    host: HOST,
                    key: indexNowKey,
                    keyLocation,
                    urlList,
                }),
            },
        );

        if (
            response.status === 200 ||
            response.status === 202
        ) {
            return;
        }

        const body =
            await response.text();

        const retryable =
            response.status === 429 ||
            response.status >= 500;

        if (
            !retryable ||
            attempt === attempts
        ) {
            throw new Error(
                `IndexNow returned HTTP ` +
                `${response.status}: ` +
                body.slice(0, 500),
            );
        }

        const retryAfter = Number(
            response.headers.get(
                "retry-after",
            ),
        );

        const delay =
            Number.isFinite(retryAfter)
                ? retryAfter * 1000
                : attempt * 3000;

        await sleep(delay);
    }
}

async function submit(urls) {
    const list = Array.from(
        urls,
        productionUrl,
    ).sort();

    if (list.length === 0) {
        console.log(
            "No production page URLs changed. " +
            "Nothing to submit.",
        );

        return;
    }

    console.log(
        `Submitting ${list.length} ` +
        `${list.length === 1 ? "URL" : "URLs"} ` +
        "to IndexNow:",
    );

    for (const url of list) {
        console.log(`  ${url}`);
    }

    for (
        let offset = 0;
        offset < list.length;
        offset += 10000
    ) {
        const batch = list.slice(
            offset,
            offset + 10000,
        );

        await submitBatch(batch);

        console.log(
            `IndexNow accepted ${batch.length} ` +
            `${
                batch.length === 1
                    ? "URL"
                    : "URLs"
            }.`,
        );
    }
}

async function main() {
    await verifyIndexNowKey();

    const sitemapUrls =
        await productionSitemapUrls();

    if (forceFull) {
        console.log(
            "Full submission requested.",
        );

        await submit(sitemapUrls);

        return;
    }

    const previousRun =
        await previousIndexNowRun();

    if (!previousRun) {
        console.log(
            "This is the first IndexNow run. " +
            "Submitting the complete production sitemap.",
        );

        await submit(sitemapUrls);

        return;
    }

    if (
        previousRun.conclusion !==
        "success"
    ) {
        console.log(
            "The previous IndexNow run did not succeed. " +
            "Submitting the complete production sitemap.",
        );

        await submit(sitemapUrls);

        return;
    }

    const previousSha =
        previousRun.head_sha;

    if (!previousSha) {
        console.log(
            "The previous IndexNow run has no commit SHA. " +
            "Submitting the complete production sitemap.",
        );

        await submit(sitemapUrls);

        return;
    }

    if (
        previousSha === currentSha
    ) {
        console.log(
            "The deployed commit did not change. " +
            "Nothing to submit.",
        );

        return;
    }

    const changes = changedUrls(
        previousSha,
        currentSha,
    );

    if (changes.full) {
        console.log(
            "A site-wide source changed. " +
            "Submitting the complete production sitemap.",
        );

        await submit(sitemapUrls);

        return;
    }

    await submit(changes.urls);
}

await main();
