import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';

export class GitService {
    private git: SimpleGit;
    private workspaceRoot: string;
    private isEnabled: boolean = false;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.git = simpleGit(workspaceRoot);
    }

    public setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
    }

    public isGitEnabled(): boolean {
        return this.isEnabled;
    }

    public async initializeRepository(): Promise<boolean> {
        try {
            const isRepo = await this.isGitRepository();
            if (!isRepo) {
                await this.git.init();
                // Create .gitignore if it doesn't exist
                const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
                const gitignoreExists = await vscode.workspace.fs.stat(vscode.Uri.file(gitignorePath))
                    .then(() => true)
                    .catch(() => false);
                
                if (!gitignoreExists) {
                    const defaultGitignore = `node_modules/\n.env\n.DS_Store\ndist/\n`;
                    await vscode.workspace.fs.writeFile(
                        vscode.Uri.file(gitignorePath),
                        Buffer.from(defaultGitignore, 'utf8')
                    );
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize git repository:', error);
            return false;
        }
    }

    public async isGitRepository(): Promise<boolean> {
        try {
            const result = await this.git.checkIsRepo();
            return result;
        } catch {
            return false;
        }
    }

    public async commitChanges(message: string): Promise<boolean> {
        if (!this.isEnabled) {
            return false;
        }

        try {
            await this.git.add('.');
            await this.git.commit(message);
            return true;
        } catch (error) {
            console.error('Failed to commit changes:', error);
            return false;
        }
    }

    public async getCurrentBranch(): Promise<string> {
        try {
            const result = await this.git.branch();
            return result.current;
        } catch (error) {
            console.error('Failed to get current branch:', error);
            return '';
        }
    }

    public async hasChanges(): Promise<boolean> {
        try {
            const status = await this.git.status();
            return status.files.length > 0;
        } catch (error) {
            console.error('Failed to check for changes:', error);
            return false;
        }
    }
}