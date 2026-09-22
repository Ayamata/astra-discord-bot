import {
    Events,
    ActivityType
} from "discord.js";

import config from "../config.js";

export default {
    name: Events.ClientReady,
    once: true,

    execute(client) {
        console.log(
            `Logged in as ${client.user.tag}`
        );

        client.user.setPresence({
            activities: [
                {
                    name: config.bot.status,

                    type:
                        ActivityType.Streaming
                }
            ],

            status: "streaming"
        });
    }
};