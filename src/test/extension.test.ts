import * as assert from 'assert';
import * as vscode from 'vscode';
import moxios from 'moxios';
import tsSinon from 'ts-sinon';
import { activate, generateCommitMessageFromAI } from '../extension';

suite('CommitMate Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting CommitMate tests...');

	let sandbox: tsSinon.SinonSandbox;

	setup(() => {
		sandbox = tsSinon.createSandbox();
		moxios.install();
	});

	teardown(() => {
		sandbox.restore();
		moxios.uninstall();
	});

	function stubCommitMateConfiguration(overrides: Record<string, unknown> = {}) {
		const values: Record<string, unknown> = {
			openAiApiKey: 'dummy-api-key',
			openAiModel: 'gpt-5.4-nano',
			openAiCustomModel: '',
			openAiUrl: 'https://api.openai.com/v1/responses',
			openAiTemperatureEnabled: false,
			openAiTemperature: 0.4,
			openAiReasoningEffortEnabled: true,
			openAiReasoningEffort: 'none',
			openAiReasoningSummary: 'null',
			openAiVerbosityEnabled: true,
			openAiVerbosity: 'low',
			requestPrefix: 'Here is source code diff:',
			requestSuffix: 'Generate a short or medium length commit message for these changes.'
		};

		const config = {
			get: <T>(key: string, fallback?: T) => {
				if (Object.prototype.hasOwnProperty.call(overrides, key)) {
					return overrides[key] as T;
				}
				if (Object.prototype.hasOwnProperty.call(values, key)) {
					return values[key] as T;
				}
				return fallback as T;
			},
			has: () => true,
			inspect: () => undefined,
			update: async () => undefined
		} as vscode.WorkspaceConfiguration;

		sandbox.stub(vscode.workspace, 'getConfiguration').withArgs('commitmate').returns(config);
	}

	test('Extension should be activated', async () => {
		const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
		assert.doesNotThrow(() => activate(context), 'Extension did not activate correctly.');
	});

	test('Should read OpenAI API key from configuration', () => {
		stubCommitMateConfiguration();
		const config = vscode.workspace.getConfiguration('commitmate');
		const openAiApiKey = config.get<string>('openAiApiKey');
		assert.strictEqual(openAiApiKey, 'dummy-api-key', 'OpenAI API key is not being read correctly from the settings.');
	});

	test('Should generate commit message with gpt-5.4-mini via the Responses API', async () => {
		stubCommitMateConfiguration({
			openAiModel: 'gpt-5.4-mini'
		});

		const mockStagedDiff = `
			+ Added new feature to handle API requests
			- Removed deprecated function calls
		`;

		const requestPromise = new Promise<void>((resolve) => {
			moxios.wait(async () => {
				const request = moxios.requests.mostRecent();
				const payload = JSON.parse(request.config.data);

				assert.strictEqual(payload.model, 'gpt-5.4-mini');
				assert.deepStrictEqual(payload.reasoning, { effort: 'none', summary: null });
				assert.deepStrictEqual(payload.text, { verbosity: 'low' });
				assert.strictEqual(payload.temperature, undefined);

				await request.respondWith({
					status: 200,
					response: {
						model: 'gpt-5.4-mini',
						output_text: 'Added feature to handle API requests and removed deprecated calls'
					}
				});

				resolve();
			});
		});

		const commitMessage = await generateCommitMessageFromAI(mockStagedDiff);
		await requestPromise;

		assert.strictEqual(
			commitMessage,
			'Added feature to handle API requests and removed deprecated calls',
			'Generated commit message does not match the expected format.'
		);
	});

	test('Should allow xhigh reasoning effort for gpt-5.4-nano', async () => {
		stubCommitMateConfiguration({
			openAiModel: 'gpt-5.4-nano',
			openAiReasoningEffort: 'xhigh',
			openAiVerbosityEnabled: false
		});

		const requestPromise = new Promise<void>((resolve) => {
			moxios.wait(async () => {
				const request = moxios.requests.mostRecent();
				const payload = JSON.parse(request.config.data);

				assert.deepStrictEqual(payload.reasoning, { effort: 'xhigh', summary: null });

				await request.respondWith({
					status: 200,
					response: {
						model: 'gpt-5.4-nano',
						output_text: 'Adjusted commit message generation settings'
					}
				});

				resolve();
			});
		});

		const commitMessage = await generateCommitMessageFromAI('diff');
		await requestPromise;

		assert.strictEqual(commitMessage, 'Adjusted commit message generation settings');
	});
});
