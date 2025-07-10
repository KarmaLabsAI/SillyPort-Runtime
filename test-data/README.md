# Test Resources

This directory contains test resources copied from the SillyTavern repository for development and testing purposes.

## Directory Structure

```
test-data/
├── config/
│   ├── server-config.yaml      # Server configuration example
│   └── client-settings.json    # Client settings example
├── presets/
│   ├── context/               # Context preset files
│   └── instruct/              # Instruction preset files
├── characters/
│   ├── default_Seraphina.png  # Default character card
│   └── Seraphina/             # Character emotion sprites
├── assets/
│   ├── user-default.png       # Default user avatar
│   ├── world-info-example.json # World info example
│   ├── Char_Avatar_Comfy_Workflow.json
│   └── Default_Comfy_Workflow.json
└── README.md
```

## Resource Types

### Configuration Files
- `server-config.yaml`: Complete server configuration with all settings
- `client-settings.json`: Complete client settings with UI preferences and API configurations

### Character Resources
- `default_Seraphina.png`: Character Card V2 with embedded metadata (539KB)
- `Seraphina/`: Directory containing 28 emotion sprites for the character

### Preset Files
- `context/`: Various context templates for different AI models
- `instruct/`: Instruction templates for different formats (Alpaca, ChatML, etc.)

### Assets
- `user-default.png`: Default user avatar
- `world-info-example.json`: Example world info/lorebook structure
- Workflow templates for ComfyUI integration

## Usage

These resources are used for:
- Unit testing character card parsing
- Testing configuration handling
- Validating preset loading
- Testing asset management
- Performance testing with realistic data

## Notes

- All files maintain their original structure and metadata
- Character cards include proper V2 metadata for testing
- Preset files cover multiple AI model formats
- Resources are organized for easy integration into test suites 