// The texture colors picker (views/sections/_ink-pick.ejs): as drawn, brand color, black, white, one to three own
// colors, a rainbow or a matching palette, plus a pet pattern's size and see-through amount. Its hidden field holds
// the value (textures.cleanInk). Loaded once per page (it used to be repeated in every picker).
if (!window.sgInkPick) {
  window.sgInkPick = function (box) {
    var mode = box.querySelector('.sg-ink-mode').value, n = { one: 1, two: 2, three: 3 }[mode] || 0, cs = box.querySelectorAll('.sg-ink-c');
    cs.forEach(function (c, i) { c.style.display = i < n ? '' : 'none'; });
    var size = box.querySelector('.sg-ink-size'), op = box.querySelector('.sg-ink-op');
    var extra = (size && size.value ? '_' + size.value : '') + (op && op.value !== '100' ? '_o' + op.value : '');
    box.querySelector('input[type=hidden]').value = (n ? Array.prototype.slice.call(cs, 0, n).map(function (c) { return c.value.toLowerCase(); }).join(',') : mode) + extra;
  };
  // the pet pattern extras show only while the background picked next to them is a pet pattern
  window.sgInkPet = function (box) {
    var sel = box.parentElement && box.parentElement.closest('div') && box.parentElement.closest('div').querySelector('select.grad-pick, select[name=block_bg]');
    var on = !!(sel && /^(g-)?txp-/.test(sel.value));
    box.querySelectorAll('.sg-pet-only').forEach(function (x) { x.style.display = on ? '' : 'none'; });
  };
  // a saved value back into the picker (a copied or inserted block)
  window.sgInkSet = function (box, v) {
    var parts = String(v || '').split('_'), base = parts[0], list = /^#/.test(base) ? base.split(',') : [];
    box.querySelector('.sg-ink-mode').value = list.length ? ['one', 'two', 'three'][list.length - 1] : base;
    Array.prototype.forEach.call(box.querySelectorAll('.sg-ink-c'), function (c, i) { if (list[i]) c.value = list[i]; });
    var size = box.querySelector('.sg-ink-size'), op = box.querySelector('.sg-ink-op');
    if (size) size.value = parts.indexOf('s') > 0 ? 's' : parts.indexOf('l') > 0 ? 'l' : '';
    if (op) { var o = parts.filter(function (x) { return /^o\d+$/.test(x); })[0]; op.value = o ? o.slice(1) : '100'; }
    window.sgInkPick(box); window.sgInkPet(box);
  };
  var petAll = function () { document.querySelectorAll('.sg-inkpick').forEach(window.sgInkPet); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', petAll); else petAll();
  document.addEventListener('change', function (e) { if (e.target.matches && e.target.matches('select.grad-pick, select[name=block_bg]')) { var d = e.target.closest('div'); if (d) d.querySelectorAll('.sg-inkpick').forEach(window.sgInkPet); } });
  // capture: the hidden value is set before the editor's own listeners (autosave, preview) read the form
  ['input', 'change'].forEach(function (ev) { document.addEventListener(ev, function (e) { var b = e.target.closest && e.target.closest('.sg-inkpick'); if (b) window.sgInkPick(b); }, true); });
}
