import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
    projectRegistry,
} from "./lib.mjs";

import {
    registryNeedsSync,
} from "./state.mjs";

const DEFAULT_REGISTRY_URL =
    "https://raw.githubusercontent.com/joshternet/index-data/main/registry.json";

const DEFAULT_DATA_PATH = "_data/network.json";

const registrySource =
    process.env.NETWORK_REGISTRY_URL ||
    DEFAULT_REGISTRY_URL;

async function readJSONIfExists(filePath, fallback) {
    try {
        return JSON.parse(
            await fs.readFile(
                filePath,
                "utf8",
            ),
        );
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
                "User-Agent":
                    "Joshternet-Network-Preflight",
            },
            redirect: "error",
            signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
            throw new Error(
                "registry request failed with " +
                response.status,
            );
        }

        return response.json();
    }

    return JSON.parse(
        await fs.readFile(
            path.resolve(source),
            "utf8",
        ),
    );
}

async function screenshotExists(entry) {
    if (!entry?.screenshot) {
        return false;
    }

    const relative = entry.screenshot.replace(
        /^\/+/,
        "",
    );

    try {
        const stat = await fs.stat(
            path.resolve(relative),
        );

        return (
            stat.isFile() &&
            stat.size > 0
        );
    } catch (error) {
        if (error?.code === "ENOENT") {
            return false;
        }

        throw error;
    }
}

const registry = await loadRegistry(
    registrySource,
);

const participants = projectRegistry(
    registry,
);

const existing = await readJSONIfExists(
    DEFAULT_DATA_PATH,
    [],
);

let needsSync = registryNeedsSync(
    participants,
    existing,
);

if (!needsSync) {
    for (const entry of existing) {
        if (!(await screenshotExists(entry))) {
            needsSync = true;

            process.stderr.write(
                `Network sync required: screenshot missing for ${entry.origin}\n`,
            );

            break;
        }
    }
}

if (needsSync) {
    process.stderr.write(
        "Network sync required: registry or capture state is not current.\n",
    );
    process.stdout.write("true\n");
} else {
    process.stderr.write(
        "Network registry and captures are current.\n",
    );
    process.stdout.write("false\n");
}
