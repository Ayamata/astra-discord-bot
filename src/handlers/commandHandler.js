import fs from "node:fs";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

export async function loadCommands(client) {
    const commandsPath =
        path.join(
            __dirname,
            "../commands"
        );

    async function walk(directory) {
        const entries =
            fs.readdirSync(
                directory,
                { withFileTypes: true }
            );

        for (const entry of entries) {
            const fullPath =
                path.join(
                    directory,
                    entry.name
                );

            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }

            if (!entry.name.endsWith(".js")) {
                continue;
            }

            const command =
                await import(
                    `file://${fullPath}`
                );

            if (
                command.default?.data &&
                command.default?.execute
            ) {
                client.commands.set(
                    command.default.data.name,
                    command.default
                );
            }
        }
    }

    await walk(commandsPath);
}