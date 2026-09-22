import config from "../config.js";

export async function logAction(
    guild,
    embed
) {
    if (!config.moderation.logChannelId) {
        return;
    }

    const channel =
        guild.channels.cache.get(
            config.moderation.logChannelId
        );

    if (!channel) return;

    await channel.send({
        embeds: [embed]
    }).catch(() => {});
}