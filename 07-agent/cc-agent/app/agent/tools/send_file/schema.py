SEND_FILE_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Local file path to send."},
        "url": {"type": "string", "description": "Optional file URL for channels that support URLs."},
        "name": {"type": "string", "description": "Optional display file name."},
        "mime_type": {"type": "string", "description": "Optional MIME type."},
    },
    "required": ["path"],
    "additionalProperties": False,
}

