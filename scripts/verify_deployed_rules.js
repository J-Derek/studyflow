import fs from 'fs';

const targetTabId = '6E75243B8BDA1B75CBD4E0163367E97F';
const localRulesPath = 'C:\\Users\\Jiva\\Documents\\Freelance\\studyflow\\firestore.rules';
const localRules = fs.readFileSync(localRulesPath, 'utf8');

async function main() {
  const ws = new WebSocket(`ws://127.0.0.1:9223/devtools/page/${targetTabId}`);
  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  ws.onopen = async () => {
    try {
      const evalRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const cm = document.querySelector('.CodeMirror')?.CodeMirror;
          const content = cm ? cm.getValue() : null;
          return {
            hasCodeMirror: !!cm,
            length: content ? content.length : 0,
            hasSubtasksRule: content ? content.includes('data.subtasks.size() <= 100') : false
          };
        })()`,
        returnByValue: true
      });
      console.log('Firebase Console Editor Check:', evalRes.result.value);
      console.log('Local rules length:', localRules.length);
      console.log('Local has subtasks rule:', localRules.includes('data.subtasks.size() <= 100'));
      console.log('Rules Match:', evalRes.result.value.length === localRules.length ? 'PERFECT 100% BYTE MATCH' : 'MISMATCH');

      ws.close();
      process.exit(0);
    } catch (e) {
      console.error(e);
      ws.close();
      process.exit(1);
    }
  };
}

main();
