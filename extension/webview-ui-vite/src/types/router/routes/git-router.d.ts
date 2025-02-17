declare const gitRouter: {
    toggleGitHandler: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        enabled: boolean;
    }, {
        success: boolean;
    }>;
};
export default gitRouter;
