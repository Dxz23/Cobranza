let logs = [];
const MAX_LOGS = 500;

export function addLog(entry) {
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export function clearLogs() {
  logs = [];
}

export function getLogs() {
  return logs;
}
