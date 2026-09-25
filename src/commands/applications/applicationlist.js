import {
    infoEmbed,
    errorEmbed
} from "../../utils/embeds.js";

import {
    getApplications
} from "../../utils/database.js";

import {
    canManageApplications
} from "../../utils/applications.js";

export default {
    data: {
        name: "applicationlist"
    },

    async prefixExecute({
        message,
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
                        "You need the **Manage Server** permission to view applications."
                    )
                ]
            });
        }

        const applications =
            getApplications(message.guild.id);

        if (!applications.length) {
            return message.reply({
                embeds: [
                    infoEmbed(
                        "Applications",
                        `There are no applications yet. Create one with \`${prefix}applicationcreate\`.`
                    )
                ]
            });
        }

        const embed =
            infoEmbed(
                "Applications",
                `**${applications.length}** application(s). Send one with \`${prefix}applicationsend <name> #channel\`.`
            );

        // Discord allows 25 fields per embed.
        for (const application of applications.slice(0, 25)) {
            const questions =
                application.questions
                    .map(
                        (question, index) =>
                            `${index + 1}. ${question}`
                    )
                    .join("\n");

            embed.addFields({
                name:
                    `${application.display_name} (\`${application.name}\`)`,

                value:
                    [
                        application.description.length > 150
                            ? `${application.description.slice(0, 147)}...`
                            : application.description,
                        "",
                        `**Questions (${application.questions.length}):**`,
                        questions,
                        "",
                        `Created by <@${application.created_by}> <t:${Math.floor(application.created_at / 1000)}:R>`
                    ].join("\n").slice(0, 1024),

                inline: false
            });
        }

        return message.reply({
            embeds: [embed]
        });
    }
};
