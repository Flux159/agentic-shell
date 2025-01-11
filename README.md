# agentic-shell

Agentic Shell (AGIsh) is an experimental shell where commands are interpreted and run by a large language model (LLM).
AGIsh can be used to test and evaluate LLMs on a variety of tasks as well as used as your natural language shell.

<p align="center">
  <img width="600" src="https://raw.githubusercontent.com/Flux159/agentic-shell/refs/heads/main/agish.svg">
</p>

## Features

- [x] Command completion & directory autocomplete
- [x] History (persistent across sessions)
- [x] Use your own API keys
- [x] Agentic loop to fix commands
- [x] Pipe commands into shell to run
- [x] Mac OS & Linux shell support
- [ ] Run against multiple LLM providers (in progress)
- [ ] Windows & Powershell support (in progress)
- [ ] Support for plugins to extend agish functionality
- [ ] Run with local LLM models
- [ ] Support for .agishrc file to set default LLM provider, API keys, etc.
- [ ] MCP Server support

## Will not support

- [ ] Interactive commands (vim, nano, top, read, etc.) - these are not supported because they require stdin input and are not supported by the current version of agish. Adding proper support for these will require recreating an entire terminal emulator (or using node-pty with custom shell interceptors for every shell) in agish which is not a goal of this project.

## Installation

Download from [releases](https://github.com/Flux159/agentic-shell/releases), `chmod +x` and move to a directory in your PATH or follow one of the guides below.

## Mac OS X (Apple Silicon/ARM64)

```bash
curl -L https://github.com/Flux159/agentic-shell/releases/download/v1/agish-macos-arm64 -o agish
chmod +x agish
sudo mv agish /usr/local/bin/ # Or move to any other directory in your PATH
```

## Mac OS X (Intel/x64)

```bash
curl -L https://github.com/Flux159/agentic-shell/releases/download/v1/agish-macos-x64 -o agish
chmod +x agish
sudo mv agish /usr/local/bin/ # Or move to any other directory in your PATH
```

## Linux (x64)

```bash
curl -L https://github.com/Flux159/agentic-shell/releases/download/v1/agish-linux-x64 -o agish
chmod +x agish
sudo mv agish /usr/local/bin/ # Or move to any other directory in your PATH
```

# Development

```
git clone https://github.com/Flux159/agentic-shell.git
cd agentic-shell
npm install
cp .env.local.example .env.local
# Update .env.local with your API keys
npm run dev
```

# Building

```
npm run build
```

# Usage

In your shell, make sure you have the following environment variable is set.

Get an Anthropic API Key from https://console.anthropic.com/settings/keys (see this guide for more: https://docs.anthropic.com/en/api/getting-started).

```bash
export ANTHROPIC_API_KEY="abcd"
```

### Environment Variables

- `ANTHROPIC_API_KEY` - Required. Your Anthropic API key
- `DEBUG` - Optional. Set to any value to enable debug logging

```bash
$ agish
> list files in the current directory
```

Special commands:

- `/help` - Show help text
- `/history` - Show command history
- `/exit` or `/quit` - Exit the shell
- Up / Down arrows to navigate command history (will load history from previous sessions as well)

Piping commands to agish:

```bash
echo "list files in the current directory" | agish
```

Piping with heredoc:

```bash
cat << EOF | agish
list files in the current directory
zip the files in this directory into dist.zip
EOF
```

Build up a directory of test suites for LLMs in a directory & run all of them against agish:

```bash
find tests/ -type f -exec agish < {} \;
```

### License

[MIT License](https://github.com/Flux159/agentic-shell/blob/main/LICENSE)
