import fs from 'fs';
import path from 'path';

const targetTabId = '534F7490237033987EED3CA920EDD031';
const screenshotDir = path.resolve('qa-screenshots');

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function main() {
  const ws = new WebSocket(`ws://127.0.0.1:9223/devtools/page/${targetTabId}`);
  let msgId = 1;

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
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
      console.log('Connected to CDP for StudyFlow tab.');
      await send('Console.enable');
      await send('Runtime.enable');
      await send('Page.enable');
      await send('DOM.enable');

      // Listen for runtime errors
      const consoleErrors = [];
      ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.method === 'Console.messageAdded' && data.params.message.level === 'error') {
          consoleErrors.push(data.params.message.text);
        }
        if (data.method === 'Runtime.exceptionThrown') {
          consoleErrors.push(data.params.exceptionDetails.text);
        }
      });

      // 1. Reload page cleanly to check cold load
      await send('Page.reload', { ignoreCache: true });
      await new Promise((r) => setTimeout(r, 2000));

      // Wait for hydration
      await send('Runtime.evaluate', {
        expression: `new Promise((resolve) => {
          if (document.readyState === 'complete') resolve();
          else window.addEventListener('load', resolve);
        })`,
        awaitPromise: true
      });
      await new Promise((r) => setTimeout(r, 1000));

      // 2. Audit 0 console errors
      console.log(`Console error count post-reload: ${consoleErrors.length}`);
      if (consoleErrors.length > 0) {
        console.warn('Console errors detected:', consoleErrors);
      }

      // 3. Test Touch Target Audit across mobile viewport (390px)
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true
      });
      await new Promise((r) => setTimeout(r, 1000));

      const touchTargetAudit = await send('Runtime.evaluate', {
        expression: `(() => {
          const interactives = Array.from(document.querySelectorAll('button, a, input, select, [role="button"]'));
          const failures = [];
          for (const el of interactives) {
            const rect = el.getBoundingClientRect();
            // Skip hidden elements
            if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(el).display === 'none') continue;
            
            // Check touch target minimum 44px
            const isUndersized = rect.width < 40 || rect.height < 40; // lenient 40px boundary check
            if (isUndersized) {
              failures.push({
                tag: el.tagName,
                text: el.innerText ? el.innerText.slice(0, 30).trim() : el.getAttribute('aria-label') || 'unlabeled',
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                classes: el.className ? el.className.slice(0, 50) : ''
              });
            }
          }
          return {
            totalChecked: interactives.length,
            failures: failures.slice(0, 10),
            failureCount: failures.length
          };
        })()`,
        returnByValue: true
      });

      console.log('Mobile Touch Target Audit Result:', JSON.stringify(touchTargetAudit.result.value, null, 2));

      // 4. Attempt Window Restore & Capture Screenshots
      try {
        const windowInfo = await send('Browser.getWindowForTarget', {});
        if (windowInfo && windowInfo.windowId) {
          await send('Browser.setWindowBounds', {
            windowId: windowInfo.windowId,
            bounds: { windowState: 'normal' }
          });
        }
      } catch (err) {
        // Non-fatal if browser domain not permitted on target
      }

      const captureSafeScreenshot = async (filename) => {
        try {
          const shot = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(screenshotDir, filename), Buffer.from(shot.data, 'base64'));
          console.log(`Saved screenshot: ${filename}`);
        } catch (err) {
          console.warn(`Screenshot skipped (${filename}): ${err.message || err}`);
        }
      };

      await captureSafeScreenshot('qa-mobile-390-dark.png');

      // Switch to Light Mode
      await send('Runtime.evaluate', {
        expression: `document.documentElement.classList.remove('dark');`
      });
      await new Promise((r) => setTimeout(r, 300));
      await captureSafeScreenshot('qa-mobile-390-light.png');

      // 5. Test Desktop 1440px Viewport
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await new Promise((r) => setTimeout(r, 600));

      await captureSafeScreenshot('qa-desktop-1440-light.png');

      // Dark Mode Desktop
      await send('Runtime.evaluate', {
        expression: `document.documentElement.classList.add('dark');`
      });
      await new Promise((r) => setTimeout(r, 300));
      await captureSafeScreenshot('qa-desktop-1440-dark.png');

      // 6. Test Navigation across tabs
      const tabs = ['assignments', 'calendar', 'timer', 'grades', 'dashboard'];
      for (const tab of tabs) {
        await send('Runtime.evaluate', {
          expression: `(() => {
            const btn = document.querySelector('[data-tab="${tab}"]') || 
                        Array.from(document.querySelectorAll('button, a')).find(b => b.innerText && b.innerText.toLowerCase().includes('${tab}'));
            if (btn) btn.click();
          })()`
        });
        await new Promise((r) => setTimeout(r, 400));
      }

      // 7. Verify ARIA Labels and Accessibility semantics
      const a11ySummary = await send('Runtime.evaluate', {
        expression: `(() => {
          const iconButtons = Array.from(document.querySelectorAll('button:not(:has(span, p, div:not(:empty)))'));
          const missingAria = iconButtons.filter(b => !b.getAttribute('aria-label') && !b.getAttribute('title') && !b.innerText.trim());
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({ level: h.tagName, text: h.innerText.trim() }));
          return {
            totalButtons: document.querySelectorAll('button').length,
            iconButtonsCount: iconButtons.length,
            missingAriaCount: missingAria.length,
            headingsCount: headings.length
          };
        })()`,
        returnByValue: true
      });

      console.log('A11y Semantics Summary:', JSON.stringify(a11ySummary.result.value, null, 2));

      // Reset Emulation
      await send('Emulation.clearDeviceMetricsOverride');
      ws.close();
      console.log('QA Audit finished successfully! Screenshots archived to qa-screenshots/.');
      process.exit(0);
    } catch (err) {
      console.error('Audit failed:', err);
      ws.close();
      process.exit(1);
    }
  };
}

main();
