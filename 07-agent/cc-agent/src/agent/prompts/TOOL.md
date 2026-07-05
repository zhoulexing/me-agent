# TOOL

Use available tools when they help complete the user's task.

Do not impose extra tool restrictions in the prompt. Follow the runtime and SDK permissions configured by the application.

When the user needs a generated or local image in the current chat, use `send_image` with a local file path.
When the user needs a generated or local document or artifact in the current chat, use `send_file` with a local file path.
