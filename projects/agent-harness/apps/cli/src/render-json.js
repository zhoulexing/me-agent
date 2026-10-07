export function createJsonRenderer(output = process.stdout) {
  const write = value => output.write(`${JSON.stringify(value)}\n`);
  return {
    onEvent(event) {
      if (event.type === 'turn.started') write({ type: 'session', sessionId: event.data.sessionId });
      else if (event.type === 'text.delta') write({ type: 'text_delta', text: event.text, provisional: true });
      else if (event.type === 'tool.started') write({ type: 'tool_call', callId: event.data.callId,
        name: event.data.name, arguments: event.data.arguments });
      else if (event.type === 'message.appended' && event.data.message.role === 'tool') {
        const message = event.data.message;
        write({ type: 'tool_result', callId: message.callId, name: message.name,
          isError: message.isError, content: message.content });
      } else if (event.type.startsWith('turn.') && event.type !== 'turn.started') {
        write({ type: 'status', status: event.type, data: event.data });
      }
    },
    final(result) { write({ type: 'final', sessionId: result.sessionId, text: result.finalText }); },
    error(error) { write({ type: 'error', code: error.code ?? 'ERROR', message: error.message }); },
  };
}
