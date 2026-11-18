const byId = id => document.getElementById(id);
const asset = name => globalThis.topicChatAssets?.[name] ?? `assets/${name}`;
const resources = [
  { title: '森林里的朋友', image: '5b808.png' },
  { title: '一起飞向外太空', image: 'bbb49.png' },
  { title: '今晚睡个好觉', image: 'fe322.png', folder: '21647.svg', images: ['fe322.png', 'b6e6c.png', '88d5a.png'] },
  { title: '大海里的奇幻冒险之旅', image: 'a05f4.png' },
  { title: '开心农场', image: 'e4003.png', folder: 'c6c98.svg', images: ['e4003.png', '5b808.png', 'c3a9d.png'] },
  { title: '小鸭子', image: 'c3a9d.png', images: ['c3a9d.png', 'a05f4.png', 'e4003.png'] },
  { title: '感受宇宙的神秘力量', image: 'b6e6c.png', shared: true },
  { title: '探索未知的星系', image: '88d5a.png', shared: true },
  { title: '与星际生物沟通', image: '26da1.png', shared: true },
  { title: '寻找适合人类居住的星球', image: '64055.png', shared: true },
  { title: '观察超级黑洞的形成', image: 'f8ace.png', shared: true },
  { title: '记录宇宙中的奇特现象', image: '2a33b.png', shared: true }
];
const search = byId('resource-search');
const searchScreen = byId('search-screen');
const phone = document.querySelector('.phone');
const stickyHeader = document.querySelector('.sticky-header');
const searchBar = byId('search-trigger');
const searchToggle = byId('search-toggle');
const fullConfig = document.querySelector('.configuration');
const compactConfig = byId('compact-config');
const libraryToolbar = document.querySelector('.library-toolbar');
const resourceScroll = byId('resources');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const picker = byId('picker');
const selected = new Set();
const attachments = new Map();
const initialState = new URLSearchParams(location.search).get('state');
if (initialState === 'empty') resources.length = 0;
const grid = byId('grid');
const dialog = byId('dialog');
const dialogForm = byId('dialog-form');
const preview = byId('preview');
const mineTab = byId('mine-tab');
const sharedTab = byId('shared-tab');
const manage = byId('manage');
let current = resources[0] ?? null;
let loadFailed = initialState === 'error';
let scrollFrame = 0;
let successTimer;
let shared = false;
let sortDirection = 0;
let onConfirm;
let previewItem;
let previewImages = [];
let previewIndex = 0;

function element(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  if (value) node.textContent = value;
  return node;
}

function image(src, className) {
  const img = element('img', className);
  img.alt = '';
  img.src = src;
  return img;
}

function coverSource(item) {
  return item.url || (item.image && asset(item.image));
}

function showDialog(title, fields, confirm, actionLabel = '确认') {
  dialog.classList.remove('confirm-delete');
  for (const button of dialogForm.querySelectorAll('.dialog-actions button')) {
    button.classList.remove('app-button--strong');
  }
  dialogForm.querySelector('[value="cancel"]').textContent = '关闭';
  byId('dialog-title').textContent = title;
  byId('dialog-content').replaceChildren(...fields);
  byId('confirm').hidden = !confirm;
  byId('confirm').textContent = actionLabel;
  onConfirm = confirm;
  dialog.showModal();
}

function selectResource(item) {
  current = item;
  const src = coverSource(item);
  for (const cover of [byId('cover'), byId('compact-cover')]) {
    if (src && !item.pdf) cover.src = src;
    else cover.removeAttribute('src');
  }
  byId('current-title').textContent = item.title;
  byId('compact-title').textContent = item.title;
  byId('resource-link').textContent = `${item.shared ? '共享资源' : '我的资源'} - ${item.title}`;
  render();
  if (picker.open) renderPicker();
}

function syncScrollState() {
  scrollFrame = 0;
  const cutoff = stickyHeader.getBoundingClientRect().bottom;
  const searchBottom = searchBar.getBoundingClientRect().bottom;
  const configBottom = fullConfig.getBoundingClientRect().bottom;
  const viewportBottom = phone.getBoundingClientRect().bottom;
  const available = Math.max(0, Math.round(viewportBottom - libraryToolbar.getBoundingClientRect().bottom));
  const progress = (edge, distance) => Math.max(0, Math.min(1, (edge + distance) / distance));
  const searchProgress = loadFailed ? 1 : progress(cutoff - searchBottom, 20);
  const dockProgress = loadFailed || !current
    ? 0
    : Math.max(0, Math.min(1, (cutoff - configBottom) / 24));
  phone.classList.toggle('is-scrolled', phone.scrollTop > 0);
  const visibleHeight = `${available}px`;
  if (resourceScroll.style.maxHeight !== visibleHeight) resourceScroll.style.maxHeight = visibleHeight;
  searchToggle.inert = !loadFailed && searchBottom > cutoff;
  searchBar.inert = loadFailed || searchBottom <= cutoff;
  compactConfig.inert = dockProgress < 1;
  fullConfig.inert = configBottom <= cutoff;
  searchToggle.style.setProperty('--search-opacity', reducedMotion.matches ? Number(!searchToggle.inert) : searchProgress);
  compactConfig.style.setProperty('--dock-opacity', reducedMotion.matches ? Number(!compactConfig.inert) : dockProgress);
  searchToggle.style.setProperty('--search-offset', `${reducedMotion.matches ? 0 : (searchProgress - 1) * 4}px`);
  compactConfig.style.setProperty('--dock-offset', `${reducedMotion.matches ? 0 : (dockProgress - 1) * 6}px`);
}

phone.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(syncScrollState);
}, { passive: true });
const scrollLayout = new ResizeObserver(syncScrollState);
for (const part of [phone, stickyHeader, fullConfig, libraryToolbar]) scrollLayout.observe(part);
reducedMotion.addEventListener('change', syncScrollState);
function openSearch() {
  search.value = '';
  byId('search-feedback').textContent = '';
  renderSearch();
  searchScreen.showModal();
  search.focus({ preventScroll: true });
}
searchToggle.addEventListener('click', openSearch);
searchBar.addEventListener('click', openSearch);
byId('search-back').addEventListener('click', () => searchScreen.close());

function renderPreview(index) {
  previewIndex = index;
  const stage = byId('preview-stage');
  const multiple = previewImages.length > 1;
  byId('preview-title').textContent = multiple
    ? `${previewItem.title}（${index + 1}/${previewImages.length}）`
    : previewItem.title;
  stage.replaceChildren();
  if (previewItem.pdf) {
    const file = document.createElement('iframe');
    file.title = previewItem.title;
    file.src = previewItem.url;
    const link = element('a', '', '在新标签页打开 PDF');
    link.href = previewItem.url;
    link.target = '_blank';
    link.rel = 'noopener';
    stage.append(file, link);
  } else if (previewImages.length) {
    const photo = image(previewImages[index], 'preview-photo');
    photo.alt = multiple ? `${previewItem.title}，第 ${index + 1} 张` : previewItem.title;
    stage.append(photo);
  } else {
    stage.append(element('p', '', '此文件夹暂无图片'));
  }
  Array.from(byId('preview-pagination').children).forEach((button, i) => {
    button.setAttribute('aria-current', String(i === index));
  });
}

function openPreview(item) {
  previewItem = item;
  const src = coverSource(item);
  previewImages = item.images?.map(asset) || (src && !item.pdf ? [src] : []);
  for (const attachment of attachments.get(item) || []) {
    if (attachment.images) previewImages.push(...attachment.images.map(asset));
    else if (!attachment.pdf && coverSource(attachment)) previewImages.push(coverSource(attachment));
  }
  byId('preview-feedback').textContent = '';
  const pagination = byId('preview-pagination');
  pagination.replaceChildren();
  pagination.hidden = previewImages.length < 2;
  if (!pagination.hidden) {
    previewImages.forEach((_, i) => {
      const button = element('button', 'app-button app-button--structural preview-page');
      button.setAttribute('aria-label', `预览第 ${i + 1} 张图片`);
      button.addEventListener('click', () => renderPreview(i));
      pagination.append(button);
    });
  }
  const select = byId('preview-select');
  select.disabled = item === current || (!previewImages.length && !item.pdf);
  select.textContent = item === current ? '已设为主题聊' : '设为主题聊';
  renderPreview(0);
  preview.showModal();
}

function render() {
  const visible = resources.filter(item => !shared || item.shared);
  if (sortDirection) visible.sort((a, b) => sortDirection * a.title.localeCompare(b.title, 'zh-CN'));
  grid.replaceChildren(...visible.map(item => renderTile(item)));
  const emptyLibrary = !shared && !resources.length;
  byId('empty').hidden = visible.length > 0 || emptyLibrary;
  byId('empty-library').hidden = !emptyLibrary;
  byId('empty-config').hidden = Boolean(current);
  document.querySelector('.summary').hidden = !current;
  byId('resource-link').hidden = !current;
  byId('adjust').hidden = !current;
  phone.classList.toggle('is-empty', !current);
  phone.classList.toggle('load-failed', loadFailed);
  byId('load-error').hidden = !loadFailed;
  document.querySelector('.hero').hidden = loadFailed;
  document.querySelector('.library').hidden = loadFailed;
}

function renderTile(item, picking = false) {
  const wrapper = element('article', 'resource');
  const tile = element('button', 'app-button app-button--structural tile');
  const art = element('span', 'art');
  const active = item === current;
  const src = coverSource(item);
  tile.setAttribute('aria-pressed', String(picking ? selected.has(item) : active));
  if (item.images) {
    art.classList.add('stacked');
    if (item.folder === '21647.svg') art.classList.add('purple');
    art.append(image(asset('e4003.png'), 'stack-photo stack-back'), image(src, 'stack-photo'));
    if (item.folder) art.append(image(asset(item.folder), 'folder'));
    art.append(element('span', 'count', String(item.images.length)));
  } else if (src && !item.pdf) {
    art.append(image(src, 'cover'));
  } else {
    art.append(element('span', 'file-placeholder', item.pdf ? 'PDF' : '文件夹'));
  }
  if (active) {
    art.classList.add('active');
    art.append(element('span', 'flag', '当前配置'));
  }
  tile.append(art, element('span', 'name', item.title));
  for (const img of art.querySelectorAll('img')) {
    img.loading = 'lazy';
    img.decoding = 'async';
  }
  if (picking && !active) {
    const mark = element('span', 'picker-check');
    mark.setAttribute('aria-hidden', 'true');
    art.append(mark);
    tile.addEventListener('click', () => {
      if (selected.has(item)) selected.delete(item);
      else selected.add(item);
      tile.setAttribute('aria-pressed', String(selected.has(item)));
      updatePickerCount();
    });
    if (item.images || item.image || item.url) {
      const expand = element('button', 'app-button app-button--structural picker-expand');
      expand.setAttribute('aria-label', `预览${item.title}`);
      expand.append(image(asset('0fde4.svg'), ''));
      wrapper.append(expand);
      expand.addEventListener('click', () => openPreview(item));
    }
  } else {
    tile.addEventListener('click', () => openPreview(item));
  }
  wrapper.append(tile);
  return wrapper;
}

function setTab(tab) {
  shared = tab === sharedTab;
  for (const button of [mineTab, sharedTab]) {
    button.setAttribute('aria-selected', String(button === tab));
    button.tabIndex = button === tab ? 0 : -1;
  }
  byId('resources').setAttribute('aria-labelledby', tab.id);
  document.querySelector('.actions').hidden = shared;
  render();
}

function renderSearch() {
  const query = search.value.trim().toLocaleLowerCase();
  const matches = query ? resources.filter(item => item.title.toLocaleLowerCase().includes(query)) : [];
  byId('search-results').replaceChildren(...matches.map(item => renderTile(item)));
  byId('search-empty').hidden = !query || matches.length > 0;
}
search.addEventListener('input', renderSearch);
byId('search-form').addEventListener('submit', event => {
  event.preventDefault();
  renderSearch();
  search.blur();
});

const keyboardRows = byId('keyboard-rows');
let keyboardMode = 'letters';
let uppercase = false;
function updateKeyboard() {
  const layouts = {
    letters: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
    numbers: ['1234567890', '-/:;()$&@', '.,?!'],
    emoji: ['😀😄😁😆😅😂🙂😉😊😍', '✨⭐🌈☀🌙🔥🎉💛❤', '📚🌳🦕🚀🐰']
  };
  const rows = layouts[keyboardMode].map(row => Array.from(uppercase && keyboardMode === 'letters' ? row.toUpperCase() : row));
  rows[2].push('⌫');
  if (keyboardMode === 'letters') rows[2].unshift('⇧');
  rows.push([keyboardMode === 'letters' ? '123' : 'ABC', '.', '/', '.com', '↵']);
  keyboardRows.replaceChildren(...rows.map(keys => {
    const row = element('div', 'keyboard-row');
    for (const key of keys) {
      const button = element('button', 'app-button app-button--structural keyboard-key', key);
      button.type = 'button';
      button.dataset.key = key;
      if (['⇧', '⌫', '123', 'ABC', '↵'].includes(key)) button.classList.add('keyboard-key--wide');
      if (['123', 'ABC', '.com'].includes(key)) button.classList.add('keyboard-key--label');
      row.append(button);
    }
    return row;
  }));
}
function editSearch(key) {
  const start = search.selectionStart ?? search.value.length;
  const end = search.selectionEnd ?? start;
  const erase = key === '⌫';
  const previous = Array.from(search.value.slice(0, start)).pop()?.length ?? 0;
  search.setRangeText(erase ? '' : key, erase && start === end ? start - previous : start, end, 'end');
  search.focus({ preventScroll: true });
  renderSearch();
}
keyboardRows.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) event.preventDefault();
});
keyboardRows.addEventListener('click', event => {
  const key = event.target.closest('button')?.dataset.key;
  if (!key) return;
  if (key === '⇧') uppercase = !uppercase;
  else if (key === '123' || key === 'ABC') keyboardMode = key === '123' ? 'numbers' : 'letters';
  else if (key === '↵') byId('search-form').requestSubmit();
  else {
    editSearch(key);
    if (!uppercase) return;
    uppercase = false;
  }
  updateKeyboard();
});
byId('keyboard-emoji').addEventListener('click', () => {
  keyboardMode = keyboardMode === 'emoji' ? 'letters' : 'emoji';
  updateKeyboard();
});
byId('keyboard-mic').addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const feedback = byId('search-feedback');
  if (!SpeechRecognition) {
    feedback.textContent = '当前浏览器不支持语音搜索';
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.onresult = event => {
    if (!searchScreen.open) return;
    search.value = event.results[0][0].transcript;
    feedback.textContent = '';
    renderSearch();
  };
  recognition.onerror = () => { feedback.textContent = '语音输入不可用，请使用键盘'; };
  try {
    recognition.start();
  } catch {
    feedback.textContent = '语音输入不可用，请使用键盘';
  }
});
updateKeyboard();
byId('sort').addEventListener('click', () => {
  sortDirection = sortDirection === 1 ? -1 : 1;
  byId('sort').firstChild.textContent = sortDirection === 1 ? '名称升序' : '名称降序';
  render();
});
for (const tab of [mineTab, sharedTab]) {
  tab.addEventListener('click', () => setTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = tab === mineTab ? sharedTab : mineTab;
    setTab(next);
    next.focus();
  });
}
byId('back').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else document.querySelector('.phone').scrollTo(0, 0);
});
byId('help').addEventListener('click', () => showDialog('主题聊帮助', [
  element('p', '', '在资源库中选择绘本或文件，再添加到主题聊配置。你也可以调整提示词，设置聊天内容。')
]));
byId('resource-link').addEventListener('click', () => {
  if (!current) return;
  search.value = '';
  setTab(current.shared ? sharedTab : mineTab);
  grid.querySelector('[aria-pressed="true"]')?.focus();
});
byId('adjust').addEventListener('click', () => {
  const prompts = ['prompt1', 'prompt2'].map((id, index) => {
    const label = element('label', '', `提示词${index + 1}`);
    const field = document.createElement('textarea');
    field.rows = 3;
    field.value = byId(id).textContent.replace(/^提示词\d：/, '');
    label.append(field);
    return label;
  });
  showDialog('调整聊天配置', prompts, () => {
    prompts.forEach((label, index) => {
      byId(`prompt${index + 1}`).textContent = `提示词${index + 1}：${label.lastChild.value.trim()}`;
    });
  }, '保存');
});
function updatePickerCount() {
  const items = [...selected];
  const folders = items.filter(item => item.images || !coverSource(item)).length;
  const pdfs = items.filter(item => item.pdf).length;
  const details = [`${items.length - folders - pdfs}张图片`];
  if (folders) details.push(`${folders}个文件夹`);
  if (pdfs) details.push(`${pdfs}个 PDF`);
  byId('picker-count').textContent = `已选择 ${details.join('，')}`;
  byId('picker-add').disabled = !items.some(coverSource);
  byId('picker-delete').disabled = !items.some(item => !item.shared);
  byId('picker-share').disabled = !items.length;
}

function renderPicker() {
  selected.delete(current);
  byId('picker-grid').replaceChildren(...resources.map(item => renderTile(item, true)));
  updatePickerCount();
}

function addContent() {
  if (!resources.length) {
    byId('files').click();
    return;
  }
  selected.clear();
  renderPicker();
  picker.showModal();
  picker.querySelector('.picker-scroll').scrollTop = 0;
}
byId('add').addEventListener('click', addContent);
byId('compact-add').addEventListener('click', addContent);
function isPickerBackdrop(event) {
  if (event.target !== picker) return false;
  const bounds = picker.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX >= bounds.right
    || event.clientY < bounds.top || event.clientY >= bounds.bottom;
}

let backdropPress = false;
picker.addEventListener('pointerdown', event => {
  backdropPress = isPickerBackdrop(event);
});
picker.addEventListener('click', event => {
  if (backdropPress && isPickerBackdrop(event)) picker.close();
  backdropPress = false;
});
byId('picker-add').addEventListener('click', () => {
  const items = [...selected].filter(coverSource);
  if (!items.length) return;
  if (!current) selectResource(items.shift());
  const collection = attachments.get(current) || new Set();
  items.forEach(item => collection.add(item));
  attachments.set(current, collection);
  byId('picker-success').hidden = false;
  picker.querySelector('.picker-actions').inert = true;
  byId('picker-grid').inert = true;
  successTimer = setTimeout(() => picker.close(), 1100);
});
picker.addEventListener('close', () => {
  if (picker.open) return;
  clearTimeout(successTimer);
  byId('picker-success').hidden = true;
  picker.querySelector('.picker-actions').inert = false;
  byId('picker-grid').inert = false;
});
byId('picker-delete').addEventListener('click', () => {
  const items = [...selected].filter(item => !item.shared && item !== current);
  if (!items.length) return;
  showDialog('是否删除已选中内容？', [element('p', '', byId('picker-count').textContent)], () => {
    for (const item of items) {
      resources.splice(resources.indexOf(item), 1);
      if (item.url) URL.revokeObjectURL(item.url);
      selected.delete(item);
      attachments.delete(item);
      for (const group of attachments.values()) group.delete(item);
    }
    render();
    renderPicker();
  }, '删除');
  dialog.classList.add('confirm-delete');
  for (const button of dialogForm.querySelectorAll('.dialog-actions button')) {
    button.classList.add('app-button--strong');
  }
  dialogForm.querySelector('[value="cancel"]').textContent = '保留';
});
byId('picker-share').addEventListener('click', async () => {
  const names = [...selected].map(item => item.title).join('\n');
  try {
    if (navigator.share) await navigator.share({ title: '主题聊资源', text: names });
    else {
      await navigator.clipboard.writeText(names);
      showDialog('已复制资源名称', [element('p', '', names)]);
    }
  } catch (error) {
    if (error.name !== 'AbortError') showDialog('分享资源', [element('p', '', names)]);
  }
});
byId('preview-select').addEventListener('click', () => {
  preview.close();
  selectResource(previewItem);
  if (searchScreen.open) renderSearch();
  else if (!picker.open) grid.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
});
function advancePreview(step) {
  const next = previewIndex + step;
  if (next >= 0 && next < previewImages.length) renderPreview(next);
}
preview.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  advancePreview(event.key === 'ArrowLeft' ? -1 : 1);
});
const previewStage = byId('preview-stage');
let swipeStart;
previewStage.addEventListener('pointerdown', event => {
  if (previewImages.length > 1 && event.isPrimary && event.button === 0) {
    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    previewStage.setPointerCapture(event.pointerId);
  }
});
previewStage.addEventListener('pointerup', event => {
  if (swipeStart?.id !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = undefined;
  if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy)) advancePreview(dx < 0 ? 1 : -1);
});
previewStage.addEventListener('pointercancel', () => { swipeStart = undefined; });
byId('preview-share').addEventListener('click', async () => {
  const item = previewItem;
  const feedback = byId('preview-feedback');
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('resource', item.title);
  const link = item.image && /^https?:$/.test(location.protocol) ? url.href : undefined;
  try {
    if (navigator.share) await navigator.share({ title: item.title, text: item.title, url: link });
    else {
      await navigator.clipboard.writeText(link || item.title);
      if (previewItem === item) feedback.textContent = link ? '已复制素材链接' : '已复制素材名称';
    }
  } catch (error) {
    if (error.name !== 'AbortError' && previewItem === item) feedback.textContent = '暂时无法分享，请重试';
  }
});
preview.addEventListener('close', () => {
  if (!preview.open) byId('preview-stage').replaceChildren();
});
byId('create').addEventListener('click', () => {
  const label = element('label', '', '文件夹名称');
  const input = document.createElement('input');
  input.required = true;
  input.maxLength = 80;
  label.append(input);
  showDialog('新建文件夹', [label], () => {
    const title = input.value.trim();
    if (title) resources.unshift({ title });
    search.value = '';
    render();
  }, '新建');
});
manage.addEventListener('click', () => {
  addContent();
});
const files = byId('files');
byId('upload').addEventListener('click', () => files.click());
byId('empty-upload').addEventListener('click', () => files.click());
files.addEventListener('change', () => {
  for (const file of files.files) {
    const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (pdf || file.type.startsWith('image/')) {
      resources.unshift({ title: file.name, url: URL.createObjectURL(file), pdf });
    }
  }
  files.value = '';
  search.value = '';
  render();
});
dialogForm.addEventListener('submit', event => {
  if (event.submitter?.value === 'confirm') onConfirm?.();
});
function restoreResources() {
  loadFailed = false;
  const url = new URL(location.href);
  url.searchParams.delete('state');
  if (location.protocol !== 'file:') history.replaceState(history.state, '', url);
  render();
  syncScrollState();
}
byId('retry').addEventListener('click', restoreResources);
render();
syncScrollState();
const requestedResource = new URLSearchParams(location.search).get('resource');
const linkedItem = resources.find(item => item.title === requestedResource);
if (!loadFailed && linkedItem) openPreview(linkedItem);
