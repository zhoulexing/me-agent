#!/usr/bin/env node
/**
 * 视频号视频发布 - 基于 Midscene AI 视觉驱动
 *
 * 使用 Doubao-Seed-2.0-lite 作为视觉模型，自动完成视频号视频发布
 *
 * 使用方式:
 *   node publish-video.js <video_path> [title] [--headed]
 *
 * 示例:
 *   node publish-video.js "/path/to/video.mp4" "AI时代，我在达芬奇里打字"
 *   node publish-video.js "/path/to/video.mp4" "标题" --headed
 */

const { chromium } = require('playwright');
const { PlaywrightAgent } = require('@midscene/web/playwright');
const path = require('path');
const fs = require('fs');

// 加载 .env 文件
try {
  const dotenv = require('dotenv');
  dotenv.config();
} catch (e) {
  // dotenv not installed, use process.env directly
}

// 平台配置
const PLATFORM = {
  name: '微信视频号',
  url: 'https://channels.weixin.qq.com/platform',
};

// 固定标签
const TAGS = '#人工智能 #视频日记';
const CHROME_CDP_URL = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
const CHROME_PROFILE_DIRECTORY = process.env.CHROME_PROFILE_DIRECTORY || 'Default';

async function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function chromeLaunchHint() {
  return [
    'Chrome 136+ 不再允许对默认用户目录直接开启 remote debugging。',
    '也就是说：即使你用真实用户 profile 启动了 Chrome，`--remote-debugging-port` 也可能被直接忽略。',
    '',
    `当前脚本会连接: ${CHROME_CDP_URL}`,
    `当前 profile 目录: ${CHROME_PROFILE_DIRECTORY}`,
    '',
    '如果你的目标是“真实用户已登录身份 + 视觉自动化”，不要再走 CDP/Playwright attach 这条路。',
    '应改用系统级 GUI 自动化方案，例如 macOS Accessibility / AppleScript / cliclick。',
    '',
    '说明：Chrome 显示名可能是“用户1”，但真实目录通常是 `Default`、`Profile 1` 这类名字，不是“用户1”。',
  ].join('\n');
}

async function connectToUserChrome() {
  try {
    const browser = await chromium.connectOverCDP(CHROME_CDP_URL);
    const context = browser.contexts()[0];

    if (!context) {
      throw new Error(`已连接 Chrome，但未拿到默认 context。请确认 Chrome 是用真实用户 profile 启动的。\n\n${chromeLaunchHint()}`);
    }

    const existingPage = context.pages().find(p => p.url() !== 'about:blank');
    const page = existingPage || await context.newPage();

    return { browser, context, page };
  } catch (error) {
    throw new Error(
      [
        `无法连接到用户 Chrome: ${error.message}`,
        '',
        chromeLaunchHint(),
      ].join('\n'),
    );
  }
}

async function publishVideoWeixin(videoPath, title, headed = false) {
  console.log('📹 开始发布视频号视频...');
  console.log(`   视频: ${videoPath}`);
  console.log(`   标题: ${title || '(使用默认标签)'}`);
  console.log(`   模式: ${headed ? 'headed' : 'attached'}`);

  let browser;
  let context;
  let page;

  console.log('\n🔗 连接用户 Chrome...');
  ({ browser, context, page } = await connectToUserChrome());
  console.log(`✅ 已连接 Chrome: ${CHROME_CDP_URL}`);

  try {
    // 1. 打开视频号后台
    console.log('\n📂 步骤1: 打开视频号后台...');
    await page.goto(PLATFORM.url);
    await page.bringToFront();
    await sleep(3);

    // 初始化 Midscene Agent
    const agent = new PlaywrightAgent(page);

    // 2. 让 AI 找到并点击"发表视频"按钮
    console.log('\n🖱️ 步骤2: 寻找并点击"发表视频"按钮...');
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
    await agent.aiAct('点击"发表视频"按钮，进入上传视频流程');

    await sleep(3);

    // 4. 上传视频
    console.log('\n📤 步骤4: 上传视频文件...');
    const fileChooser = await fileChooserPromise;
    if (fileChooser) {
      await fileChooser.setFiles(videoPath);
    } else {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ timeout: 10000 });
      await fileInput.setInputFiles(videoPath);
    }

    // 5. 等待视频上传
    console.log('\n⏳ 步骤5: 等待视频上传完成...');
    await sleep(10);

    // 6. 填写描述（视频号没有单独标题，标题放描述里）
    console.log('\n⌨️ 步骤6: 填写视频描述...');
    const description = title ? `${title} ${TAGS}` : TAGS;
    await agent.aiAct(`在描述框输入: ${description}`);

    await sleep(2);

    // 7. 截图确认
    console.log('\n📸 步骤7: 截图确认...');
    const screenshotPath = path.join(process.cwd(), `preview-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`   截图已保存: ${screenshotPath}`);

    // 8. 询问用户确认
    console.log('\n⏸️ 请确认是否发布:');
    console.log('   - 查看截图，确认无误后输入 "y" 发布');
    console.log('   - 输入 "n" 取消发布');

    // 等待用户输入
    const answer = await new Promise(resolve => {
      process.stdout.write('\n请输入 (y/n): ');
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (answer === 'y') {
      // 9. 发布
      console.log('\n🚀 步骤9: 点击发布...');
      await agent.aiAct('点击发布按钮');
      await sleep(3);

      console.log('\n✅ 发布成功！');
    } else {
      console.log('\n❌ 已取消发布');
    }

  } catch (error) {
    console.error('\n❌ 发布失败:', error.message);
    console.error(error.stack);

    // 截图保存错误状态
    const errorScreenshot = path.join(process.cwd(), `error-${Date.now()}.png`);
    await page.screenshot({ path: errorScreenshot });
    console.log(`错误截图已保存: ${errorScreenshot}`);
  } finally {
    if (page && !page.isClosed() && page.url() === 'about:blank') {
      await page.close().catch(() => {});
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node publish-video.js <video_path> [title] [--headed]');
    console.log('');
    console.log('参数:');
    console.log('  video_path    视频文件路径 (必填)');
    console.log('  title         视频标题 (可选)');
    console.log('  --headed      保留兼容参数，当前脚本固定连接真实 Chrome (可选)');
    console.log('');
    console.log('示例:');
    console.log('  node publish-video.js "/path/to/video.mp4" "我的AI视频"');
    console.log('  node publish-video.js "/path/to/video.mp4" --headed');
    process.exit(1);
  }

  // 解析参数
  let videoPath = null;
  let title = null;
  let headed = false;

  for (const arg of args) {
    if (arg === '--headed') {
      headed = true;
    } else if (!arg.startsWith('--')) {
      if (!videoPath) {
        videoPath = arg;
      } else {
        title = arg;
      }
    }
  }

  // 验证视频文件
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ 视频文件不存在: ${videoPath}`);
    process.exit(1);
  }

  // 视频号发布依赖视觉模型
  if (!process.env.MIDSCENE_MODEL_API_KEY) {
    console.error('❌ 缺少 MIDSCENE_MODEL_API_KEY 配置');
    console.error('');
    console.error('请创建 .env 文件或设置环境变量:');
    console.error('  export MIDSCENE_MODEL_API_KEY="your-api-key"');
    console.error('  export MIDSCENE_MODEL_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"');
    console.error('  export MIDSCENE_MODEL_NAME="doubao-seed-2-0-lite-260215"');
    console.error('  export MIDSCENE_MODEL_FAMILY="doubao-seed"');
    console.error('');
    console.error('参考 .env 文件');
    process.exit(1);
  }

  // 执行发布
  await publishVideoWeixin(videoPath, title, headed);
}

main().catch(console.error);
