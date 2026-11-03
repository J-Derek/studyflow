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
          const cancelBtn = document.querySelector('button[aria-label="Cancel loading"]') || 
                            document.querySelector('button[aria-label="Stop generating"]');
          
          // Get all elements with markdown content
          const markdowns = Array.from(document.querySelectorAll('.markdown'));
          const lastMarkdown = markdowns[markdowns.length - 1];

          return {
            isGenerating: !!cancelBtn,
            markdownBlocksCount: markdowns.length,
            lastMarkdownText: lastMarkdown ? lastMarkdown.innerText : ''
          };
        })()`,
        returnByValue: true
      });
      console.log('Result:', JSON.stringify(res.result.value, null, 2));
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
