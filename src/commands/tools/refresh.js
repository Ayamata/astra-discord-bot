import {
    canUseToolCommands
} from "../../utils/commandPermissions.js";

import {
    loadCommands,
    registerSlashCommands
} from "../../handlers/commandHandler.js";

import {
    errorEmbed,
    successEmbed,
    warningEmbed
} from "../../utils/embeds.js";

export default {
    data: {
        name: "refresh"
    },

    async prefixExecute({
        message,
        client
    }) {
        if (!canUseToolCommands(message.author)) {
            return message.reply(
                "❌ You are not authorized to use this command."
            );
        }

        console.log(
            `[REFRESH] Command refresh requested by ${message.author.tag} (${message.author.id})`
        );

        const failed =
            await loadCommands(
                client,
                { reload: true }
            );

        let slashCount;

        try {
            slashCount =
                await registerSlashCommands(client);
        } catch (error) {
            console.error(
                "[REFRESH] Failed to register slash commands:",
                error
            );

            return message.reply({
                embeds: [
                    errorEmbed(
                        "Refresh Incomplete",
                        [
                            `Reloaded **${client.commands.size}** command(s), but registering slash commands with Discord failed.`,
                            "",
                            `\`${String(error.message).slice(0, 500)}\``
                        ].join("\n")
                    )
                ]
            });
        }

        const summary = [
            `Reloaded **${client.commands.size}** command(s).`,
            `Registered **${slashCount}** slash command(s) with Discord.`
        ];

        if (failed) {
            return message.reply({
                embeds: [
                    warningEmbed(
                        "Refreshed With Errors",
                        [
                            ...summary,
                            "",
                            `⚠️ **${failed}** file(s) failed to load. Check the console log.`
                        ].join("\n")
                    )
                ]
            });
        }

        return message.reply({
            embeds: [
                successEmbed(
                    "Commands Refreshed",
                    summary.join("\n")
                )
            ]
        });
    }
};
