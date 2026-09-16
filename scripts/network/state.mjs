import fs from "node:fs/promises";
import path from "node:path";

export const CAPTURE_MAX_AGE_MS =
    24 * 60 * 60 * 1000;

export function captureIsFresh(
    entry,
    currentTime = Date.now(),
) {
    if (!entry?.captured_at) {
        return false;
    }

    const capturedAt = Date.parse(entry.captured_at);

    if (!Number.isFinite(capturedAt)) {
        return false;
    }

    return (
        currentTime - capturedAt <
        CAPTURE_MAX_AGE_MS
    );
}

export function registryNeedsSync(
    participants,
    existing,
    currentTime = Date.now(),
) {
    if (
        !Array.isArray(participants) ||
        !Array.isArray(existing)
    ) {
        return true;
    }

    if (participants.length !== existing.length) {
        return true;
    }

    const existingByOrigin = new Map();

    for (const entry of existing) {
        if (
            !entry ||
            typeof entry.origin !== "string"
        ) {
            return true;
        }

        existingByOrigin.set(entry.origin, entry);
    }

    if (existingByOrigin.size !== existing.length) {
        return true;
    }

    for (const participant of participants) {
        const entry = existingByOrigin.get(
            participant.origin,
        );

        if (!entry) {
            return true;
        }

        if (
            entry.domain !== participant.domain ||
            entry.identity !== participant.identity
        ) {
            return true;
        }

        if (!captureIsFresh(entry, currentTime)) {
            return true;
        }
    }

    return false;
}

export function fallbackEntry(
    participant,
    previous = null,
) {
    return {
        origin: participant.origin,
        domain: participant.domain,
        identity: participant.identity,
        title:
            previous?.title ||
            participant.domain,
        description:
            typeof previous?.description === "string"
                ? previous.description
                : "",
        screenshot:
            previous?.screenshot || "",
        embeddable:
            typeof previous?.embeddable === "boolean"
                ? previous.embeddable
                : false,
        frame_reason:
            typeof previous?.frame_reason === "string"
                ? previous.frame_reason
                : "unknown",
        captured_at:
            previous?.captured_at || "",
    };
}

export async function removeOrphanScreenshots(
    entries,
    screenshotRoot,
) {
    const wanted = new Set(
        entries
            .map((entry) => entry.screenshot)
            .filter(Boolean)
            .map((screenshot) => {
                return path.basename(screenshot);
            }),
    );

    let files;

    try {
        files = await fs.readdir(screenshotRoot);
    } catch (error) {
        if (error?.code === "ENOENT") {
            return;
        }

        throw error;
    }

    for (const file of files) {
        if (
            file.endsWith(".webp") &&
            !wanted.has(file)
        ) {
            await fs.rm(
                path.join(screenshotRoot, file),
                {
                    force: true,
                },
            );
        }
    }
}
