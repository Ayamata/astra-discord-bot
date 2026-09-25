import config from "../../config.js";

import {
    getApplication
} from "../../utils/database.js";

import {
    errorEmbed,
    successEmbed
} from "../../utils/embeds.js";

import {
    canManageApplications,
    createApplicationPanel,
    resolveTextChannel
} from "../../utils/applications.js";

export default {
    data: {
        name: "applicationsend"
    },

    async prefixExecute({
        message,
        args,
        prefix
    }) {
        if (!message.guild) {
            return;
        }

        if (!canManageApplications(message.member)) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Permission Denied",
                        "You need the **Manage Server** permission to send applications."
                    )
                ]
            });
        }

        const [
            name,
            channelInput
        ] = args;

        if (!name) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Missing Arguments",
                        [
                            `\`${prefix}applicationsend <name> [#channel]\``,
                            "",
                            "Sends to the current channel if no channel is given."
                        ].join("\n")
                    )
                ]
            });
        }

        const application =
            getApplication(
                message.guild.id,
                name.toLowerCase()
            );

        if (!application) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Application Not Found",
                        `No application named **${name}** exists. See \`${prefix}applicationlist\`.`
                    )
                ]
            });
        }

        const channel =
            channelInput
                ? resolveTextChannel(
                    message.guild,
                    channelInput
                )
                : message.channel;

        if (!channel) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Channel Not Found",
                        `I couldn't find a text channel matching **${channelInput}**.`
                    )
                ]
            });
        }

        try {
            await channel.send(
                createApplicationPanel(application)
            );
        } catch (error) {
            console.error(
                "[APPLICATION] Failed to send panel:",
                error
            );

            return message.reply({
                embeds: [
                    errorEmbed(
                        "Send Failed",
                        `I couldn't send the panel in ${channel}. Check my permissions there.`
                    )
                ]
            });
        }

        return message.reply({
            embeds: [
                successEmbed(
                    "Panel Sent",
                    [
                        `The **${application.display_name}** application panel was sent in ${channel}.`,
                        ...(config.applications.enabled
                            ? []
                            : [
                                "",
                                "⚠️ The application system is disabled in `config.js`, so the button won't work until `applications.enabled` is set to `true`."
                            ])
                    ].join("\n")
                )
            ]
        });
    }
};
