import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    canModerate,
    botCanModerate
} from "../../utils/permissions.js";

import {
    sendModerationDM
} from "../../utils/moderation.js";

import {
    successEmbed,
    errorEmbed
} from "../../utils/embeds.js";

export default {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a member.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to timeout.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Timeout duration.")
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason.")
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const minutes =
            interaction.options.getInteger("minutes");

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided.";

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

        if (
            !canModerate(interaction, member) ||
            !botCanModerate(interaction, member)
        ) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Error",
                        "You cannot timeout this member."
                    )
                ],
                ephemeral: true
            });
        }

        await sendModerationDM(
            member,
            "Timeout",
            reason
        );

        await member.timeout(
            minutes * 60 * 1000,
            reason
        );

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Member Timed Out",
                    `**${user.tag}** has been timed out for **${minutes} minutes**.\n\n**Reason:** ${reason}`
                )
            ]
        });
    }
};