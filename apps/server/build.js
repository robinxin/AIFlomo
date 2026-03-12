import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 简单的构建脚本
 * 将 src/ 目录复制到 dist/
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// 清空 dist 目录
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

// 复制 src 到 dist
copyDir(srcDir, distDir);

console.log('Build completed successfully!');
