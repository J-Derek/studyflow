// Wait for Claude to finish generating and print response
const targetTabId = '2FB10A8721090994FBC5AF9B684B24C2';

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
      console.log('Waiting for Claude to finish generating...');
      let isGenerating = true;
      let iterations = 0;

      while (isGenerating && iterations < 30) {
        iterations++;
        await new Promise(r => setTimeout(r, 4000));
        const statusRes = await send('Runtime.evaluate', {
          expression: `(() => {
            const stopBtn = document.querySelector('button[aria-label="Stop response"]');
            return { generating: !!stopBtn };
          })()`,
          returnByValue: true
        });

        isGenerating = statusRes.result.value.generating;
        if (isGenerating) {
          process.stdout.write('.');
        }
      }

      console.log('\nGeneration complete! Fetching Claude response...');

      const responseRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const claudeMsgs = Array.from(document.querySelectorAll('.font-claude-message, .standard-markdown'));
          if (claudeMsgs.length > 0) {
            return claudeMsgs[claudeMsgs.length - 1].innerText;
          }
          return 'No message found';
        })()`,
        returnByValue: true
      });

      console.log('\n=== CLAUDE RESPONSE ===\n');
      console.log(responseRes.result.value);

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
