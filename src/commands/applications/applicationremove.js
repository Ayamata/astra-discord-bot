import {
    deleteApplication
} from "../../utils/database.js";

import {
    errorEmbed,
    successEmbed
} from "../../utils/embeds.js";

import {
    canManageApplications
} from "../../utils/applications.js";

export default {
    data: {
        name: "applicationremove"
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
                        "You need the **Manage Server** permission to remove applications."
                    )
                ]
            });
        }

        const name =
            args[0]?.toLowerCase();

        if (!name) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Missing Arguments",
                        `\`${prefix}applicationremove <name>\``
                    )
                ]
            });
        }

        const result =
            deleteApplication(
                message.guild.id,
                name
            );

        if (!result.changes) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Application Not Found",
                        `No application named **${name}** exists. See \`${prefix}applicationlist\`.`
                    )
                ]
            });
        }

        return message.reply({
            embeds: [
                successEmbed(
                    "Application Removed",
                    [
                        `**${name}** has been removed.`,
                        "",
                        "Any panels already sent for it will tell users it no longer exists. You can delete those messages."
                    ].join("\n")
                )
            ]
        });
    }
};
