/**
 * WeChat official account rich-text inline styles.
 *
 * Usage in a browser context:
 *   applyWeChatStyles(containerElement)
 *
 * The function mutates the given DOM container so the resulting HTML can be
 * pasted into the WeChat editor without relying on external CSS, class names,
 * or IDs.
 */

const WECHAT_STYLES = {
  body: 'font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif; line-height: 1.75; color: #333; font-size: 17px;',
  h1: 'font-size: 24px; font-weight: 700; margin: 20px 0 10px 0; padding: 0 0 10px 0; color: #333; line-height: 1.5; border-bottom: 2px solid #eaecef;',
  h2: 'font-size: 20px; font-weight: 700; margin: 18px 0 8px 0; padding: 0; color: #333; line-height: 1.5;',
  h3: 'font-size: 18px; font-weight: 700; margin: 16px 0 8px 0; padding: 0; color: #333; line-height: 1.5;',
  h4: 'font-size: 16px; font-weight: 700; margin: 14px 0 6px 0; padding: 0; color: #333; line-height: 1.5;',
  h5: 'font-size: 14px; font-weight: 700; margin: 12px 0 6px 0; padding: 0; color: #333; line-height: 1.5;',
  h6: 'font-size: 14px; font-weight: 700; margin: 10px 0 6px 0; padding: 0; color: #666; line-height: 1.5;',
  p: 'margin: 15px 0; padding: 0; line-height: 1.75; color: #333; font-size: 17px;',
  ul: 'margin: 15px 0; padding-left: 20px;',
  ol: 'margin: 15px 0; padding-left: 20px;',
  li: 'margin: 6px 0; line-height: 1.75; color: #333; font-size: 17px;',
  blockquote: 'margin: 20px 0; padding: 15px 20px; background-color: #f7f7f7; border-left: 4px solid #1e90ff; color: #666; font-style: italic; line-height: 1.75; font-size: 17px;',
  code: 'background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 14px; color: #e96900;',
  pre: 'background-color: #f8f8f8; padding: 15px; border-radius: 6px; overflow-x: auto; margin: 15px 0; border: 1px solid #e1e4e8;',
  table: 'border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 14px;',
  th: 'border: 1px solid #dfe2e5; padding: 8px 12px; background-color: #f6f8fa; font-weight: 700; text-align: left;',
  td: 'border: 1px solid #dfe2e5; padding: 8px 12px; text-align: left;',
  strong: 'font-weight: 700; color: #333;',
  b: 'font-weight: 700; color: #333;',
  a: 'color: #1e90ff; text-decoration: none; border-bottom: 1px solid transparent;',
  img: 'max-width: 100%; height: auto; border-radius: 4px; margin: 10px 0;',
  hr: 'border: none; height: 1px; background-color: #e1e4e8; margin: 30px 0;',
};

function applyWeChatStyles(container) {
  if (!container || typeof container.querySelectorAll !== 'function') {
    throw new TypeError('applyWeChatStyles expects a DOM container element');
  }

  Object.entries(WECHAT_STYLES).forEach(([tag, style]) => {
    container.querySelectorAll(tag).forEach((element) => {
      element.style.cssText = style;

      if (tag === 'pre') {
        const codeElement = element.querySelector('code');
        if (codeElement) {
          codeElement.style.cssText = 'background: none; padding: 0; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 13px; line-height: 1.5; color: #333;';
        }
      }
    });
  });

  container.style.cssText = WECHAT_STYLES.body;
  fixBoldForWeChat(container);
  cleanupForWeChat(container);

  return container;
}

function fixBoldForWeChat(container) {
  container.querySelectorAll('strong, b, [style*="font-weight"]').forEach((element) => {
    element.style.fontWeight = '700';
    element.style.color = element.style.color || '#333';

    if (!['STRONG', 'B'].includes(element.tagName)) {
      const strongElement = document.createElement('strong');
      strongElement.innerHTML = element.innerHTML;
      strongElement.style.cssText = element.style.cssText;
      strongElement.style.fontWeight = '700';
      element.parentNode.replaceChild(strongElement, element);
    }
  });

  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    heading.style.fontWeight = '700';
  });
}

function cleanupForWeChat(container) {
  container.querySelectorAll('*').forEach((element) => {
    element.removeAttribute('class');
    element.removeAttribute('id');
    element.removeAttribute('data-line');
    element.removeAttribute('contenteditable');
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    WECHAT_STYLES,
    applyWeChatStyles,
  };
}
