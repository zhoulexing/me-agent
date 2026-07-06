SEND_IMAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Local image file path to send."},
        "url": {"type": "string", "description": "Optional image URL for channels that support URLs."},
        "alt": {"type": "string", "description": "Optional image alt text."},
    },
    "required": ["path"],
    "additionalProperties": False,
}

