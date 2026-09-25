import { PermissionFlagsBits } from "discord.js";
import config from "../config.js";

export function canUseToolCommands(memberOrUserId) {
    if (!memberOrUserId) return false;

    const userId =
        typeof memberOrUserId === "string"
            ? memberOrUserId
            : memberOrUserId.id;

    // Check authorized user IDs
    if (
        config.tools.authorizedUserIds
            .map(String)
            .includes(String(userId))
    ) {
        return true;
    }

    return false;
}