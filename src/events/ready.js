import {
    Events,
    ActivityType
} from "discord.js";

import config from "../config.js";
import {
    startEmailSupportPolling
} from "../utils/emailSupport.js";

async function getOnlineCount() {
    try {
        const response =
            await fetch(
                config.presence.apiUrl
            );

        if (!response.ok) {
            throw new Error(
                `Presence API returned ${response.status}`
            );
        }

        const data =
            await response.json();

        const online =
            Number(data.online);

        if (
            !Number.isFinite(online)
        ) {
            throw new Error(
                "API returned an invalid 'online' value."
            );
        }

        return online;

    } catch (error) {
        console.error(
            "[PRESENCE] Failed to fetch online count:",
            error.message
        );

        return null;
    }
}

async function updatePresence(
    client
) {
    const online =
        await getOnlineCount();

    if (online === null) {
        client.user.setActivity(
            "Online",
            {
                type:
                    ActivityType.Watching
            }
        );

        return;
    }

    client.user.setActivity(
        `Online: ${online} players`,
        {
            type:
                ActivityType.Watching
        }
    );

    console.log(
        `[PRESENCE] Online player count: ${online}`
    );
}

export default {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        console.log(
            `Logged in as ${client.user.tag}`
        );

        await updatePresence(
            client
        );

        startEmailSupportPolling(client);

        setInterval(
            async () => {
                await updatePresence(
                    client
                );
            },
            config.presence.updateInterval
        );
    }
};