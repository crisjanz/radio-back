# Radio Station Scripts

This directory contains utility scripts for managing radio station data.

## auto-fill-frequency.js

Automatically detects and fills the frequency field for radio stations that have obvious AM/FM frequency patterns in their names.

### Usage

```bash
# Always start with a dry-run to review changes
node scripts/auto-fill-frequency.js --dry-run

# Process a limited number of stations for testing
node scripts/auto-fill-frequency.js --dry-run --limit=50

# Apply the changes (after reviewing with dry-run)
node scripts/auto-fill-frequency.js

# Show help
node scripts/auto-fill-frequency.js --help
```

### Features

- **Smart Detection**: Recognizes various frequency formats in station names
  - FM: `101.5`, `95.7 FM`, `FM 103.7`, `Power 96.1`, etc.
  - AM: `1010`, `AM 770`, `TALK 1480`, `CKNW 980`, etc.

- **Validation**: Only processes frequencies within valid ranges
  - FM: 87.5 - 108.0 MHz
  - AM: 530 - 1700 kHz

- **Confidence Scoring**: Only updates stations with ≥70% confidence
  - Higher confidence for explicit "FM"/"AM" mentions
  - Lower confidence for edge cases or unusual frequencies

- **Safe Operation**: 
  - Dry-run mode to preview changes
  - Built-in tests to verify detection logic
  - Detailed logging of all operations

### Examples

**Input Station Names → Detected Frequencies:**
- `"101.5 The Bear"` → `"101.5 FM"`
- `"CKNW 980"` → `"AM 980"`
- `"Power 96.1"` → `"96.1 FM"`
- `"AM 1010"` → `"AM 1010"`
- `"Talk Radio 770"` → `"AM 770"`

**Stations that won't be processed:**
- `"BBC Radio 1"` (no frequency pattern)
- `"Spotify Music"` (not a radio frequency)
- `"101.1.5 FM"` (invalid format)
- `"AM 2000"` (outside valid range)

### Safety Notes

⚠️ **Always run with `--dry-run` first** to review what changes will be made.

The script will:
- Only update stations that currently have empty/null frequency fields
- Preserve existing frequency data
- Show detailed information about each detection
- Provide confidence scores for transparency

### Integration

This script works with the transmission type detection system:
- Uses the same `frequency` field that powers AM/FM/NET filtering
- Follows the same format conventions (`"101.5 FM"`, `"AM 1010"`, `"NET"`)
- Integrates seamlessly with the Browse All page filters

### Troubleshooting

If the script fails:

1. **Database Connection Issues**: Ensure your `.env` file has correct database credentials
2. **Permission Issues**: Make sure the script is executable: `chmod +x scripts/auto-fill-frequency.js`
3. **Test Failures**: The script runs built-in tests first - if they fail, the detection logic needs review

For questions or issues, check the console output which provides detailed information about each operation.