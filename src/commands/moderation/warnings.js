import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    getWarnings
} from "../../utils/database.js";

import {
    infoEmbed,
    errorEmbed
} from "../../utils/embeds.js";

export default {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a member's warnings.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const warnings =
            getWarnings(
                interaction.guild.id,
                user.id
            );

        if (!warnings.length) {
            return interaction.reply({
                embeds: [
                    infoEmbed(
                        "Warnings",
                        `**${user.tag}** has no warnings.`
                    )
                ]
            });
        }

        const description =
            warnings
                .map((warning, index) =>
                    `**${index + 1}.** ${warning.reason}\n` +
                    `Moderator: <@${warning.moderator_id}>\n` +
                    `Date: <t:${Math.floor(warning.created_at / 1000)}:f>`
                )
                .join("\n\n");

        return interaction.reply({
            embeds: [
                infoEmbed(
                    `Warnings — ${user.tag}`,
                    description
                )
            ]
        });
    }
};