import { HistoryItem } from "../../shared/history-item";
declare const taskRouter: {
    openFile: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        filePath: string;
    }, {
        readonly success: false;
    } | {
        readonly success: true;
    }>;
    renameTask: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        taskId: string;
        newName: string;
    }, {
        readonly success: true;
    }>;
    pauseTask: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        taskId: string;
    }, {
        readonly paused: true;
        readonly taskId: string;
    }>;
    restoreTaskFromDisk: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
        readonly success: true;
        readonly tasksToRestore: string[];
        readonly taskHistoryItem: HistoryItem[];
    }>;
    markAsDone: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        taskId: string;
    }, {
        readonly success: true;
    }>;
    exportTaskFiles: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        taskId: string;
    }, unknown>;
};
export default taskRouter;
