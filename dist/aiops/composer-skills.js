/* AIOps rich composer; the skill catalog and palette belong to Workplace. */
(function (global) {
  'use strict';
  var palette = null;
  function esc(value) { return String(value || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var entrySkills = [{ id: 'create-schedule', name: '新建定时任务' }];
  function skillById(id) { return global.ComposerSlashSkills.skills.concat(entrySkills).filter(function (skill) { return skill.id === id; })[0]; }
  function textOf(parts) { return (parts || []).map(function (part) { return part.type === 'skill' ? (part.id || part.name) : part.text; }).join(''); }
  function parts(field) {
    var result = [];
    function add(text) {
      text = text.replace(/\u00a0/g, ' ');
      if (!text) return;
      var last = result[result.length - 1];
      if (last && last.type === 'text') last.text += text;
      else result.push({ type: 'text', text: text });
    }
    function walk(node) {
      if (node.nodeType === 3) { add(node.nodeValue); return; }
      if (node.nodeType !== 1) return;
      if (node.hasAttribute('data-cui-inline-skill')) {
        var skill = skillById(node.getAttribute('data-cui-inline-skill'));
        if (skill) result.push({ type: 'skill', id: skill.id, name: skill.id });
        return;
      }
      if (node.tagName === 'BR') {
        // The final BR is the browser's caret placeholder, not another draft line.
        if (node.nextSibling) add('\n');
        return;
      }
      if (/^(DIV|P)$/.test(node.tagName) && result.length && !/\n$/.test(textOf(result))) add('\n');
      Array.from(node.childNodes).forEach(walk);
    }
    Array.from(field.childNodes).forEach(walk);
    return result;
  }
  function text(field) { return field ? textOf(parts(field)) : ''; }
  function token(skill) {
    return '<span class="cui-inline-skill" contenteditable="false" data-cui-inline-skill="' + esc(skill.id) + '" aria-label="Skill：' + esc(skill.id) + '">' + global.ComposerSlashSkills.icon() + '<span>' + esc(skill.id) + '</span></span>';
  }
  function html(prompt, savedParts) {
    if (!savedParts) return esc(prompt);
    var legacyText = savedParts.map(function (part) { return part.type === 'skill' ? part.name : part.text; }).join('');
    if (textOf(savedParts) !== prompt && legacyText !== prompt) return esc(prompt);
    return savedParts.map(function (part) {
      var skill = part.type === 'skill' && skillById(part.id);
      return skill ? token(skill) : esc(part.type === 'skill' ? (part.id || part.name) : part.text);
    }).join('');
  }
  function focusEnd(field) {
    field.focus();
    var range = document.createRange(); range.selectNodeContents(field); range.collapse(false);
    var selection = global.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  function trigger(field, character) {
    var selection = global.getSelection();
    if (!selection || !selection.isCollapsed || !selection.rangeCount) return null;
    var caret = selection.getRangeAt(0), node = caret.startContainer;
    if (node.nodeType !== 3 || !field.contains(node)) return null;
    var match = (character === '@' ? /(^|\s)@([^\n@]{0,80})$/ : /(^|\s)\/([^\s/@]{0,40})$/).exec(node.nodeValue.slice(0, caret.startOffset));
    if (!match) return null;
    var range = caret.cloneRange();
    range.setStart(node, caret.startOffset - match[2].length - 1);
    return { query: match[2], range: range };
  }
  function replace(range, value, rich) {
    var selection = global.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    // Browser editing commands keep insertion and deletion in the native undo history.
    document.execCommand(rich ? 'insertHTML' : 'insertText', false, value);
  }
  function removeAdjacentSkill(field, backward) {
    var selection = global.getSelection();
    if (!selection || !selection.isCollapsed || !selection.rangeCount) return false;
    var range = selection.getRangeAt(0), node = range.startContainer, offset = range.startOffset, candidate;
    if (!field.contains(node)) return false;
    if (node.nodeType === 3) {
      var edge = backward ? node.nodeValue.slice(0, offset) : node.nodeValue.slice(offset);
      if (!/^[ \u00a0]*$/.test(edge)) return false;
      candidate = backward ? node.previousSibling : node.nextSibling;
    } else candidate = node.childNodes[backward ? offset - 1 : offset];
    while (candidate && candidate.nodeType === 3 && /^[ \u00a0]*$/.test(candidate.nodeValue)) candidate = backward ? candidate.previousSibling : candidate.nextSibling;
    if (!candidate || candidate.nodeType !== 1 || !candidate.hasAttribute('data-cui-inline-skill')) return false;
    var deletion = range.cloneRange();
    if (backward) deletion.setStartBefore(candidate);
    else {
      var following = candidate.nextSibling;
      if (following && following.nodeType === 3 && /^[ \u00a0]/.test(following.nodeValue)) deletion.setEnd(following, 1);
      else deletion.setEndAfter(candidate);
    }
    selection.removeAllRanges(); selection.addRange(deletion);
    document.execCommand('delete', false);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  function destroy() { if (palette) palette.destroy(); palette = null; if (global.AIOpsContext) global.AIOpsContext.unbind(); }
  function position(menu, field, maximum) {
    var rect = field.closest('.cui-card').getBoundingClientRect();
    var above = rect.top - 12, below = global.innerHeight - rect.bottom - 12;
    var useAbove = above >= Math.min(240, below), width = Math.min(rect.width, global.innerWidth - 24);
    menu.style.width = width + 'px';
    menu.style.maxHeight = Math.max(60, Math.min(maximum || 340, (useAbove ? above : below) - 8)) + 'px';
    menu.style.left = Math.max(12, Math.min(rect.left, global.innerWidth - width - 12)) + 'px';
    menu.style.top = Math.max(8, useAbove ? rect.top - menu.offsetHeight - 8 : rect.bottom + 8) + 'px';
  }
  function bind(root) {
    destroy();
    var field = root.querySelector('.cui-input');
    if (!field) return;
    field.addEventListener('keydown', function (event) {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if ((event.key === 'Backspace' || event.key === 'Delete') && removeAdjacentSkill(field, event.key === 'Backspace')) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    field.addEventListener('beforeinput', function (event) {
      if (!event.isComposing && (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward') && removeAdjacentSkill(field, event.inputType === 'deleteContentBackward')) event.preventDefault();
    });
    field.addEventListener('input', function () {
      if (!field.querySelector('[data-cui-inline-skill]') && !field.textContent && field.innerHTML) field.innerHTML = '';
    });
    field.addEventListener('paste', function (event) {
      event.preventDefault();
      var selection = global.getSelection();
      if (selection && selection.rangeCount) replace(selection.getRangeAt(0), event.clipboardData.getData('text/plain'), false);
    });
    palette = global.ComposerSlashSkills.create({
      input: field, dock: document.body, menuId: 'cui-skill-menu', className: 'cui-slash-menu', trigger: trigger,
      insertMany: function (input, skills, selected) {
        var previous = Array.from(input.querySelectorAll('[data-cui-inline-skill]'));
        replace(selected.range, skills.map(function (skill) { return token(skill); }).join(' ') + ' ', true);
        var inserted = Array.from(input.querySelectorAll('[data-cui-inline-skill]')).filter(function (node) { return previous.indexOf(node) < 0; }).pop();
        if (!inserted) return;
        var trailing = inserted.nextSibling;
        if (!trailing || trailing.nodeType !== 3) { trailing = document.createTextNode(' '); inserted.after(trailing); }
        var caret = document.createRange();
        caret.setStart(trailing, /^[ \u00a0]/.test(trailing.nodeValue) ? 1 : 0); caret.collapse(true);
        var selection = global.getSelection(); selection.removeAllRanges(); selection.addRange(caret);
      },
      position: function (menu) { position(menu, field); }
    });
    if (global.AIOpsContext) global.AIOpsContext.bind(field);
  }
  global.AIOpsComposer = { bind: bind, destroy: destroy, html: html, text: text, parts: parts, textOf: textOf, focusEnd: focusEnd, trigger: trigger, position: position, closeSlash: function () { if (palette) palette.close(); } };
})(window);
