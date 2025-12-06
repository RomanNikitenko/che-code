# Allowed Extensions Policy

Che-Code supports reading an allowed extensions policy from a file on the filesystem where the server is started. This allows administrators to control which extensions can be installed and used.

## Usage

Start the server with the `--allowed-extensions-policy-file` argument:

```bash
./code-server --allowed-extensions-policy-file /path/to/policy.json
```

The path can be either absolute or relative to the current working directory where the server is started.

## Policy File Format

The policy file must be a valid JSON file containing a policy object with the `AllowedExtensions` key. The value should match the format of the `extensions.allowed` configuration setting.

### Example: Allow All Extensions

```json
{
	"AllowedExtensions": {
		"*": true
	}
}
```

### Example: Allow Specific Extensions

```json
{
	"AllowedExtensions": {
		"ms-python.python": true,
		"ms-vscode.vscode-typescript-next": true,
		"redhat.java": true
	}
}
```

### Example: Allow Only Stable Versions

```json
{
	"AllowedExtensions": {
		"ms-python.python": "stable",
		"ms-vscode.vscode-typescript-next": true
	}
}
```

### Example: Allow Specific Versions

```json
{
	"AllowedExtensions": {
		"ms-python.python": ["1.2.3", "linux-x64@1.2.4"],
		"ms-vscode.vscode-typescript-next": true
	}
}
```

### Example: Allow All Extensions from a Publisher

```json
{
	"AllowedExtensions": {
		"ms-python": true,
		"ms-vscode": true
	}
}
```

### Example: Deny All Extensions

```json
{
	"AllowedExtensions": {
		"*": false
	}
}
```

## Policy File Location

The policy file should be placed in a location accessible to the server process. Common locations:

- `/etc/che-code/policy.json` (system-wide)
- `/opt/che-code/policy.json` (installation directory)
- `./policy.json` (current working directory)

## How It Works

1. When the server starts, it reads the policy file specified by `--allowed-extensions-policy-file`
2. The policy file is parsed and the `AllowedExtensions` policy is extracted
3. The policy is applied to the `extensions.allowed` configuration setting
4. The `AllowedExtensionsService` enforces the policy when extensions are installed or used
5. If the policy file changes, the server will automatically reload the policy (with a 500ms delay)

## Notes

- The policy file must be valid JSON
- If the file doesn't exist or cannot be read, the server will log an error but continue to start
- The policy takes precedence over user settings
- The policy file is watched for changes and will be reloaded automatically


