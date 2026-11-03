import fs from 'fs';
import path from 'path';

const targetDir = 'C:\\Users\\Jiva\\.gemini\\config\\skills\\hallmark';

async function fetchDir(githubPath, localDir) {
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const url = `https://api.github.com/repos/nutlope/hallmark/contents/${githubPath}`;
  console.log('Fetching:', url);
  const res = await fetch(url, { headers: { 'User-Agent': 'Antigravity-Agent' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  }
  const items = await res.json();

  for (const item of items) {
    const itemLocalPath = path.join(localDir, item.name);
    if (item.type === 'dir') {
      await fetchDir(item.path, itemLocalPath);
    } else if (item.type === 'file') {
      console.log('Downloading file:', item.name);
      const fileRes = await fetch(item.download_url);
      const content = await fileRes.text();
      fs.writeFileSync(itemLocalPath, content, 'utf8');
    }
  }
}

async function main() {
  try {
    console.log('Installing hallmark skill from nutlope/hallmark...');
    await fetchDir('skills/hallmark', targetDir);
    console.log('Hallmark skill installed successfully at:', targetDir);
  } catch (err) {
    console.error('Installation error:', err);
    process.exit(1);
  }
}

main();
