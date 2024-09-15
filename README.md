# CommitMate

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://marketplace.visualstudio.com/items?itemName=commitmate.commitmate)  
**CommitMate** is a Visual Studio Code extension that helps generate concise and context-aware commit messages based on staged Git changes using OpenAI's GPT models.

## Features

- **Commit Message Generation**: Generate meaningful commit messages based on the diff of your staged Git files.
- **OpenAI GPT Integration**: Leverages OpenAI's GPT models (default `gpt-4o-mini`) to create tailored commit messages.
- **Multiple Repositories**: Works with multiple Git repositories within your workspace.
- **Customizable Messages**: Define your own request prompts for OpenAI, such as prefix and suffix for the message prompt.
- **Onboarding Process**: First-time setup guides users through setting their OpenAI API key for seamless use.

## Installation

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=commitmate.commitmate).
2. Open your VS Code workspace with a Git repository.

## Getting Started

### 1. Set Up OpenAI API Key
After installation, the extension will prompt you to enter your OpenAI API key. You can also configure this key manually:

- Go to the **Settings** panel in VS Code: `File` > `Preferences` > `Settings`.
- Search for **CommitMate**.
- Enter your OpenAI API key.

Alternatively, you can click [here](https://platform.openai.com/account/api-keys) to get your API key.

### 2. Generate a Commit Message

Once you have staged changes in your Git repository:
1. Open the **Source Control** panel.
2. Click the **Generate Commit Message (CommitMate)** button from the command palette or SCM navigation panel.
3. The extension will generate and set the commit message in the SCM input box.

### 3. Customize OpenAI Requests

You can customize the request message sent to OpenAI:
- **Prefix**: The text added before your staged changes.
- **Suffix**: The instruction given to OpenAI for generating commit messages.

You can customize these settings under:
- **Settings** > **CommitMate** > **Request Prefix** or **Request Suffix**.

## Configuration

The following configuration options are available:

| Option                         | Default Value                                                         | Description                                                                                                 |
|---------------------------------|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `commitmate.openAiApiKey`       | `""` (Required)                                                       | Your OpenAI API key.                                                                                         |
| `commitmate.openAiModel`        | `"gpt-4o-mini"`                                                     | The GPT model to use (you can set this to a custom model if desired).                                        |
| `commitmate.openAiUrl`          | `"https://api.openai.com/v1/chat/completions"`                         | The URL of the OpenAI API.                                                                                   |
| `commitmate.requestPrefix`      | `"Here is source code diff:"`                                          | Text added at the beginning of the request sent to OpenAI.                                                   |
| `commitmate.requestSuffix`      | `Generate a short or medium length commit message for these changes. Don't hallucinate, don't skip any changes, use past tense. Make sure to use past tense like word 'add' should be 'added' etc.`| Instructions sent to OpenAI to guide the generation of the commit message.                                   |

## Example Usage

### Step-by-step Instructions:

1. **Stage Changes**: Make sure you have staged your changes in the VScode.
2. **Trigger CommitMate**: Open the Command Palette in VS Code (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) and search for:

    ```
    Generate Commit Message (CommitMate)
    ```

    Alternatively, if you are in the Source Control panel, you should see the option to generate the commit message from the toolbar.

3. **View Commit Message**: CommitMate will analyze the staged changes, make an API call to OpenAI, and automatically populate the commit message input box in the Source Control panel.

4. **Commit**: Once the commit message is generated and placed in the input box, you can review and commit your changes.

## Known Issues

- **Rate Limiting**: If you make too many requests to OpenAI within a short period, you may hit rate limits, causing the commit message generation to fail. Please refer to OpenAI's [rate limit documentation](https://platform.openai.com/docs/guides/rate-limits) for more information.
  
- **Large Diffs**: For very large diffs, the API might take longer to respond or may return incomplete results. We recommend breaking large diffs into smaller commits when using CommitMate. 

## Troubleshooting

If you run into issues, try the following:

1. **API Key Issues**: Make sure you've entered the correct OpenAI API key in your settings. You can re-enter the key by navigating to:
   
2. **No Commit Message Generated**: Ensure you have staged changes before triggering the command. If no changes are staged, CommitMate will not generate a commit message.

3. **API Errors**: If you see errors related to the OpenAI API, check your internet connection and verify that your API key is correct. If you're encountering frequent API errors, you may have exceeded OpenAI's rate limits.

4. **Logging**: For debugging, logs are printed to the VS Code output console. You can view them by navigating to:

## Roadmap

Some planned features for future releases include:
- **Local AI commit generator support**
- **Commit Splitting**: Automatically suggest breaking large diffs into multiple smaller commits.

We appreciate feedback and contributions from the community! To contribute:

1. Fork the repository.
2. Create a new branch for your feature/bugfix.
3. Make your changes and commit them to your branch.
4. Open a pull request and describe the changes you made.

Before submitting a pull request, please make sure:

- All existing tests pass.
- New tests have been added for any new functionality.
- Code follows the project's coding guidelines.

To report bugs or request features, please use [GitHub Issues](https://github.com/yourusername/commitmate/issues).

## Security and Privacy

CommitMate does not store or log any of the data you enter into the extension. Your OpenAI API key is stored locally in your VS Code settings. All communication with the OpenAI API is configured to use secure HTTPS connections by default.

For more information on OpenAI's privacy policy, refer to [OpenAI Privacy Policy](https://platform.openai.com/privacy).

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/nerexis/commitmate/blob/main/LICENSE) file for details.

---

Thank you for using CommitMate! If you enjoy this extension, please consider Your feedback helps us improve and build new features!

*Created by Damian Winnicki*

If you like me work, please donate:
https://www.buymeacoffee.com/nerexis