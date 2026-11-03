const targetTabId = 'DC5057A11BA7FAFEA0BB4043A7004DD5';

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
          const stopBtn = document.querySelector('button[aria-label="Stop generating"]') ||
                          document.querySelector('button[aria-label="Cancel loading"]');
          const isGenerating = !!stopBtn;

          const assistantMessages = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
          const lastMsg = assistantMessages[assistantMessages.length - 1];

          return {
            isGenerating,
            totalAssistantMsgs: assistantMessages.length,
            lastMsgText: lastMsg ? lastMsg.innerText.slice(-2500) : ''
          };
        })()`,
        returnByValue: true
      });
      console.log('ChatGPT status:', JSON.stringify(res.result.value, null, 2));
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
