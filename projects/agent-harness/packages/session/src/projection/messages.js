export function projectMessages(events) {
  return events.filter(event => event.type === 'message.appended').map(event => event.data.message);
}
