#!/usr/bin/env node

// Import necessary modules
import path from 'path';           // Handles and transforms file paths
import fs from 'fs/promises';      // File system operations with promises
import crypto from 'crypto';       // Hashing for objects (like Git SHA1)
import { diffLines } from 'diff';  // Used to compute differences between file versions
import chalk from 'chalk';         // Colors terminal output
import { Command } from 'commander'; // Command-line argument parser

// Initialize a command-line interface (CLI) program using Commander.js
const program = new Command();

// HisTree class handles the core functionality of the mini Git system
class HisTree {
    // Constructor initializes paths for the repo's core files and folders
    constructor(repoPath = '.') {
        this.repoPath = path.join(repoPath, '.histree');  // .histree acts like .git
        this.objectsPath = path.join(this.repoPath, 'objects'); // Stores objects (file versions and commits)
        this.headPath = path.join(this.repoPath, 'HEAD');  // Points to the current commit
        this.indexPath = path.join(this.repoPath, 'index'); // Staging area for added files
        this.init(); // Initialize the repository
    }

    // Initializes necessary folders and files if they don't exist
    async init() {
        await fs.mkdir(this.objectsPath, { recursive: true }); // Create objects folder
        try {
            // Create HEAD and index files only if they don’t already exist
            await fs.writeFile(this.headPath, '', { flag: 'wx' });
            await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: 'wx' });
        } catch (error) {
            console.log('Already initialised the .histree folder');
        }
    }

    // Hash content using SHA-1 (like Git) to create unique identifiers for files/commits
    hashObject(content) {
        return crypto.createHash('sha1').update(content, 'utf-8').digest('hex');
    }

    // Adds a file to the staging area
    async add(fileToBeAdded) {
        const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8' }); // Read file contents
        const fileHash = this.hashObject(fileData); // Generate hash of the file
        console.log(fileHash);

        // Store the file's contents in the objects folder under its hash
        const newFileHashedObjectPath = path.join(this.objectsPath, fileHash);
        await fs.writeFile(newFileHashedObjectPath, fileData);
        
        // Update the staging area (index)
        await this.updateStagingArea(fileToBeAdded, fileHash);
        console.log(`Added ${fileToBeAdded}`);
    }

    // Updates the staging area with the file's path and hash
    async updateStagingArea(filePath, fileHash) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // Read the index file
        index.push({ path: filePath, hash: fileHash }); // Add the new file to the staging area
        await fs.writeFile(this.indexPath, JSON.stringify(index), { encoding: 'utf-8' }); // Save updated index
    }

    // Commits staged files with a message
    async commit(message) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // Read the index (staged files)
        const parentCommit = await this.getCurrentHead(); // Get the previous commit

        // Create a commit object with metadata and the staged files
        const commitData = {
            timeStamp: new Date().toISOString(),  // Timestamp of the commit
            message,                              // Commit message
            files: index,                         // Files being committed
            parent: parentCommit,                 // Parent commit (previous)
        };

        // Hash the commit object and save it in the objects folder
        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath, commitHash);
        await fs.writeFile(commitPath, JSON.stringify(commitData));

        // Update HEAD to point to the new commit and clear the staging area
        await fs.writeFile(this.headPath, commitHash);
        await fs.writeFile(this.indexPath, JSON.stringify([]));
        console.log(`Commit successfully created: ${commitHash}`);
    }

    // Retrieves the current HEAD (the latest commit)
    async getCurrentHead() {
        try {
            return await fs.readFile(this.headPath, { encoding: 'utf-8' });
        } catch (error) {
            return null;
        }
    }

    // Logs the commit history
    async log() {
        let currentCommitHash = await this.getCurrentHead();  // Start from the latest commit
        while (currentCommitHash) {
            // Retrieve and print commit details
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash), { encoding: 'utf-8' }));
            console.log(`Commit: ${currentCommitHash}\nDate: ${commitData.timeStamp}\n\n${commitData.message}\n\n`);
            currentCommitHash = commitData.parent;  // Move to the parent commit
        }
    }

    // Displays the difference (diff) between a commit and its parent
    async showCommitDiff(commitHash) {
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if (!commitData) {
            console.log('Commit not found');
            return;
        }
        console.log('Changes in the last commit are:');

        // Iterate over the files in the commit
        for (const file of commitData.files) {
            console.log(`File:  ${file.path}`);
            const fileContent = await this.getFileContent(file.hash); // Get the file content for the current commit
            console.log(fileContent);

            if (commitData.parent) {
                // If the commit has a parent, show the diff between the two
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent));
                const getParentFileContent = await this.getParentFileContent(parentCommitData, file.path);

                if (getParentFileContent !== undefined) {
                    console.log('\nDiff');
                    const diff = diffLines(getParentFileContent, fileContent);  // Compare parent and current content

                    diff.forEach(part => {
                        // Highlight additions, deletions, and unchanged parts
                        if (part.added) {
                            process.stdout.write(chalk.green('\n++ ' + part.value));
                        } else if (part.removed) {
                            process.stdout.write(chalk.red('\n-- ' + part.value));
                        } else {
                            process.stdout.write(chalk.gray('\n== ' + part.value));
                        }
                    });
                    console.log();
                }
                else {
                    console.log('New file in this commit');
                }
            } else {
                console.log('First commit');
            }
        }
    }

    // Gets file content for a file from its parent commit
    async getParentFileContent(parentCommitData, filePath) {
        const parentFile = parentCommitData.files.find(file => file.path === filePath);
        if (parentFile) {
            return await this.getFileContent(parentFile.hash);
        }
    }

    // Retrieves the file content by its hash
    async getFileContent(fileHash) {
        const objectPath = path.join(this.objectsPath, fileHash);
        return fs.readFile(objectPath, { encoding: 'utf-8' });
    }

    // Retrieves the commit data for a specific commit hash
    async getCommitData(commitHash) {
        const commitPath = path.join(this.objectsPath, commitHash);
        try {
            return await fs.readFile(commitPath, { encoding: 'utf-8' });
        } catch (error) {
            return null;
        }
    }

    // Creates a new branch by saving the current commit hash as a branch reference
    async createBranch(branchName) {
        const branchPath = path.join(this.repoPath, `refs/${branchName}`);
        const currentHead = await this.getCurrentHead();
        await fs.writeFile(branchPath, currentHead);
        console.log(`Branch '${branchName}' created`);
    }

    // Lists all branches in the repository
    async listBranches() {
        const refsPath = path.join(this.repoPath, 'refs');
        const branches = await fs.readdir(refsPath);
        console.log('Branches:');
        branches.forEach(branch => console.log(`* ${branch}`));
    }

    // Checks out a branch or commit, updating HEAD
    async checkout(target) {
        const branchPath = path.join(this.repoPath, `refs/${target}`);
        let targetHash;

        try {
            targetHash = await fs.readFile(branchPath, { encoding: 'utf-8' });
        } catch (error) {
            targetHash = target;  // If not a branch, assume it's a commit hash
        }

        await fs.writeFile(this.headPath, targetHash);
        console.log(`Checked out ${target}`);
    }

    // Merges the specified branch into the current branch (basic implementation)
    async merge(branchName) {
        const branchPath = path.join(this.repoPath, `refs/${branchName}`);
        const targetCommitHash = await fs.readFile(branchPath, { encoding: 'utf-8' });
        const currentHead = await this.getCurrentHead();

        // A simple placeholder for the merge logic
        const baseCommitHash = this.findCommonAncestor(currentHead, targetCommitHash);
        console.log(`Merging ${branchName} into current branch...`);

        // Handle conflicts and fast-forward cases (not implemented)
    }

        // Reset the repository to a specific commit with two modes: soft and hard
    async reset(commitHash, mode = 'soft') {
        await fs.writeFile(this.headPath, commitHash);  // Update HEAD to the specified commit

        if (mode === 'hard') {
            // Hard reset: Updates both the working directory and the staging area
            const commitData = JSON.parse(await this.getCommitData(commitHash));  // Get the commit's data
            for (const file of commitData.files) {
                const content = await this.getFileContent(file.hash);  // Get file content based on the commit
                await fs.writeFile(file.path, content);  // Overwrite working directory files with committed files
            }
            await fs.writeFile(this.indexPath, JSON.stringify(commitData.files));  // Update the staging area
        } else if (mode === 'soft') {
            // Soft reset: Only update the HEAD, leaving the working directory and staging area unchanged
        }
        console.log(`Reset to ${commitHash}`);
    }

    // Check the status of the working directory and staging area
    async status() {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' }));  // Read the staging area (index)
        const currentCommitHash = await this.getCurrentHead();  // Get the current commit hash (HEAD)

        const currentCommit = JSON.parse(await this.getCommitData(currentCommitHash));  // Get the current commit data
        const trackedFiles = currentCommit ? currentCommit.files : [];  // List of files tracked in the current commit

        console.log('Changes to be committed:');  // Files in the staging area (to be committed)
        for (const stagedFile of index) {
            if (!trackedFiles.find(file => file.hash === stagedFile.hash)) {
                console.log(chalk.green(stagedFile.path));  // New file added (not in current commit)
            }
        }

        console.log('Changes not staged for commit:');  // Files modified in the working directory but not staged
        for (const file of trackedFiles) {
            const fileContent = await this.getFileContent(file.hash);  // Get the file content from the last commit
            const currentFileContent = await fs.readFile(file.path, { encoding: 'utf-8' });  // Read the current file content

            if (fileContent !== currentFileContent) {
                console.log(chalk.red(file.path));  // File modified in the working directory
            }
        }
    }
}

// Define CLI commands using the Commander.js program instance

// Initialize the repository by creating the necessary files and folders
program.command('init').action(async () => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.init();  // Call the init method to initialize the repo
});

// Add a specified file to the staging area
program.command('add <file>').action(async (file) => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.add(file);  // Call the add method with the specified file
});

// Create a new commit with a specified message
program.command('commit <message>').action(async (message) => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.commit(message);  // Call the commit method with the commit message
});

// Show the commit log (history)
program.command('log').action(async () => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.log();  // Call the log method to display the commit history
});

// Show the changes in a specific commit
program.command('show <commitHash>').action(async (commitHash) => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.showCommitDiff(commitHash);  // Call the showCommitDiff method with the specified commit hash
});

// Create a new branch with the specified branch name
program.command('branch <branchName>').action(async (branchName) => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.createBranch(branchName);  // Call the createBranch method with the branch name
});

// List all branches in the repository
program.command('branches').action(async () => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.listBranches();  // Call the listBranches method to display all branches
});

// Switch to a specified branch or commit
program.command('checkout <target>').action(async (target) => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.checkout(target);  // Call the checkout method with the target branch or commit
});

// Merge the specified branch into the current branch
program.command('merge <branchName>').action(async (branchName) => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.merge(branchName);  // Call the merge method to merge the branch
});

// Reset the repository to a specific commit with an optional mode (soft or hard)
program.command('reset <commitHash> [mode]').action(async (commitHash, mode = 'soft') => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.reset(commitHash, mode);  // Call the reset method with the commit hash and reset mode
});

// Check the status of the working directory and staging area
program.command('status').action(async () => {
    const histree = new HisTree();  // Create an instance of the HisTree class
    await histree.status();  // Call the status method to show the current status
});

// Display a default message if an unknown command is entered
program.command('*').action(async () => {
    console.log('Please provide a valid command. Use --help for more information.');
});

// Custom help output for the CLI tool, showing command examples
program.on('--help', () => {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ histree init');
    console.log('    $ histree add <file>');
    console.log('    $ histree commit <message>');
    console.log('    $ histree log');
    console.log('    $ histree show <commitHash>');
    console.log('    $ histree branch <branchName>');
    console.log('    $ histree branches');
    console.log('    $ histree checkout <target>');
    console.log('    $ histree merge <branchName>');
    console.log('    $ histree reset <commitHash> [mode]');
    console.log('    $ histree status');
    console.log('');
});

// Parse the command-line arguments and execute the appropriate command
program.parse(process.argv);
