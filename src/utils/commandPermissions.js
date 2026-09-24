import config from "../config.js";

/**
 * Checks whether a Discord user is authorized
 * to use the administrative tool commands.
 */
export function canUseToolCommands(userId) {
    return config.tools.authorizedUserIds.includes(
        userId
    );
}