#!/usr/bin/env node

/**
 * 构建发布包
 * 
 * 产出两个版本：
 *   - FULL：包含 Chromium 浏览器（首次安装用，~150MB）
 *   - LITE：不包含 Chromium（更新用，~20MB）
 * 
 * 用法：
 *   node scripts/build-release.js          # 构建当前平台
 *   node scripts/build-release.js --win    # 只构建 Windows
 *   node scripts/build-release.js --mac    # 只构建 Mac
 *   node scripts/build-release.js --linux  # 只构建 Linux
 *   node scripts/build-release.js --all    # 构建全平台
 *   node scripts/build-release.js --publish # 构建并发布到 GitHub
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

// ---- 解析参数 ----
const args = process.argv.slice(2)
const doPublish = args.includes('--publish')
const platforms = []
if (args.includes('--win') || args.includes('--all')) platforms.push('win')
if (args.includes('--mac') || args.includes('--all')) platforms.push('mac')
if (args.includes('--linux') || args.includes('--all')) platforms.push('linux')
if (platforms.length === 0) {
  // 默认当前平台
  if (process.platform === 'win32') platforms.push('win')
  else if (process.platform === 'darwin') platforms.push('mac')
  else platforms.push('linux')
}

// ---- 构建 renderer ----
console.log('\n🔨 Step 1: 构建 renderer...')
execSync('npx vite build --config renderer/vite.config.js', { cwd: root, stdio: 'inherit' })

// ---- 构建 FULL 版本（含 Chromium）----
console.log('\n📦 Step 2: 构建 FULL 版本（含 Chromium 浏览器）...')

// FULL 版本直接用 package.json 的 build 配置（已有 extraResources）
const platformFlags = platforms.map(p => `--${p}`).join(' ')
const publishFlag = doPublish ? '--publish always' : ''
execSync(
  `npx electron-builder ${platformFlags} ${publishFlag}`,
  { cwd: root, stdio: 'inherit', env: { ...process.env, BUILD_VARIANT: 'full' } }
)

// ---- 重命名 FULL 产物 ----
console.log('\n🏷️  重命名 FULL 版产物...')
renameArtifacts(root, 'full')

// ---- 构建 LITE 版本（不含 Chromium）----
console.log('\n📦 Step 3: 构建 LITE 版本（不含浏览器，供更新用）...')

// LITE 版本用 lite 配置文件
execSync(
  `npx electron-builder ${platformFlags} --config electron-builder.lite.json ${publishFlag}`,
  { cwd: root, stdio: 'inherit', env: { ...process.env, BUILD_VARIANT: 'lite' } }
)

// ---- 重命名 LITE 产物 ----
console.log('\n🏷️  重命名 LITE 版产物...')
renameArtifacts(root, 'lite')

// ---- 输出结果 ----
console.log('\n✅ 构建完成！产物目录: dist/')
const files = fs.readdirSync(path.join(root, 'dist')).filter(f => 
  !f.endsWith('.blockmap') && !f.startsWith('builder-')
)
console.log('\n产物列表:')
for (const f of files) {
  const stat = fs.statSync(path.join(root, 'dist', f))
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1)
  console.log(`  ${f}  (${sizeMB} MB)`)
}

/**
 * 重命名产物，加上 -full / -lite 后缀
 */
function renameArtifacts(dir, variant) {
  const distDir = path.join(dir, 'dist')
  if (!fs.existsSync(distDir)) return

  const files = fs.readdirSync(distDir)
  for (const file of files) {
    // 只处理本次构建的产物（通过修改时间判断，最近30秒内）
    const filePath = path.join(distDir, file)
    const stat = fs.statSync(filePath)
    const ageSec = (Date.now() - stat.mtimeMs) / 1000
    if (ageSec > 30) continue

    // 跳过已标记的文件
    if (file.includes('-full.') || file.includes('-lite.')) continue

    // 跳过 blockmap 和临时文件
    if (file.endsWith('.blockmap') || file.startsWith('builder-')) continue

    // 在扩展名前插入 -variant
    const ext = path.extname(file)
    const base = file.slice(0, -ext.length)
    const newName = `${base}-${variant}${ext}`
    fs.renameSync(filePath, path.join(distDir, newName))
    console.log(`  ${file} → ${newName}`)
  }
}
