import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    successEmbed,
    errorEmbed
} from "../../utils/embeds.js";

import {
    createWarning,
    sendModerationDM
} from "../../utils/moderation.js";

import config from "../../config.js";

export default {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Warning reason.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const member =
            await interaction.guild.members
                .fetch(user.id)
                .catch(() => null);

        if (!member) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Error",
                        "Member not found."
                    )
                ],
                ephemeral: true
            });
        }

        const reason =
            interaction.options.getString("reason");

        const count =
            await createWarning(
                interaction,
                member,
                reason
            );

        await sendModerationDM(
            member,
            "Warning",
            reason
        );

        if (
            config.moderation.autoTimeoutAfterWarnings &&
            count >= config.moderation.maxWarnings
        ) {
            await member.timeout(
                config.moderation.autoTimeoutDuration,
                "Automatic timeout after reaching warning limit."
            );
        }

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Member Warned",
                    `**${user.tag}** has been warned.\n\n**Reason:** ${reason}\n**Total warnings:** ${count}`
                )
            ]
        });
    }
};