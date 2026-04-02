import { Command } from 'commander';
import HisTree from './HisTree.mjs';

export function setupCLI() {
    const program = new Command();

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
}
