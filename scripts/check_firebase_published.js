const targetTabId = '6E75243B8BDA1B75CBD4E0163367E97F';

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
      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const bodyText = document.body.innerText;
          const hasRulesVersion = bodyText.includes('rules_version');
          const hasSubtasks = bodyText.includes('subtasks.size() <= 100');
          const publishBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Publish');
          
          return {
            hasRulesVersion,
            hasSubtasks,
            publishDisabled: publishBtn ? publishBtn.disabled : null,
            publishedStatusText: bodyText.includes('Published') || bodyText.includes('rules published')
          };
        })()`,
        returnByValue: true
      });
      console.log('Firebase Rules Tab DOM State:', res.result.value);
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
