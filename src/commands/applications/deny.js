import {
    handleReviewCommand
} from "../../utils/applications.js";

/*
 * >deny <application number> [reason]
 */
export default {
    data: {
        name: "deny"
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
            commandName: "deny",
            decision: "deny"
        });
    }
};
