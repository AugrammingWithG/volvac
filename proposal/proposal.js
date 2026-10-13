/* Stages and costs: every figure in the document is filled in from PLAN, so a price changes in one place. */
(function () {
  'use strict';

  var PLAN = {
    date: '13 October 2026',
    monthWeeks: 4, // one invoiced month on the timeline
    // `month` is the invoice a stage belongs to. The stages in a month should fill it (monthWeeks);
    // the page shows a warning on screen if they do not, or if the months are not equal.
    stages: [
      { name: 'Discovery and design', weeks: 4, cost: 4000, month: 1 },
      { name: '3D production', weeks: 4, cost: 4000, month: 2 },
      { name: 'Build and launch', weeks: 4, cost: 4000, month: 3 }
    ],
    // Marketing runs beside the website, one stage a month, in the same invoice as that month's website stage.
    // A cost of 0 shows as "Included" everywhere. The page warns on screen if the months do not come to the same total.
    marketing: [
      { name: 'Groundwork', cost: 0, month: 1 },
      { name: 'Content and first posts', cost: 0, month: 2 },
      { name: 'Launch campaign', cost: 0, month: 3 }
    ],
    // From the month after launch, marketing continues as one of these. `pick` is the one we recommend.
    marketingPlans: [
      { name: 'Social', price: 650, what: 'Twelve designed posts a month across Instagram, LinkedIn and Facebook, written, scheduled and posted for you. Comments answered, and enquiries passed to your team. A one-page report each month.' },
      { name: 'Social and Search', price: 1200, what: 'Everything in Social, plus four short clips a month made from the 3D models, one article or product page a month written for search, ongoing search fixes across the site, and rankings and enquiries in the monthly report.', pick: true },
      { name: 'Growth', price: 2100, what: 'Everything in Social and Search, plus twenty posts a month, YouTube, and paid campaigns on LinkedIn and Meta set up and run for you. Ad spend is paid to the platforms directly.' }
    ],
    careIncluded: 3, // months of the picked care plan included after launch
    care: [
      { name: 'Lite Care', price: 150, what: 'Hosting checks, uptime monitoring, and small fixes.' },
      { name: 'Standard Care', price: 350, what: 'Everything in Lite, plus regular updates and security patches, support from a real person, and minor changes to text and images on request.', pick: true },
      { name: 'Full Care', price: 650, what: 'Everything in Standard, plus priority support, ongoing feature work, and performance reporting.' }
    ],
    addons: [
      { name: 'AI assistant', price: 900, what: 'Answers product questions from your own pages at any hour, and passes the enquiry to sales or technical support with the details attached.' },
      { name: 'Augmented reality', price: 1500, what: 'Lets a buyer place a machine at true size on their own floor through a phone camera, before they call.' },
      { name: 'Data and analytics', price: 800, what: 'A dashboard showing which makers and pages bring enquiries.' },
      { name: 'Extra pages', price: 200, each: true, what: 'For example, one page for each of the eight industries you serve.' }
    ]
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function money(n) { return 'A$' + Math.round(n).toLocaleString('en-US'); }
  function charge(n) { return n ? money(n) : 'Included'; } // marketing stages that come at no extra cost
  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
  function word(n) { return WORDS[n] || String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function sum(list, f) { return list.reduce(function (a, x) { return a + f(x); }, 0); }

  /* Figures ------------------------------------------------------------ */

  var start = [], t = 0, bad = [];
  PLAN.stages.forEach(function (s, i) { start[i] = t; t += s.weeks; });
  var weeks = t, total = sum(PLAN.stages, function (s) { return s.cost; });
  var mktTotal = sum(PLAN.marketing, function (s) { return s.cost; });
  var months = [];
  PLAN.stages.forEach(function (s) {
    var m = months[s.month - 1] || (months[s.month - 1] = { cost: 0, mkt: 0, weeks: 0, last: 0 });
    m.cost += s.cost; m.weeks += s.weeks;
  });
  PLAN.stages.forEach(function (s, i) { months[s.month - 1].last = i; });
  PLAN.marketing.forEach(function (s) {
    if (!months[s.month - 1]) bad.push('Marketing stage "' + s.name + '" is in month ' + s.month + ', which has no website stage');
    else months[s.month - 1].mkt += s.cost;
  });
  months.forEach(function (m, j) {
    if (m.cost !== months[0].cost) bad.push('Month ' + (j + 1) + ' comes to ' + money(m.cost) + ', month 1 to ' + money(months[0].cost));
    if (m.mkt !== months[0].mkt) bad.push('Marketing in month ' + (j + 1) + ' comes to ' + money(m.mkt) + ', in month 1 to ' + money(months[0].mkt));
    if (m.weeks !== PLAN.monthWeeks) bad.push('Month ' + (j + 1) + ' holds ' + m.weeks + ' weeks of stages, a month is ' + PLAN.monthWeeks);
  });
  if (bad.length) { var w = $('#warn'); w.hidden = false; w.textContent = 'Check PLAN in proposal.js. ' + bad.join('. ') + '.'; }

  function runs(i) {
    var a = start[i] + 1, b = start[i] + PLAN.stages[i].weeks;
    return a === b ? 'Week ' + a : 'Weeks ' + a + ' to ' + b;
  }
  var pick = PLAN.care.filter(function (c) { return c.pick; })[0] || PLAN.care[0];
  var mktPick = PLAN.marketingPlans.filter(function (c) { return c.pick; })[0] || PLAN.marketingPlans[0];
  var V = {
    date: PLAN.date, zero: money(0), total: money(total), weeks: String(weeks),
    months: String(months.length), 'months.words': word(months.length), 'months.words.cap': cap(word(months.length)),
    'months.after1': word(months.length - 1), 'month.cost': money(months[0].cost), 'month.weeks.words': word(PLAN.monthWeeks),
    'month.total': money(months[0].cost + months[0].mkt), 'mkt.cost': charge(months[0].mkt), 'mkt.total': charge(mktTotal),
    'mkt.from': word(months.length + 1), 'mkt.pick.name': mktPick.name, 'mkt.pick.price': money(mktPick.price),
    'care.pick.name': pick.name, 'care.free.words': word(PLAN.careIncluded), 'care.free.words.cap': cap(word(PLAN.careIncluded)),
    'care.free.value': money(pick.price * PLAN.careIncluded)
  };
  PLAN.stages.forEach(function (s, i) {
    var k = 's' + (i + 1);
    V[k + '.cost'] = money(s.cost); V[k + '.runs'] = runs(i); V[k + '.month'] = 'Month ' + s.month;
    V[k + '.closes'] = months[s.month - 1].last === i ? 'This closes month ' + s.month + '.' : '';
  });
  PLAN.marketing.forEach(function (s, i) {
    var k = 'm' + (i + 1);
    V[k + '.name'] = s.name; V[k + '.cost'] = charge(s.cost); V[k + '.month'] = 'Month ' + s.month;
  });
  $$('[data-v]').forEach(function (e) { var v = V[e.dataset.v]; e.textContent = v == null ? '?' : v; });

  /* Care plans and options: rows of name, price, what it covers ---------- */

  function planRows(holder, list, suffix, tag) {
    list.forEach(function (c) {
      var row = el('div', c.pick ? 'is-pick' : ''), dt = el('dt');
      dt.appendChild(el('b', '', c.name));
      dt.appendChild(el('span', 'price', money(c.price) + (c.each ? ' each' : suffix)));
      if (c.pick && tag) dt.appendChild(el('i', '', tag));
      row.appendChild(dt); row.appendChild(el('dd', '', c.what)); holder.appendChild(row);
    });
  }
  planRows($('#plans'), PLAN.care, ' a month', 'First ' + word(PLAN.careIncluded) + ' months included');
  planRows($('#mkt-plans'), PLAN.marketingPlans, ' a month', 'Recommended');
  planRows($('#addons'), PLAN.addons, '');

  /* Timeline: a steel rule, one major division per week ------------------ */

  (function () {
    var rule = $('#rule'), spans = el('div', 'rule__spans'), ticks = el('div', 'rule__ticks'), nums = el('div', 'rule__nums'), bills = el('div', 'rule__bills');
    var pre = el('div', 'rule__pre');
    pre.appendChild(el('b', '', 'Concept')); pre.appendChild(el('span', 'price', money(0))); pre.appendChild(el('i', '', 'Done'));
    var post = el('div', 'rule__post');
    post.appendChild(el('b', '', 'Care')); post.appendChild(el('span', 'price', money(0))); post.appendChild(el('i', '', PLAN.careIncluded + ' months included'));
    PLAN.stages.forEach(function (s, i) {
      var sp = el('div', 'rule__span' + (s.weeks > 1 ? ' is-wide' : '')); sp.style.width = (s.weeks / weeks * 100) + '%';
      sp.appendChild(el('b', '', s.name)); sp.appendChild(el('span', 'price', money(s.cost))); sp.appendChild(el('i', '', 'Stage ' + (i + 1)));
      spans.appendChild(sp);
    });
    var per = 5, count = weeks * per;
    for (var k = 0; k <= count; k++) { var tk = el('i', k % per === 0 ? 'l' : ''); tk.style.left = (k / count * 100) + '%'; ticks.appendChild(tk); }
    nums.appendChild(el('b', '', 'Today'));
    for (var wk = 1; wk <= weeks; wk++) { var nm = el('span', '', wk === 1 ? 'Week 1' : String(wk)); nm.style.left = ((wk - 0.5) / weeks * 100) + '%'; nums.appendChild(nm); }
    // Marketing runs under the weeks of the month it shares with a website stage.
    var lane = el('div', 'rule__bills rule__lane');
    lane.appendChild(el('b', '', 'Marketing'));
    PLAN.marketing.forEach(function (s) {
      var d = el('div'); d.style.width = (months[s.month - 1].weeks / weeks * 100) + '%';
      d.appendChild(el('span', '', s.name)); d.appendChild(el('span', 'price', charge(s.cost)));
      lane.appendChild(d);
    });
    bills.appendChild(el('b', '', 'Invoiced'));
    months.forEach(function (m, j) {
      var bl = el('div'); bl.style.width = (m.weeks / weeks * 100) + '%';
      bl.appendChild(el('span', '', 'Month ' + (j + 1))); bl.appendChild(el('span', 'price', money(m.cost + m.mkt)));
      bills.appendChild(bl);
    });
    var body = el('div', 'rule__body');
    body.appendChild(spans); body.appendChild(ticks); body.appendChild(el('div', 'rule__index')); body.appendChild(nums); body.appendChild(lane); body.appendChild(bills);
    rule.appendChild(pre); rule.appendChild(body); rule.appendChild(post);
  })();

  /* Invoices against stages ---------------------------------------------- */

  (function () {
    // One column for each website stage, then one for each marketing stage when marketing is charged for.
    var cols = PLAN.stages.map(function (s, i) { return { s: s, label: 'Stage ' + (i + 1) }; })
      .concat(mktTotal ? PLAN.marketing.map(function (s, i) { return { s: s, label: 'Marketing ' + (i + 1), mkt: true }; }) : []);
    var tb = $('#tally'), head = el('tr');
    head.appendChild(el('th', '', 'Invoice'));
    cols.forEach(function (c) { var th = el('th', 'n' + (c.mkt ? ' mkt' : '')); th.appendChild(el('span', '', c.label)); th.appendChild(el('small', '', c.s.name)); head.appendChild(th); });
    head.appendChild(el('th', 'n sum', 'Invoice total'));
    var thead = el('thead'); thead.appendChild(head); tb.appendChild(thead);
    var body = el('tbody'), wk = 0;
    months.forEach(function (m, j) {
      var tr = el('tr'), th = el('th'); th.appendChild(el('span', '', 'Month ' + (j + 1)));
      th.appendChild(el('small', '', 'Weeks ' + (wk + 1) + ' to ' + (wk + m.weeks) + ', issued at the start')); wk += m.weeks; tr.appendChild(th);
      cols.forEach(function (c) { var on = c.s.month === j + 1; tr.appendChild(el('td', (on ? 'n' : 'n nil') + (c.mkt ? ' mkt' : ''), on ? money(c.s.cost) : '0')); });
      tr.appendChild(el('td', 'n sum', money(m.cost + m.mkt))); body.appendChild(tr);
    });
    tb.appendChild(body);
    var foot = el('tfoot'), fr = el('tr'); fr.appendChild(el('th', '', 'Stage cost'));
    cols.forEach(function (c) { fr.appendChild(el('td', 'n' + (c.mkt ? ' mkt' : ''), money(c.s.cost))); });
    fr.appendChild(el('td', 'n sum', money(total + mktTotal))); foot.appendChild(fr); tb.appendChild(foot);
  })();

  /* Page furniture: mark, running foot, and the scale on the right edge -- */

  var MARK = '<svg viewBox="0 0 252 48" width="168" height="32" aria-hidden="true"><circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="7"/><path class="needle" d="M22.2 23 L25.8 25.6 L34.5 11.5 Z"/><text x="54" y="38" font-size="34">Volvac</text></svg>';
  var pages = $$('.page');
  pages.forEach(function (p, i) {
    var head = el('header', 'head');
    head.innerHTML = '<span class="mark">' + MARK + '</span><span class="by">Stages and costs</span>';
    p.insertBefore(head, p.firstChild);
    var foot = el('footer', 'foot');
    foot.appendChild(el('span', '', 'SocialHat for Volvac'));
    foot.appendChild(el('span', 'num', (i + 1) + ' / ' + pages.length));
    p.appendChild(foot);
    var sc = el('aside', 'scale'), html = '', N = 60;
    for (var k = 0; k <= N; k++) html += '<i class="' + (k % 10 === 0 ? 'l' : k % 5 === 0 ? 'm' : '') + '" style="top:' + (k / N * 100) + '%"></i>';
    var at = pages.length > 1 ? i / (pages.length - 1) : 0;
    sc.innerHTML = html + '<b style="top:' + (at * 100) + '%"></b><span style="top:' + (at * 100) + '%">' + p.dataset.name + '</span>';
    p.appendChild(sc);
  });

  /* Stills from the 3D scene --------------------------------------------- */

  function poses(scene) {
    var K = scene.keys, MK = scene.makers, zc = MK.z0 + 4.5 * MK.dz;
    function from(k, m, sx, sy, extra) {
      var key = K[k], o = { p: key.p.map(function (c, i) { return key.t[i] + (c - key.t[i]) * m; }), t: key.t.slice(), sx: sx, sy: sy || 0 };
      for (var name in extra) o[name] = extra[name];
      return o;
    }
    return {
      cover: from(0, 1.02, 0.26, 0.03, { ink: true, needle: 0.012 }),
      next: from(9, 1.3, 0.25, 0.02, { ink: true, needle: 0, loose: false }),
      inkplate: { p: [-24, 13, 52], t: [-30, 0, 22], sx: 0, sy: 0, ink: true, loose: false },
      mark: from(3, 1.22, -0.27, 0.12, { act: { 3: 1 }, ink: 'off' }),
      blocks: from(8, 0.9, 0.27, -0.02, { ink: 'off' }),
      balance: from(4, 1.36, -0.25, 0.03, { act: { 4: 0.7 }, ink: 'off' }),
      leak: from(1, 1.42, 0.235, 0.02, { act: { 1: 1 }, ink: 'off' }),
      pack: from(5, 1.45, -0.25, 0.08, { act: { 5: 1 }, ink: 'off' }),
      gauges: { p: [K[2].t[0] - 9, 17, 45], t: [K[2].t[0], 5.4, 0], sx: 0.2, sy: 0, act: { 2: 1 }, ink: 'off' },
      packer: from(5, 1.6, 0.25, 0.06, { act: { 5: 0.65 }, ink: 'off' }),
      makers: { p: [MK.x, 46, zc + 20], t: [MK.x, 0, zc], sx: 0.2, sy: 0 }
    };
  }
  function proofs(scene) {
    var K = scene.keys;
    return [1, 2, 3, 4, 5].map(function (k) {
      var key = K[k], act = {}; act[k] = k === 4 ? 0.7 : k === 5 ? 0.45 : 1;
      return { p: key.p.map(function (c, i) { return key.t[i] + (c - key.t[i]) * 1.08; }), t: key.t.slice(), sx: 0, sy: 0.02, act: act, ink: 'off' };
    });
  }
  function grab(scene, o, w, h) {
    o.w = w; o.h = h;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(scene.shot(o), 0, 0);
    return c.toDataURL('image/jpeg', 0.9);
  }

  function stills() {
    var scene;
    try { scene = window.QMScene.create(document.createElement('canvas')); } catch (e) { scene = null; }
    if (!scene) { document.body.classList.add('no-3d'); window.__ready = true; return; }
    var P = poses(scene), jobs = [];
    $$('.page[data-still]').forEach(function (p) {
      jobs.push(function () {
        var img = new Image(); img.className = 'plate'; img.alt = '';
        img.src = grab(scene, P[p.dataset.still], 2246, 1588);
        p.insertBefore(img, p.firstChild);
      });
    });
    var strip = $('#proofs');
    ['Leak, flow and pressure', 'Refrigeration', 'Marking', 'Balancing', 'Packaging'].forEach(function (name, i) {
      jobs.push(function () {
        var li = el('li'), img = new Image(); img.alt = name;
        img.src = grab(scene, proofs(scene)[i], 600, 384);
        li.appendChild(img); li.appendChild(el('span', '', name)); strip.appendChild(li);
      });
    });
    // The sample posts in Volvac's current brand, drawn by the same code as samples.html.
    var S = window.VolvacSamples, wall = $('#sample-posts');
    if (S && wall) S.posts.forEach(function (post, i) {
      jobs.push(function () {
        var full = S.draw(scene, i, 'portrait'), c = document.createElement('canvas'); c.width = 720; c.height = 900;
        c.getContext('2d').drawImage(full, 0, 0, c.width, c.height);
        var li = el('li'), img = new Image(); img.alt = post.alt; img.src = c.toDataURL('image/jpeg', 0.9);
        li.appendChild(img); wall.appendChild(li);
      });
    });
    (function next() {
      if (!jobs.length) { window.__ready = true; return; }
      jobs.shift()(); setTimeout(next, 20);
    })();
  }

  var ready = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('400 30px Archivo'), document.fonts.load('600 40px Archivo'), document.fonts.load('800 40px Archivo')])
    : Promise.resolve();
  if (window.VolvacSamples) ready = Promise.all([ready, window.VolvacSamples.ready]);
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 2000); })]).then(stills, stills);
})();
