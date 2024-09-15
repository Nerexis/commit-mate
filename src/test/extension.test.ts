import * as assert from 'assert';
import * as vscode from 'vscode';
import moxios from 'moxios';
import tsSinon from 'ts-sinon';
import { activate, generateCommitMessageFromAI} from '../extension';

suite('CommitMate Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting CommitMate tests...');

	let sandbox: tsSinon.SinonSandbox;

	// Setup and teardown for sandboxing each test to avoid side effects
	setup(() => {
		sandbox = tsSinon.createSandbox();
		moxios.install();
		
		const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		getConfigurationStub.withArgs('commitmate').returns({
			get: (key: string) => {
				if (key === 'openAiApiKey') {
					return 'dummy-api-key'; 
				}
				if (key === 'openAiModel') {
					return 'gpt-3.5-turbo';
				}
				if (key === 'openAiUrl') {
					return 'https://api.openai.com/v1/chat/completions';
				}
				if (key === 'requestPrefix') {
					return 'Here is source code diff:';
				}
				if (key === 'requestSuffix') {
					return "Generate a short or medium length commit message for these changes.";
				}
				return undefined;
			},
			has: (key: string) => true, // Dummy implementation of has method
			inspect: (key: string) => undefined, // Dummy inspect method
			update: async (key: string, value: any) => { /* Mock update method */ }
		} as vscode.WorkspaceConfiguration);
	});

	teardown(() => {
		sandbox.restore();
		moxios.uninstall(); 
	});
	
	test('Extension should be activated', async () => {
		const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
		assert.doesNotThrow(() => activate(context), 'Extension did not activate correctly.');
	});
	
	test('Should read OpenAI API key from configuration', () => {
		const config = vscode.workspace.getConfiguration('commitmate');
		const openAiApiKey = config.get<string>('openAiApiKey');
		assert.strictEqual(openAiApiKey, 'dummy-api-key', 'OpenAI API key is not being read correctly from the settings.');
	});
	
	test('Should generate commit message with dummy diff', async () => {		
		const mockStagedDiff = `
			+ Added new feature to handle API requests
			- Removed deprecated function calls
		`;
		
		try {
			moxios.wait(() => {
				const request = moxios.requests.mostRecent();
				request.respondWith({
					status: 200,
					response: {
						choices: [{
							message: { content: 'Added feature to handle API requests and removed deprecated calls' }
						}]
					}
				});
			});
			
			const commitMessage = await generateCommitMessageFromAI(mockStagedDiff);
			
			assert.strictEqual(
				commitMessage,
				'Added feature to handle API requests and removed deprecated calls',
				'Generated commit message does not match the expected format.'
			);
		} finally {
			moxios.uninstall();
		}
	});

	
});
