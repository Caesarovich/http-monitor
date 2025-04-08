# HTTP Monitor CLI

A command-line tool to monitor HTTP and HTTPS connections to multiple addresses.

## Features

- Monitor multiple URLs simultaneously
- Configurable check interval
- Live updating terminal UI with status and logs
- Color-coded status indicators

## Installation

```bash
npm install
npm run build
npm link # Optional, to make the command globally available
```

## Usage

```bash
# Basic usage with default interval (10 seconds)
http-monitor example.com google.com

# With custom interval (5 seconds)
http-monitor --interval 5 example.com google.com

# With Sequential mode
http-monitor --mode sequential example.com google.com

# With help option
http-monitor --help

# With version option
http-monitor --version
```

## Commands and Options

- `<urls...>`: One or more URLs to monitor
- `-i, --interval <seconds>`: Interval between checks in seconds (default: 10)
- `-h, --help`: Show help information
- `-V, --version`: Show version information

## Key Controls

- `Ctrl+C`: Exit the application
