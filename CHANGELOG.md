# Change Log

All notable changes to the "commitmate" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- None

## [0.0.8] - 2026-04-12

- Add support for `gpt-5.4`, `gpt-5.4-mini`, and `gpt-5.4-nano` model selection.
- Remove legacy non-5.4 built-in model options and focus the extension on the GPT-5.4 family.
- Set the default OpenAI model to `gpt-5.4-nano` across configuration, runtime fallback, and documentation.
- Update `gpt-5.4`, `gpt-5.4-mini`, and `gpt-5.4-nano` reasoning support to `none`, `low`, `medium`, `high`, and `xhigh`.
- Change the default reasoning effort to `none` so it is compatible with the default model.
- Add a new Marketplace icon with highlighted `AI` branding.

## [0.0.7] - 2026-01-31

- Trim whitespace for string settings before use.

## [0.0.6] - 2026-01-31

- Fall back to the first staged change when no active repository is detected.
- Centralize repeated user/log messages into constants.

## [0.0.5] - 2026-01-31

- Switch OpenAI integration to the Responses API by default.
- Add GPT-5 model selection with custom model support.
- Add configuration for temperature, reasoning effort, reasoning summary, and verbosity.
- Improve OpenAI error logging and response handling.
