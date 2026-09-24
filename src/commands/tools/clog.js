import {
    canUseToolCommands
} from "../../utils/commandPermissions.js";

import {
    successEmbed
} from "../../utils/embeds.js";

export default {
    data: {
        name: "clog"
    },

    async prefixExecute({
        message,
        args
    }) {
        if (
            !canUseToolCommands(
                message.author.id
            )
        ) {
            return message.reply(
                "❌ You are not authorized to use this command."
            );
        }

        if (!args.length) {
            return message.reply(
                "Usage: `>clog <message>`"
            );
        }

        const content =
            args.join(" ");

        console.log(
            `[DISCORD] ${message.author.tag} (${message.author.id}): ${content}`
        );

        return message.reply({
            embeds: [
                successEmbed(
                    "Console Log",
                    "The message has been written to the console log."
                )
            ]
        });
    }
};