# ilya

See exactly what your MCP client sends and your server responds.

A transparent stdio proxy that sits between any MCP client (Cursor, Claude Desktop, Claude Code) and any MCP server, logging every JSON-RPC message so you can actually see what's happening.

```
Cursor / Claude Desktop / Claude Code
    │
    │ ←────────── spawns (thinks this IS the MCP server)
    ▼
┌───────────┐
│  ilya  │  ←─ logs every message
└───────────┘
    │
    │ ←────────── spawns the real server
    ▼
┌────────────────────┐
│  actual MCP server │
└────────────────────┘
```

## Why

When Cursor or Claude Desktop spawns an MCP server, it owns the child process. All stdio communication is invisible. There's no terminal, no logs, no way to see what the AI is asking or what the server responds with.

`ilya` fixes that. Zero dependencies, zero config. Just prefix your command.

<!-- TODO: terminal recording gif -->

## Install

```bash
npm install -g ilya
```

Or use directly with npx:

```bash
npx ilya node ./my-server.js
```

## Usage

Prefix your MCP server command with `ilya`:

```bash
ilya node ./my-server.js
ilya python ./server.py
ilya npx ts-node ./server.ts
ilya ./my-binary --flag
```

Logs are written to `~/.ilya/logs/<server>-<pid>.log` by default. The log path is printed to stderr on startup.

### Flags

```
--log, -l <path>    Write logs to a specific file
--port, -p <port>   Start an HTTP server to stream logs in real time
--help, -h          Show help
--version, -v       Show version
```

### Integration with MCP clients

In your MCP client config, just wrap the command with `npx ilya`:

**Cursor / Claude Desktop (`mcp.json` or settings):**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["ilya", "node", "./my-server.js"]
    }
  }
}
```

**Claude Code (`.mcp.json`):**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["ilya", "node", "./my-server.js"]
    }
  }
}
```

Then stream logs in a separate terminal:

```bash
ilya watch
```

Or tail the log file directly:

```bash
tail -f ~/.ilya/logs/node-*.log
```

Or use `--port` to stream logs over HTTP:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["ilya", "--port", "3456", "node", "./my-server.js"]
    }
  }
}
```

```bash
curl http://localhost:3456
```

## Example output

```
12:34:56.100 → CLIENT  notification  notifications/initialized
12:34:56.200 → CLIENT  request  initialize  #1
    {"protocolVersion":"2024-11-05","capabilities":{}}
12:34:56.250 ← SERVER  response  initialize  #1  50ms
    my-server v1.0.0  capabilities: tools, resources
12:34:56.300 → CLIENT  request  tools/list  #2
12:34:56.310 ← SERVER  response  tools/list  #2  10ms
    (5 tools: get_overview, analyze_error, search_logs, get_config, restart)
12:34:56.500 → CLIENT  request  tools/call  get_overview  #3
    {
      "query": "why is my app slow"
    }
12:34:57.100 ← SERVER  response  tools/call  #3  600ms
    [text] Found 3 sessions with performance issues...
```

Errors are clearly highlighted:

```
12:34:57.456 ← SERVER  ERROR  (tools/call #3)  12ms
    [-32601] Method not found
```

Server stderr is forwarded with a prefix:

```
[server stderr] Listening on stdio
[server stderr] Connected to database
```

## Watching logs

Stream live MCP traffic in your terminal with colors:

```bash
ilya watch
```

This auto-detects the latest log file in `~/.ilya/logs/` and streams it. When Claude Code restarts and creates a new log, `ilya watch` automatically switches to it.

Options:

```
--dir <path>     Custom log directory (default: ~/.ilya/logs/)
--file <path>    Watch a specific file
--no-color       Disable colors
```

## How it works

1. Your MCP client spawns `ilya` instead of the real server
2. `ilya` spawns the real server as a child process
3. Every stdin line from the client is logged and forwarded to the server
4. Every stdout line from the server is logged and forwarded to the client
5. Messages are never modified, delayed, or buffered — fully transparent
6. Logs go to a file (and optionally stderr/HTTP) so they never interfere with the stdio protocol

## Works with everything

Any MCP server in any language. If it speaks JSON-RPC over stdio, `ilya` can log it.

## License

MIT
