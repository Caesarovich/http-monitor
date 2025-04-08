# HTTP Monitor CLI

A command-line tool to monitor HTTP and HTTPS connections to multiple addresses.

## Note

This project is made with [Bun](https://bun.sh/) and is designed to be run with the Bun runtime. It is not compatible with Node.js (I'm too lazy).

I made this little project because I needed to monitor HTTP and HTTPS responses for multiple addresses to troubleshoot a network issue. I wanted to see the status of each address in real-time, and I thought it would be nice to have a simple CLI tool for that.

I don't plan to add any more features, but if you have any suggestions or improvements, feel free to open an issue or a pull request.

For now I also don't plan to publish it to npm, but if there's enough interest, I might consider it.

## Features

- Monitor multiple URLs simultaneously
- Configurable check interval
- Live updating terminal UI with status and logs
- Color-coded status indicators

## Installation

```bash
bun install
bun link
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
- `-m, --mode <mode>`: Mode of operation (default: parallel)
	- `parallel`: Check all URLs simultaneously
	- `sequential`: Check URLs one after another
- `--help`: Show help information
- `--version`: Show version information

## Key Controls

- `Ctrl+C`: Exit the application
