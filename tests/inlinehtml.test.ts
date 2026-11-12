import { test } from 'node:test'; import assert from 'node:assert/strict';
import { inlineToHtml as h } from '../src/lib/inlineHtml.ts';
test('x', () => {
  assert.equal(h('a <b>x</b> & **t**'), 'a &lt;b&gt;x&lt;/b&gt; &amp; <strong>t</strong>');
  assert.equal(h('<span style="color:#e03131">**m**</span>'), '<span style="color:#e03131"><strong>m</strong></span>');
  assert.equal(h('<span style="color:red" onclick="x">a</span>'), '&lt;span style=&quot;color:red&quot; onclick=&quot;x&quot;&gt;a&lt;/span&gt;');
  assert.equal(h('x[^a]', { footnotes: new Map([['a', 3]]) }), 'x<sup class="fn-ref">3</sup>');
  assert.equal(h('[x](javascript:alert(1))'), '[x](javascript:alert(1))');
});
