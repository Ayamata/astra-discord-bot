import fs from "node:fs";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

export async function loadEvents(client) {
    const eventsPath =
        path.join(
            __dirname,
            "../events"
        );

    console.log(
        `[EVENTS] Loading events from: ${eventsPath}`
    );

    const files =
        fs.readdirSync(eventsPath)
            .filter(file =>
                file.endsWith(".js")
            );

    for (const file of files) {
        try {
            const event =
                await import(
                    `file://${path.join(
                        eventsPath,
                        file
                    )}`
                );

            if (!event.default) {
                console.warn(
                    `[EVENTS] No default export: ${file}`
                );
                continue;
            }

            const eventName =
                event.default.name;

            if (!eventName) {
                console.warn(
                    `[EVENTS] No event name: ${file}`
                );
                continue;
            }

            if (event.default.once) {
                client.once(
                    eventName,
                    (...args) =>
                        event.default.execute(
                            ...args,
                            client
                        )
                );
            } else {
                client.on(
                    eventName,
                    (...args) =>
                        event.default.execute(
                            ...args,
                            client
                        )
                );
            }

            console.log(
                `[EVENTS] Loaded ${file} → ${eventName}`
            );
        } catch (error) {
            console.error(
                `[EVENTS] Failed to load ${file}:`,
                error
            );
        }
    }
}