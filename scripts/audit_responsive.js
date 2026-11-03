// Audit responsive layout on http://localhost:5173/
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
      const viewports = [
        { name: 'Mobile (iPhone X / 12)', width: 375, height: 812, isMobile: true },
        { name: 'Tablet (iPad Mini / Air)', width: 768, height: 1024, isMobile: true },
        { name: 'Desktop (Laptop)', width: 1280, height: 800, isMobile: false }
      ];

      const results = [];

      for (const vp of viewports) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 2,
          mobile: vp.isMobile
        });

        await new Promise(r => setTimeout(r, 600));

        const metrics = await send('Runtime.evaluate', {
          expression: `(() => {
            const body = document.body;
            const doc = document.documentElement;
            const scrollWidth = Math.max(body.scrollWidth, doc.scrollWidth);
            const clientWidth = doc.clientWidth;
            const hasHorizontalScroll = scrollWidth > clientWidth;

            // Check for elements exceeding viewport width
            const overflowingElements = [];
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > clientWidth + 2 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
                overflowingElements.push({
                  tag: el.tagName,
                  className: (el.className || '').toString().slice(0, 40),
                  right: Math.round(rect.right),
                  width: Math.round(rect.width)
                });
                if (overflowingElements.length >= 5) break;
              }
            }

            // Check navigation visibility
            const mobileNav = document.querySelector('nav.fixed.bottom-0');
            const desktopSidebar = document.querySelector('aside');
            const mobileNavVisible = mobileNav ? window.getComputedStyle(mobileNav).display !== 'none' : false;
            const sidebarVisible = desktopSidebar ? window.getComputedStyle(desktopSidebar).display !== 'none' : false;

            return {
              clientWidth,
              scrollWidth,
              hasHorizontalScroll,
              overflowCount: overflowingElements.length,
              overflowingElements,
              mobileNavVisible,
              sidebarVisible
            };
          })()`,
          returnByValue: true
        });

        results.push({
          viewport: vp.name,
          ...metrics.result.value
        });
      }

      // Reset emulation
      await send('Emulation.clearDeviceMetricsOverride');
      console.log(JSON.stringify(results, null, 2));

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
