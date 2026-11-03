// Audit all routes on mobile
const targetTabId = '956DF0401AC3BC4CC78AB809AEE57BA0';

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
      await send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 812,
        deviceScaleFactor: 2,
        mobile: true
      });

      const routes = ['/', '/assignments', '/calendar', '/focus'];
      const routeResults = [];

      for (const route of routes) {
        // Navigate by evaluating window.history.pushState and triggering popstate/render or finding nav link
        await send('Runtime.evaluate', {
          expression: `(() => {
            window.history.pushState({}, '', '${route}');
            window.dispatchEvent(new PopStateEvent('popstate'));
          })()`
        });

        await new Promise(r => setTimeout(r, 600));

        const res = await send('Runtime.evaluate', {
          expression: `(() => {
            const body = document.body;
            const doc = document.documentElement;
            const scrollWidth = Math.max(body.scrollWidth, doc.scrollWidth);
            const clientWidth = doc.clientWidth;
            const hasHorizontalScroll = scrollWidth > clientWidth;
            
            const overflowing = [];
            document.querySelectorAll('*').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.right > clientWidth + 2 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
                overflowing.push({ tag: el.tagName, class: (el.className || '').toString().slice(0, 40) });
              }
            });

            return {
              url: location.pathname,
              clientWidth,
              scrollWidth,
              hasHorizontalScroll,
              overflowCount: overflowing.length,
              sampleOverflows: overflowing.slice(0, 3)
            };
          })()`,
          returnByValue: true
        });

        routeResults.push(res.result.value);
      }

      await send('Emulation.clearDeviceMetricsOverride');
      console.log(JSON.stringify(routeResults, null, 2));

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
