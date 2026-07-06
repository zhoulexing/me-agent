from claude_agent_sdk import create_sdk_mcp_server

from app.agent.model import AgentRunContext
from app.agent.tools.send_file import create_send_file_tool
from app.agent.tools.send_image import create_send_image_tool


def create_channel_mcp(context: AgentRunContext):
    return create_sdk_mcp_server(
        name="cc-agent-channel",
        version="0.1.0",
        tools=[
            create_send_image_tool(context),
            create_send_file_tool(context),
        ],
    )
