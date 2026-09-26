import {
    handleReviewCommand
} from "../../utils/applications.js";

/*
 * >approve <application number> [reason]
 */
export default {
    data: {
        name: "approve"
    },

    async prefixExecute({
        message,
        args,
        prefix
    }) {
        return handleReviewCommand({
            message,
            args,
            prefix,
            commandName: "approve",
            decision: "accept"
        });
    }
};
