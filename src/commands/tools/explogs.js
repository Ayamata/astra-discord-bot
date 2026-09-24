import fs from "node:fs";

import {
    AttachmentBuilder
} from "discord.js";

import {
    getLogFilePath
} from "../../utils/consoleLogger.js";

import {
    canUseToolCommands
} from "../../utils/commandPermissions.js";

export default {
    data: {
        name: "explogs"
    },

    async prefixExecute({
        message
    }) {
        if (
            !canUseToolCommands(
                message.author.id
            )
        ) {
            return message.reply(
                "Not authorized!"
            );
        }

        const logFile =
            getLogFilePath();

        if (
            !fs.existsSync(logFile)
        ) {
            return message.reply(
                "No console log file exists yet."
            );
        }

        const stats =
            fs.statSync(logFile);

        if (stats.size === 0) {
            return message.reply(
                "The console log is empty."
            );
        }

        /*
         * Discord upload limit varies by server/account.
         * Keep a conservative limit here.
         */
        const MAX_FILE_SIZE =
            10 * 1024 * 1024;

        if (
            stats.size >
            MAX_FILE_SIZE
        ) {
            return message.reply(
                "The console log is too large. Download the file inside my [Github](https://github.com/Ayamata/astra-discord-bot/tree/main/logs) page."
            );
        }

        const attachment =
            new AttachmentBuilder(
                logFile,
                {
                    name:
                        `astra-console-${Date.now()}.log`
                }
            );

        return message.reply({
            content:
                "Current Astra console log:",

            files: [
                attachment
            ]
        });
    }
};