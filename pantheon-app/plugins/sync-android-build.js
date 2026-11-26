const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const cmd = process.argv[2];

function getPackageHash() {
  const pkgPath = path.join(rootDir, 'package.json');
  return crypto.createHash('sha256').update(fs.readFileSync(pkgPath)).digest('hex');
}

function getHashFilePath() {
  return path.join(rootDir, 'node_modules', '.colearn-pkg-hash');
}

if (cmd === 'check-deps') {
  const hashFile = getHashFilePath();
  if (!fs.existsSync(hashFile)) {
    process.exit(1);
  }
  const current = getPackageHash();
  const saved = fs.readFileSync(hashFile, 'utf8').trim();
  process.exit(current === saved ? 0 : 1);
}

if (cmd === 'save-deps-hash') {
  const hashFile = getHashFilePath();
  fs.mkdirSync(path.dirname(hashFile), { recursive: true });
  fs.writeFileSync(hashFile, getPackageHash(), 'utf8');
  process.exit(0);
}

if (cmd === 'check-version') {
  const appJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'app.json'), 'utf8'));
  const appVer = appJson?.expo?.version || '1.0.0';
  const verConfigPath = path.join(rootDir, 'constants', 'versionConfig.ts');
  if (fs.existsSync(verConfigPath)) {
    const txt = fs.readFileSync(verConfigPath, 'utf8');
    const match = txt.match(/APP_BUILD_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1] !== appVer) {
      console.log(
        `[WARN] constants/versionConfig.ts APP_BUILD_VERSION (${match[1]}) differs from app.json (${appVer}).`
      );
    }
  }
  process.exit(0);
}

if (cmd === 'sync-gradle') {
  const appJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'app.json'), 'utf8'));
  const versionName = String(appJson?.expo?.version || '1.0.0');
  const versionCode = Number(appJson?.expo?.android?.versionCode || 1);

  const gpPath = path.join(rootDir, 'android', 'gradle.properties');
  let gp = fs.existsSync(gpPath) ? fs.readFileSync(gpPath, 'utf8') : '';

  const setProp = (txt, key, value) => {
    const escaped = key.replace(/\./g, '\\.');
    const re = new RegExp(`^${escaped}=.*$`, 'm');
    if (re.test(txt)) {
      return txt.replace(re, `${key}=${value}`);
    }
    return `${txt.trimEnd()}\n${key}=${value}\n`;
  };

  gp = setProp(gp, 'reactNativeArchitectures', 'armeabi-v7a,arm64-v8a');
  gp = setProp(gp, 'org.gradle.daemon', 'true');
  gp = setProp(gp, 'org.gradle.parallel', 'true');
  gp = setProp(gp, 'org.gradle.caching', 'true');
  gp = setProp(gp, 'org.gradle.configureondemand', 'true');
  fs.writeFileSync(gpPath, gp, 'utf8');

  const bgPath = path.join(rootDir, 'android', 'app', 'build.gradle');
  if (fs.existsSync(bgPath)) {
    let bg = fs.readFileSync(bgPath, 'utf8');
    bg = bg.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
    bg = bg.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
    fs.writeFileSync(bgPath, bg, 'utf8');
  }
  process.exit(0);
}

if (cmd === 'print-apks') {
  const files = process.argv.slice(3);
  for (const rel of files) {
    const full = path.isAbsolute(rel) ? rel : path.join(rootDir, rel);
    if (fs.existsSync(full)) {
      const mb = (fs.statSync(full).size / (1024 * 1024)).toFixed(2);
      console.log(`  ${rel} (${mb} MB)`);
    }
  }
  process.exit(0);
}

console.error(`Unknown command: ${cmd || '(none)'}`);
process.exit(1);
