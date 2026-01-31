import * as vscode from 'vscode';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const moduleCfg = 'commitmate';
const openAiApiKeyCfg = 'openAiApiKey';
const ONBOARDING_COMPLETE_KEY = 'commitmate.onboardingComplete';

const MSG_NO_ACTIVE_REPO = 'No active Git repository found.';
const MSG_NO_ACTIVE_REPO_HINT = 'Sometimes you might need to click on one of edited files in the Source Control window.';
const MSG_NO_STAGED_CHANGES = 'No staged changes found.';
const MSG_GIT_EXTENSION_NOT_FOUND = 'Git extension not found.';
const MSG_CUSTOM_MODEL_MISSING = 'Custom model is selected but no model name was provided.';
const MSG_OPENAI_NO_OUTPUT = 'OpenAI response did not contain output text.';
const MSG_SCM_INPUTBOX_FAIL = 'Unable to set commit message in SCM input box.';

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
	  let activeRepository = await getActiveRepository();
	  if (!activeRepository) {
		logMessage('No active Git repository found. Attempting to auto-select the first staged change.');
		activeRepository = await getRepositoryFromStagedChanges();
		if (!activeRepository) {
		  logMessage(`${MSG_NO_ACTIVE_REPO} ${MSG_NO_ACTIVE_REPO_HINT}`, 'error');
		  showErrorMessage(`${MSG_NO_ACTIVE_REPO}\n\n${MSG_NO_ACTIVE_REPO_HINT}`);
		  return;
		}
	  }

	  logMessage('Active repository found.');

	  const stagedChanges = await getStagedDiff(activeRepository);
	  if (!stagedChanges) {
		logMessage(MSG_NO_STAGED_CHANGES, 'error');
		showErrorMessage(MSG_NO_STAGED_CHANGES);
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
		  logMessage(MSG_SCM_INPUTBOX_FAIL, 'error');
		  showErrorMessage(MSG_SCM_INPUTBOX_FAIL);
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
			logMessage(MSG_NO_STAGED_CHANGES);
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
	  logMessage(MSG_GIT_EXTENSION_NOT_FOUND, 'error');
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

async function getRepositoryFromStagedChanges() {
	const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
	if (!gitExtension) {
		logMessage(MSG_GIT_EXTENSION_NOT_FOUND, 'error');
		return null;
	}

	const git = gitExtension.getAPI(1);
	const repositories = git.repositories;

	logMessage(`Searching ${repositories.length} repositories for staged changes...`);

	for (const repo of repositories) {
		const stagedChanges = repo.state?.indexChanges ?? [];
		if (stagedChanges.length === 0) {
			continue;
		}

		const change = stagedChanges[0];
		const opened = await openChangeInEditor(change);
		logMessage(
			opened
				? `Opened first staged change to establish active repository: ${repo.rootUri.fsPath}`
				: `Found staged changes but could not open the first change: ${repo.rootUri.fsPath}`,
			opened ? 'info' : 'error'
		);
		return repo;
	}

	logMessage('No staged changes found in any repository.', 'error');
	return null;
}

async function openChangeInEditor(change: any): Promise<boolean> {
	const candidateUris = [change?.uri, change?.originalUri, change?.renameUri].filter(Boolean);
	if (candidateUris.length === 0) {
		logMessage('Staged change has no URI to open.', 'error');
		return false;
	}

	for (const uri of candidateUris) {
		try {
			await vscode.window.showTextDocument(uri, { preview: false, preserveFocus: true });
			return true;
		} catch (error) {
			logMessage(`Failed to open staged change in editor: ${error}`, 'error');
		}
	}

	return false;
}
  
export async function generateCommitMessageFromAI(stagedChanges: string): Promise<string | null> {
	logMessage('Entering generateCommitMessageFromAI function...');


	const config = vscode.workspace.getConfiguration('commitmate');
    
	const openAiKey = config.get<string>('openAiApiKey');
	const selectedModel = config.get<string>('openAiModel', 'gpt-5-mini');
	const customModel = config.get<string>('openAiCustomModel', '');
	const openAiUrl = config.get<string>('openAiUrl', 'https://api.openai.com/v1/responses');
	const temperatureEnabled = config.get<boolean>('openAiTemperatureEnabled', true);
	const temperature = config.get<number>('openAiTemperature', 0.4);
	const reasoningEffortEnabled = config.get<boolean>('openAiReasoningEffortEnabled', true);
	const reasoningEffort = config.get<string>('openAiReasoningEffort', 'medium');
	const reasoningSummary = config.get<string>('openAiReasoningSummary', 'null');
	const verbosityEnabled = config.get<boolean>('openAiVerbosityEnabled', true);
	const verbosity = config.get<string>('openAiVerbosity', 'medium');
	const prefix = config.get<string>('requestPrefix');
	const suffix = config.get<string>('requestSuffix');
  
	if (!openAiKey) {
		logMessage('OpenAI API key not found in settings.', 'error');
		showErrorMessage('Please set your OpenAI API key in the settings.');
		return null;
	}
  
	const model = resolveModel(selectedModel, customModel);
	if (!model) {
		logMessage(MSG_CUSTOM_MODEL_MISSING, 'error');
		showErrorMessage(MSG_CUSTOM_MODEL_MISSING);
		return null;
	}

	logMessage(`Preparing to send request to OpenAI API with model: ${model}`);
  
	const headers = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${openAiKey}`,
	};
  
	const finalMessage = `${prefix}\n\n${stagedChanges}\n\n${suffix}`;
  
	const data: {
		model: string;
		input: { role: 'user'; content: string }[];
		temperature?: number;
		reasoning?: { effort?: string; summary?: string | null };
		text?: { verbosity: string };
	} = {
		model,
		input: [{ role: 'user', content: finalMessage }],
	};

	if (temperatureEnabled) {
		data.temperature = typeof temperature === 'number' ? temperature : 0.4;
	}

	const reasoningPayload: { effort?: string; summary?: string | null } = {};

	if (reasoningEffortEnabled) {
		const normalizedEffort = normalizeReasoningEffort(reasoningEffort);
		const supportedEfforts = getSupportedReasoningEfforts(model);
		if (supportedEfforts && !supportedEfforts.has(normalizedEffort)) {
			logMessage(
				`Reasoning effort '${normalizedEffort}' is not supported by model '${model}'. Skipping reasoning.effort.`,
				'error'
			);
		} else {
			reasoningPayload.effort = normalizedEffort;
		}
	}

	const summaryResult = normalizeReasoningSummary(reasoningSummary);
	if (summaryResult.send) {
		reasoningPayload.summary = summaryResult.summary;
	}

	if (Object.keys(reasoningPayload).length > 0) {
		data.reasoning = reasoningPayload;
	}

	if (verbosityEnabled) {
		data.text = { verbosity: normalizeVerbosity(verbosity) };
	}
  	
	logMessage(`Request Payload: ${JSON.stringify(data, null, 2)}`);
  
	try {
		const startTimeForOpenAi = Date.now();
        
		const response = await axios.post(openAiUrl, data, { headers });
        
		const endTimeForOpenAi = Date.now();
		const openAiTimeTaken = (endTimeForOpenAi - startTimeForOpenAi) / 1000; // Time in seconds
        
		const responseModel = typeof response.data?.model === 'string' ? response.data.model : model;
		logMessage(`Response received from OpenAI API. Status: ${response.status}. Model: ${responseModel}`);
		logMessage(`Time taken for OpenAI API response: ${openAiTimeTaken} seconds`);
        
		showInformationMessage(`OpenAI API response received in ${openAiTimeTaken} seconds (model: ${responseModel}).`);

		const responseText = extractResponseText(response.data);
		if (!responseText) {
			logMessage(MSG_OPENAI_NO_OUTPUT, 'error');
			showErrorMessage(MSG_OPENAI_NO_OUTPUT);
			return null;
		}

		return responseText.trim();
	} catch (error: any) {
		const errorDetails = formatOpenAiError(error, openAiUrl);
		const errorMessage = `Error from OpenAI API: ${errorDetails.summary}`;
		logMessage(errorMessage, 'error');
		logMessage(`OpenAI error details: ${errorDetails.details}`, 'error');
		showErrorMessage(errorMessage);
		if (errorDetails.responseErrorMessage) {
			showErrorMessage(`OpenAI error message: ${errorDetails.responseErrorMessage}`);
		}
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

function resolveModel(selectedModel: string | undefined, customModel: string | undefined) {
	if (selectedModel === 'custom') {
		const trimmed = (customModel ?? '').trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	return (selectedModel ?? '').trim() || null;
}

function normalizeReasoningEffort(value: string | undefined) {
	const normalized = (value ?? '').trim().toLowerCase();
	return normalized.length > 0 ? normalized : 'medium';
}

function normalizeReasoningSummary(value: string | undefined) {
	const normalized = (value ?? '').trim().toLowerCase();
	if (normalized === 'null') {
		return { send: true, summary: null };
	}
	if (normalized === 'none' || normalized === 'auto' || normalized === 'concise' || normalized === 'detailed') {
		return { send: true, summary: normalized };
	}
	return { send: false, summary: null };
}

function normalizeVerbosity(value: string | undefined) {
	const normalized = (value ?? '').trim().toLowerCase();
	if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
		return normalized;
	}
	return 'medium';
}

function extractResponseText(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	const maybeOutputText = (payload as { output_text?: unknown }).output_text;
	if (typeof maybeOutputText === 'string' && maybeOutputText.trim().length > 0) {
		return maybeOutputText;
	}

	const output = (payload as { output?: unknown }).output;
	if (!Array.isArray(output)) {
		return null;
	}

	const parts: string[] = [];
	for (const item of output) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const content = (item as { content?: unknown }).content;
		if (Array.isArray(content)) {
			for (const part of content) {
				if (!part || typeof part !== 'object') {
					continue;
				}

				const partType = (part as { type?: unknown }).type;
				const text = (part as { text?: unknown }).text;
				if ((partType === 'output_text' || partType === 'text') && typeof text === 'string') {
					parts.push(text);
				}
			}
		}
	}

	const combined = parts.join('');
	return combined.trim().length > 0 ? combined : null;
}

function getSupportedReasoningEfforts(model: string): Set<string> | null {
	const map: Record<string, string[]> = {
		'gpt-5': ['minimal', 'low', 'medium', 'high'],
		'gpt-5-mini': ['minimal', 'low', 'medium', 'high'],
		'gpt-5-nano': ['minimal', 'low', 'medium', 'high'],
		'gpt-5.1': ['none', 'low', 'medium', 'high'],
		'gpt-5.2': ['none', 'low', 'medium', 'high'],
		'gpt-5.1-codex': ['none', 'low', 'medium', 'high'],
		'gpt-5.1-codex-mini': ['none', 'low', 'medium', 'high'],
		'gpt-5.1-codex-max': ['none', 'low', 'medium', 'high'],
		'gpt-5.2-codex': ['none', 'low', 'medium', 'high'],
		'gpt-5-chat-latest': ['minimal', 'low', 'medium', 'high'],
		'gpt-5.1-chat-latest': ['none', 'low', 'medium', 'high'],
		'gpt-5.2-chat-latest': ['none', 'low', 'medium', 'high'],
		'gpt-5-pro': ['high']
	};

	const supported = map[model];
	return supported ? new Set(supported) : null;
}

function formatOpenAiError(error: unknown, openAiUrl: string) {
	if (!axios.isAxiosError(error)) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			summary: message,
			details: `Non-Axios error while calling ${openAiUrl}. Message: ${message}`,
			responseErrorMessage: null as string | null
		};
	}

	const status = error.response?.status;
	const statusText = error.response?.statusText;
	const responseData = safeStringify(error.response?.data);
	const responseErrorMessage = extractOpenAiErrorMessage(error.response?.data);
	const responseHeaders = safeStringify(redactHeaders(error.response?.headers));
	const requestMethod = error.config?.method?.toUpperCase() ?? 'UNKNOWN';
	const requestUrl = error.config?.url ?? openAiUrl;
	const requestHeaders = safeStringify(redactHeaders(error.config?.headers));
	const requestData = safeStringify(error.config?.data);

	const summaryParts = [
		status ? `status ${status}` : 'no status',
		statusText ? `(${statusText})` : '',
		error.message ? `- ${error.message}` : ''
	].filter(Boolean);

	return {
		summary: summaryParts.join(' ').trim(),
		details: [
			`request: ${requestMethod} ${requestUrl}`,
			`requestHeaders: ${requestHeaders}`,
			`requestBody: ${requestData}`,
			`responseStatus: ${status ?? 'unknown'} ${statusText ?? ''}`.trim(),
			`responseHeaders: ${responseHeaders}`,
			`responseBody: ${responseData}`
		].join(' | '),
		responseErrorMessage
	};
}

function extractOpenAiErrorMessage(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	const maybeError = (payload as { error?: { message?: unknown } }).error;
	if (!maybeError || typeof maybeError !== 'object') {
		return null;
	}

	const message = (maybeError as { message?: unknown }).message;
	return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

function redactHeaders(headers: unknown) {
	if (!headers || typeof headers !== 'object') {
		return headers;
	}

	const cloned: Record<string, unknown> = { ...(headers as Record<string, unknown>) };
	for (const key of Object.keys(cloned)) {
		if (key.toLowerCase() === 'authorization') {
			cloned[key] = '[REDACTED]';
		}
	}

	return cloned;
}

function safeStringify(value: unknown) {
	if (value === undefined) {
		return 'undefined';
	}

	if (typeof value === 'string') {
		return value;
	}

	try {
		return JSON.stringify(value);
	} catch {
		return '[Unserializable]';
	}
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
