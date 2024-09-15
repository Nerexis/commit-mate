import * as vscode from 'vscode';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const moduleCfg = 'commitmate';
const openAiApiKeyCfg = 'openAiApiKey';
const ONBOARDING_COMPLETE_KEY = 'commitmate.onboardingComplete';

export async function checkOnboarding(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration(moduleCfg);
	const openAiKey = config.get<string>(openAiApiKeyCfg);
  	
	if (openAiKey && openAiKey.trim().length > 0) {
	  context.globalState.update(ONBOARDING_COMPLETE_KEY, true);
	  return;
	}
  	
	const isOnboardingComplete = context.globalState.get<boolean>(ONBOARDING_COMPLETE_KEY, false);
  
	if (!isOnboardingComplete) {
	  const setupAction = 'Set up OpenAI API Key';
	  const skipAction = 'Skip';
  
	  const result = await vscode.window.showInformationMessage(
		'Welcome to CommitMate! To generate commit messages, you need to configure your OpenAI API key.',
		setupAction,
		skipAction
	  );
  
	  if (result === setupAction) {		
		await vscode.commands.executeCommand('workbench.action.openSettings', 'commitmate.openAiApiKey');
		context.globalState.update(ONBOARDING_COMPLETE_KEY, true);
	  } else if (result === skipAction) {		
		context.globalState.update(ONBOARDING_COMPLETE_KEY, true);
	  }
	}
  }
  
export async function activate(context: vscode.ExtensionContext) {
  logMessage('Extension activated.');
  
  await checkOnboarding(context);

  let disposable = vscode.commands.registerCommand('extension.generateCommitMessage', async () => {
	logMessage('Generate Commit Message command invoked.');
	try {
	  const activeRepository = await getActiveRepository();
	  if (!activeRepository) {
		logMessage('No active Git repository found. Sometimes you might need to click on one of edited files in the Source Control window.', 'error');
		showErrorMessage('No active Git repository found.\n\nSometimes you might need to click on one of edited files in the Source Control window.');
		return;
	  }

	  logMessage('Active repository found.');

	  const stagedChanges = await getStagedDiff(activeRepository);
	  if (!stagedChanges) {
		logMessage('No staged changes found.', 'error');
		showErrorMessage('No staged changes found.');
		return;
	  }

	  logMessage(`Staged changes retrieved:\n${stagedChanges}`);

	  showInformationMessage('Generating commit message...');

	  const commitMessage = await generateCommitMessageFromAI(stagedChanges);
	  if (commitMessage) {
		logMessage(`AI-generated commit message: ${commitMessage}`);

		const scmInputBox = getScmInputBox(activeRepository);
		if (scmInputBox) {
		  scmInputBox.value = commitMessage;
		  showInformationMessage('Commit message set in SCM input box.');
		} else {
		  logMessage('Unable to set commit message in SCM input box.', 'error');
		  showErrorMessage('Unable to set commit message in SCM input box.');
		}
	  }
	} catch (error) {
	  handleError(error);
	}
  });

  context.subscriptions.push(disposable);

  let disposableOpenAiKey = vscode.commands.registerCommand('commitmate.openOpenAiKeyPage', () => {
	const openAiKeyUrl = 'https://platform.openai.com/api-keys';
	vscode.env.openExternal(vscode.Uri.parse(openAiKeyUrl));
	logMessage('Opening OpenAI API Key page in browser...');
  });

  context.subscriptions.push(disposableOpenAiKey);
}

export async function runGitCommand(repo: any, args: string[]): Promise<string | null> {
	try {
	  const command = `git ${args.join(' ')}`;
	  logMessage(`Executing command: ${command}`);
	  	  
	  const { stdout, stderr } = await execAsync(command, {
		cwd: repo.rootUri.fsPath,
		maxBuffer: 1024 * 1024 * 10 // 10 MB buffer
	  });
	  
	  if (stderr) {
		logMessage(`Error executing command: ${stderr}`, 'error');
		return null;
	  }
	  
	  logMessage(`Command output: ${stdout}`);
	  return stdout.trim();
	} catch (error) {
	  logMessage(`Error running git command: ${error}`, 'error');
	  return null;
	}
  }
  
  
  async function getStagedDiff(repo: any) {
	try {
		const gitCommand = ['diff', '--staged']; 
		logMessage('Checking staged files for the active repository...');
        		
		logMessage(`Running Git command: git ${gitCommand.join(' ')}`);
        
		const startTimeForDiff = Date.now(); 
		
		const diff = await runGitCommand(repo, gitCommand);
        
		const endTimeForDiff = Date.now(); 
		const diffTimeTaken = (endTimeForDiff - startTimeForDiff) / 1000; // Time in seconds
        
		if (diff) {
			logMessage(`Git diff output: ${diff}`);
			logMessage(`Time taken to generate Git diff: ${diffTimeTaken} seconds.`);
			showInformationMessage(`Git diff generated in ${diffTimeTaken} seconds.`);
			return diff;
		} else {
			logMessage('No staged changes found.');
			return null;
		}
	} catch (error) {
		logMessage(`Error running git diff: ${error}`, 'error');
		return null;
	}
}

async function getActiveRepository() {
	const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
	if (!gitExtension) {
	  logMessage('Git extension not found.', 'error');
	  return null;
	}
  
	const git = gitExtension.getAPI(1);
	const repositories = git.repositories;
	
	logMessage(`Found ${repositories.length} repositories.`); 
	
	if (repositories.length === 0) {
	  logMessage('No Git repositories found.', 'error');
	  return null;
	}
  
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
	  logMessage('No active editor found.', 'error');
	  return null;
	}
  
	const documentUri = editor.document.uri;
	logMessage(`Active document URI: ${documentUri.fsPath}`);
  
	for (const repo of repositories) {
	  logMessage(`Checking repository: ${repo.rootUri.fsPath}`);
	  if (documentUri.fsPath.startsWith(repo.rootUri.fsPath)) {
		logMessage(`Active repository found for file: ${documentUri.fsPath}`);
		return repo;
	  }
	}
  
	logMessage('No active repository matches the current document.', 'error');
	return null;
  }
  
  export async function generateCommitMessageFromAI(stagedChanges: string): Promise<string | null> {
	logMessage('Entering generateCommitMessageFromAI function...');


	const config = vscode.workspace.getConfiguration('commitmate');
    
	const openAiKey = config.get<string>('openAiApiKey');
	const model = config.get<string>('openAiModel', 'gpt-4o-mini');
	const openAiUrl = config.get<string>('openAiUrl', 'https://api.openai.com/v1/chat/completions');
	const prefix = config.get<string>('requestPrefix');
	const suffix = config.get<string>('requestSuffix');
  
	if (!openAiKey) {
		logMessage('OpenAI API key not found in settings.', 'error');
		showErrorMessage('Please set your OpenAI API key in the settings.');
		return null;
	}
  
	logMessage('Preparing to send request to OpenAI API...');
  
	const headers = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${openAiKey}`,
	};
  
	const finalMessage = `${prefix}\n\n${stagedChanges}\n\n${suffix}`;
  
	const data = {
		model,
		messages: [{ role: 'user', content: finalMessage }],
		temperature: 0.7,
	};
  	
	logMessage(`Request Payload: ${JSON.stringify(data, null, 2)}`);
  
	try {
		const startTimeForOpenAi = Date.now();
        
		const response = await axios.post(openAiUrl, data, { headers });
        
		const endTimeForOpenAi = Date.now();
		const openAiTimeTaken = (endTimeForOpenAi - startTimeForOpenAi) / 1000; // Time in seconds
        
		logMessage(`Response received from OpenAI API. Status: ${response.status}`);
		logMessage(`Time taken for OpenAI API response: ${openAiTimeTaken} seconds`);
        
		showInformationMessage(`OpenAI API response received in ${openAiTimeTaken} seconds.`);
        
		return response.data.choices[0].message.content.trim();
	} catch (error: any) {
		const errorMessage = `Error from OpenAI API: ${error.message}`;
		logMessage(errorMessage, 'error');		
		showErrorMessage(errorMessage);        
		return null;
	}
}


function getScmInputBox(repository: any): vscode.SourceControlInputBox | null {
  return repository.inputBox ?? null;
}

function logMessage(message: string, level: 'info' | 'error' = 'info') {
  const dateTime = new Date().toISOString();
  console[level](`[CommitMate - ${dateTime}] ${message}`);
}

function showInformationMessage(message: string) {
  vscode.window.showInformationMessage(message);
}

function showErrorMessage(message: string) {
  vscode.window.showErrorMessage(message);
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logMessage(`Error occurred: ${message}`, 'error');
  showErrorMessage(`Error: ${message}`);
}

export function deactivate() {}
