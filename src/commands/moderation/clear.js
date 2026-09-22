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
        .setName("clear")
        .setDescription("Delete messages.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Number of messages.")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    async execute(interaction) {
        const amount =
            interaction.options.getInteger();

        if (!interaction.channel.isTextBased()) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Error",
                        "This command cannot be used here."
                    )
                ],
                ephemeral: true
            });
        }

        const messages =
            await interaction.channel.bulkDelete(
                amount,
                true
            );

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Messages Deleted",
                    `Deleted **${messages.size}** messages.`
                )
            ],
            ephemeral: true
        });
    }
};