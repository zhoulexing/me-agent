#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function fail(message) {
  process.stderr.write(`${JSON.stringify({ success: false, error: message }, null, 2)}\n`);
  process.exit(1);
}

function dimensions(file) {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {
    encoding: 'utf8',
  });
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!width || !height) throw new Error(`无法读取图片尺寸: ${file}`);
  return { width, height };
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

function ratioFraction(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`无效的目标比例: ${text}`);
  const [whole, decimal = ''] = text.split('.');
  const denominator = 10 ** decimal.length;
  const numerator = Number(whole) * denominator + Number(decimal || 0);
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

const args = parseArgs(process.argv.slice(2));
const input = args.input ? resolve(args.input) : '';
const output = args.output ? resolve(args.output) : '';
const squareOutput = args['square-output'] ? resolve(args['square-output']) : '';
const ratioText = String(args.ratio || '2.35');
const ratio = Number(ratioText);

if (!input || !output) fail('用法: prepare-cover.mjs --input <image> --output <cover> [--square-output <preview>] [--ratio 2.35]');
if (!existsSync(input)) fail(`输入图片不存在: ${input}`);
if (!Number.isFinite(ratio) || ratio < 1) fail(`无效的目标比例: ${ratioText}`);
if (input === output || realpathSync(input) === resolve(output)) fail('输出路径必须与输入路径不同');

try {
  const source = dimensions(input);
  const fraction = ratioFraction(ratioText);
  const scale = Math.floor(Math.min(source.width / fraction.numerator, source.height / fraction.denominator));
  if (scale < 1) throw new Error(`输入图片 ${source.width}x${source.height} 太小，无法精确裁成 ${ratioText}:1`);
  const targetWidth = fraction.numerator * scale;
  const targetHeight = fraction.denominator * scale;

  mkdirSync(dirname(output), { recursive: true });
  execFileSync('sips', ['--cropToHeightWidth', String(targetHeight), String(targetWidth), input, '--out', output], {
    stdio: 'pipe',
  });

  const finalSize = dimensions(output);
  let squareSize = null;
  if (squareOutput) {
    mkdirSync(dirname(squareOutput), { recursive: true });
    const edge = Math.min(finalSize.width, finalSize.height);
    execFileSync('sips', ['--cropToHeightWidth', String(edge), String(edge), output, '--out', squareOutput], {
      stdio: 'pipe',
    });
    squareSize = dimensions(squareOutput);
  }

  process.stdout.write(`${JSON.stringify({
    success: true,
    input,
    source,
    output,
    final: finalSize,
    targetRatio: ratio,
    actualRatio: Number((finalSize.width / finalSize.height).toFixed(6)),
    squareOutput: squareOutput || null,
    square: squareSize,
    note: '尺寸校验已通过；仍需目视确认中央正方形是完整子图。',
  }, null, 2)}\n`);
} catch (error) {
  fail(error.message);
}
