import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    successEmbed
} from "../../utils/embeds.js";

export default {
    data: new SlashCommandBuilder()
        .setName("nickname")
        .setDescription("Change a member's nickname.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageNicknames
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("name")
                .setDescription("New nickname.")
                .setMaxLength(32)
                .setRequired(false)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const name =
            interaction.options.getString("name");

        const member =
            await interaction.guild.members.fetch(
                user.id
            );

        await member.setNickname(name);

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Nickname Updated",
                    name
                        ? `Changed **${user.tag}**'s nickname to **${name}**.`
                        : `Removed **${user.tag}**'s nickname.`
                )
            ]
        });
    }
};