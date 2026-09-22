import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    successEmbed,
    errorEmbed
} from "../../utils/embeds.js";

export default {
    data: new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Remove a member's timeout.")
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

        await member.timeout(null);

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Timeout Removed",
                    `Removed the timeout from **${user.tag}**.`
                )
            ]
        });
    }
};