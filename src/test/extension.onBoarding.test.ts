import assert from 'assert'; 
import * as vscode from 'vscode';

import * as sinon from "ts-sinon";
import tsSinon from 'ts-sinon';
import { checkOnboarding } from '../extension'; // Adjust the import path

suite('CommitMate Onboarding Test Suite', () => {
  vscode.window.showInformationMessage('Starting CommitMate onboarding tests...');

  let sandbox: tsSinon.SinonSandbox;

  // Setup and teardown for sandboxing each test to avoid side effects
  setup(() => {
    sandbox = tsSinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('Should prompt for OpenAI API key during onboarding when key is missing', async () => {
    const context = {
      globalState: {
        get: sandbox.stub().withArgs('onboardingComplete').returns(false),
        update: sandbox.stub().resolves(),
      }
    } as unknown as vscode.ExtensionContext;

    // Properly mock the WorkspaceConfiguration
    const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
    getConfigurationStub.withArgs('commitmate').returns({
      get: (key: string) => {
        if (key === 'openAiApiKey') {
          return undefined;
        }
        return undefined;
      },
      has: (key: string) => true,
      inspect: () => undefined,
      update: async (key: string, value: any) => { return Promise.resolve(); },
    } as unknown as vscode.WorkspaceConfiguration);

    // Properly mock MessageItems
    const setupAction: vscode.MessageItem = { title: 'Set up OpenAI API Key' };
    const skipAction: vscode.MessageItem = { title: 'Skip' };

    const showMessageStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(setupAction as vscode.MessageItem);

    // Call the onboarding function
    await checkOnboarding(context);

    // Assert that the prompt was shown
    assert.strictEqual(showMessageStub.calledOnce, true, 'Onboarding prompt was not shown');
    
    showMessageStub.calledWith(
        'Welcome to CommitMate! To generate commit messages, you need to configure your OpenAI API key.'        
      );            
  });

  test('Should skip onboarding if OpenAI API key is already set', async () => {
    const context = {
      globalState: {
        get: sandbox.stub().withArgs('onboardingComplete').returns(true),
        update: sandbox.stub().resolves(),
      }
    } as unknown as vscode.ExtensionContext;

    // Properly mock the WorkspaceConfiguration
    const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
    getConfigurationStub.withArgs('commitmate').returns({
      get: (key: string) => {
        if (key === 'openAiApiKey') {
          return 'dummy-api-key';
        }
        return undefined;
      },
      has: (key: string) => true,
      inspect: () => undefined,
      update: async (key: string, value: any) => { return Promise.resolve(); },
    } as unknown as vscode.WorkspaceConfiguration);

    // Call onboarding function
    await checkOnboarding(context);

    // Assert that the prompt was not shown
    const showMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
    assert.strictEqual(showMessageStub.notCalled, true, 'Onboarding prompt should not be shown if API key is set');    
  });
});
