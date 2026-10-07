// ── Node → Textarea ──────────────────────────────────────────────
// Given a path like ['organization', 'billing'] find the character
// range of that key in the raw JSON string.

export function findKeyRange(
  text: string,
  path: string[]
): { start: number; end: number } | null {
  if (path.length === 0) return { start: 0, end: text.length };

  let searchFrom = 0;

  for (let depth = 0; depth < path.length; depth++) {
    const key = path[depth];
    const pattern = `"${key}"`;
    let idx = text.indexOf(pattern, searchFrom);
    let found = -1;

    while (idx !== -1) {
      // Must be followed (after optional whitespace) by ':'
      const after = text.slice(idx + pattern.length).match(/^\s*:/);
      if (after) {
        found = idx;
        break;
      }
      idx = text.indexOf(pattern, idx + 1);
    }

    if (found === -1) return null;

    if (depth === path.length - 1) {
      // Return the range covering `"key": <value-block>`
      const colon = text.indexOf(':', found + pattern.length);
      // Find end of value: walk to end of the value token/block
      const valueStart = colon + 1;
      const end = findValueEnd(text, valueStart);
      return { start: found, end };
    }

    // Advance into this key's value block
    const colon = text.indexOf(':', found + pattern.length);
    searchFrom = colon + 1;
  }

  return null;
}

function findValueEnd(text: string, from: number): number {
  let i = from;
  // Skip whitespace
  while (i < text.length && /\s/.test(text[i])) i++;
  if (i >= text.length) return from;

  const ch = text[i];

  if (ch === '{' || ch === '[') {
    // Walk matching bracket
    const open = ch;
    const close = ch === '{' ? '}' : ']';
    let depth = 0;
    let inStr = false;
    while (i < text.length) {
      if (!inStr) {
        if (text[i] === open) depth++;
        else if (text[i] === close) { depth--; if (depth === 0) return i + 1; }
        else if (text[i] === '"') inStr = true;
      } else {
        if (text[i] === '\\') { i++; }
        else if (text[i] === '"') inStr = false;
      }
      i++;
    }
    return i;
  }

  if (ch === '"') {
    // String value
    i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '"') return i + 1;
      i++;
    }
    return i;
  }

  // Number / bool / null — read until delimiter
  while (i < text.length && !/[,\}\]\n]/.test(text[i])) i++;
  return i;
}

// ── Textarea → Node ──────────────────────────────────────────────
// Given a cursor position, return the innermost key path at that point.

export function getPathAtCursor(text: string, cursor: number): string[] {
  const before = text.slice(0, cursor);
  const keyStack: (string | null)[] = [];
  let depth = 0;
  let i = 0;

  while (i < before.length) {
    const ch = before[i];

    if (ch === '{' || ch === '[') {
      depth++;
      keyStack.push(null); // placeholder until we see a key
      i++;
      continue;
    }

    if (ch === '}' || ch === ']') {
      keyStack.pop();
      depth--;
      i++;
      continue;
    }

    if (ch === '"') {
      // Read string literal
      let j = i + 1;
      while (j < before.length) {
        if (before[j] === '\\') { j += 2; continue; }
        if (before[j] === '"') break;
        j++;
      }
      const str = before.slice(i + 1, j);
      i = j + 1;

      // Is this a key? — check for ':' after string
      let k = i;
      while (k < before.length && before[k] === ' ') k++;
      if (before[k] === ':') {
        // It's a key at the current depth
        if (depth > 0) keyStack[depth - 1] = str;
      }
      continue;
    }

    i++;
  }

  return keyStack.filter((k): k is string => k !== null);
}

// ── Scroll textarea to selection ─────────────────────────────────
export function scrollTextareaToSelection(
  el: HTMLTextAreaElement,
  start: number,
  end: number
) {
  el.focus();
  el.setSelectionRange(start, end);

  // Estimate line height and scroll position
  const linesBefore = el.value.slice(0, start).split('\n').length - 1;
  const lineHeight = parseInt(getComputedStyle(el).lineHeight || '19', 10);
  const targetScrollTop = linesBefore * lineHeight - el.clientHeight / 3;
  el.scrollTop = Math.max(0, targetScrollTop);
}
