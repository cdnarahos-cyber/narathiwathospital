Warning: truncated output (original token count: 28658)
Total output lines: 1090

import { getDashboardData } from './services/dashboard-service.js';
import { downloadCleanPdf } from './services/clean-pdf-generator.js';
import { enableHistoryAreaFilter } from './components/history-area-filter.js';
import { addNarathiwatBoundaries } from './components/narathiwat-boundaries.js';
import { shell } from './components/layout.js'; import { metricsGrid } from './components/metrics.js'; import { analytics } from './components/charts.js'; import { caseTracking } from './components/case-tracking.js'; import { rightRail } from './components/alerts.js'; import { moduleView, diseaseMeta, investigationForm } from './components/modules.js';
const data = await getDashboardData();
const escapeOverview = value => String(value ?? '-').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const overviewCases = () => {
  let investigations=[], reports=[];
  try { investigations=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); } catch { investigations=[]; }
  try { reports=JSON.parse(localStorage.getItem('ndss-506-records') || '[]'); } catch { reports=[]; }
  const imported=reports.map(row => ({
    ...row,
    location:row.location || [row.tambon,row.district].filter(Boolean).join(' '),
    subdistrict:row.subdistrict || row.tambon,
    createdAt:row.importedAt || row.onset || '',
    updatedAt:row.importedAt || row.onset || '',
    source:'506'
  }));
  return [...investigations.map(row=>({...row,source:'investigation'})),...imported];
};
const countBy = (items, key, fallback = 'ไม่ระบุ') => items.reduce((all, item) => { const value = String(item[key] || fallback).trim() || fallback; all[value] = (all[value] || 0) + 1; return all; }, {});
const rankedRows = (records, key, unit = 'ราย') => Object.entries(countBy(records, key)).sort((a,b) => b[1] - a[1]).map(([label,value]) => `<div><b>${escapeOverview(label)}</b><span><i style="width:${Math.max(8, value / Math.max(...Object.values(countBy(records,key)), 1) * 100)}%"></i></span><strong>${value} ${unit}</strong></div>`).join('');
const overviewDashboard = () => {
  const cases = overviewCases();
  const importedCount=cases.filter(item=>item.source==='506').length;
  const investigationCount=cases.filter(item=>item.source==='investigation').length;
  const asOf = cases.reduce((latest, item) => !latest || String(item.updatedAt || item.createdAt || '') > String(latest.updatedAt || latest.createdAt || '') ? item : latest, null);
  const asOfText = asOf ? new Date(asOf.updatedAt || asOf.createdAt).toLocaleString('th-TH') : 'ยังไม่มีข้อมูล';
  const deaths = cases.filter(item => String(item.outcome || '').includes('เสียชีวิต')).length;
  const cfr = cases.length ? `${(deaths / cases.length * 100).toFixed(2)} ร้อยละ` : 'ยังไม่มีข้อมูล';
  const empty = message => `<section class="work-panel epi-empty"><strong>ยังไม่มีข้อมูล</strong><p>${message}</p></section>`;
  const tabs = [['situation','สถานการณ์โรค'],['trend','Trend'],['curve','Epidemic Curve'],['person','Person'],['place','Place'],['time','Time']];
  const disease = cases.length ? `<section class="work-panel"><div class="panel-top"><h2>จำนวนผู้ป่วยจำแนกตามโรค</h2><small>รง.506 ${importedCount} ราย · แบบสอบสวน ${investigationCount} ราย</small></div><div class="epi-disease-list">${rankedRows(cases,'disease')}</div></section>` : empty('ยังไม่มีข้อมูล รง.506 หรือเคสที่บันทึกจากระบบแบบสอบสวนโรคออนไลน์');
  const year = new Date().getFullYear();
  const trend = cases.length ? `<section class="work-panel"><h2>จำนวนผู้ป่วยรายเดือนย้อนหลัง 3 ปี</h2><small>Legend: ${[year-2,year-1,year].map((y,i)=>`<i class="epi-year y${i}"></i> ${y+543}`).join('　')}</small><div class="epi-month-chart">${Array.from({length:12},(_,month)=>{ const values=[year-2,year-1,year].map(y=>cases.filter(item=>{ const d=new Date(item.onset || item.createdAt); return !Number.isNaN(d) && d.getFullYear()===y && d.getMonth()===month; }).length); return `<div><span>${values.map((v,i)=>`<b class="y${i}" style="height:${Math.max(3,v*12)}px" title="${v} ราย"></b>`).join('')}</span><small>${month+1}</small></div>`; }).join('')}</div><p class="epi-note">กราฟแสดงจำนวนเคสที่มีวันเริ่มป่วยหรือวันบันทึกอยู่ในแต่ละเดือน</p></section>` : empty('ต้องมีวันเริ่มป่วยหรือวันบันทึกจึงจะแสดงกราฟย้อนหลังได้');
  const dated = cases.filter(item => item.onset || item.createdAt);
  const weekKey = item => { const d=new Date(item.onset || item.createdAt); const first=new Date(d.getFullYear(),0,1); return `${d.getFullYear()}-W${String(Math.ceil((((d-first)/86400000)+first.getDay()+1)/7)).padStart(2,'0')}`; };
  const weekRows = Object.entries(countBy(dated.map(item => ({ week:weekKey(item) })),'week')).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
  const curve = weekRows.length ? `<section class="work-panel"><h2>Epidemic Curve · สัปดาห์เริ่มป่วย</h2><div class="epi-bars">${weekRows.map(([label,value])=>`<div><b style="height:${Math.max(8,value*16)}px"></b><small>${label}</small></div>`).join('')}</div><p class="epi-note">รูปแบบการกระจายแสดงเชิงพรรณนาตามสัปดาห์เริ่มป่วยเท่านั้น และยังไม่สรุปสาเหตุหรือรูปแบบการระบาด</p></section>` : empty('ยังไม่มีวันเริ่มป่วยหรือวันบันทึกสำหรับจัดกลุ่มตามสัปดาห์');
  const ageBand = item => { const age=Number(item.age); if(!Number.isFinite(age)) return 'ไม่ระบุ'; return age<5?'0–4 ปี':age<15?'5–14 ปี':age<60?'15–59 ปี':'60 ปีขึ้นไป'; };
  const person = cases.length ? `<section class="epi-split"><article class="work-panel"><h2>Person · กลุ่มอายุ</h2><div class="epi-disease-list">${rankedRows(cases.map(item=>({...item,ageBand:ageBand(item)})),'ageBand')}</div></article><article class="work-panel"><h2>Person · เพศและสัญชาติ</h2><div class="epi-disease-list">${rankedRows(cases,'sex')}${rankedRows(cases,'nationality')}</div><p class="epi-note">แสดงตามข้อมูลที่บันทึกในแบบสอบสวนโรค</p></article></section>` : empty('ยังไม่มีข้อมูลบุคคลจากแบบสอบสวนโรค');
  const place = cases.length ? `<section class="work-panel"><h2>Place · การกระจายเชิงพื้นที่</h2><p class="epi-limit">ขอบเขตข้อมูลปัจจุบัน: ระดับอำเภอจากแบบสอบสวนโรคออนไลน์เท่านั้น จึงจัดอันดับเฉพาะภายในขอบเขตนี้ และไม่เปรียบเทียบข้ามระดับพื้นที่</p><div class="epi-disease-list">${rankedRows(cases,'district')}</div><p class="epi-note">ตัวเลขในวงเล็บหมายถึงจำนวนผู้ป่วย (ราย); ยังไม่มีฐานประชากรสำหรับคำนวณอัตราป่วยต่อประชากรแสนคน</p></section>` : empty('ยังไม่มีข้อมูลพื้นที่ที่บันทึกในแบบสอบสวนโรค');
  const time = weekRows.length ? `<section class="work-panel"><h2>Time · แนวโน้มรายสัปดาห์</h2><div class="epi-bars">${weekRows.map(([label,value])=>`<div><b style="height:${Math.max(8,value*16)}px"></b><small>${label}</small></div>`).join('')}</div><p class="epi-note">ยังไม่มีข้อมูลครบ 5 ปีย้อนหลัง จึงยังไม่สามารถเปรียบเทียบกับค่ามัธยฐาน 5 ปีได้ การแสดงผลนี้เป็นเพียงแนวโน้มเชิงพรรณนาตามเวลา</p></section>` : empty('ยังไม่มีข้อมูลตามสัปดาห์สำหรับการแสดงแนวโน้มเวลา');
  return `<div class="module-page overview-page"><section class="module-head"><div><h1>Dashboard</h1><p>ภาพรวมสถานการณ์จากข้อมูล ณ วันที่: ${asOfText}</p></div></section><section class="epi-dashboard"><div class="epi-tabs" role="tablist">${tabs.map(([id,label],index)=>`<button type="button" class="${index===0?'active':''}" data-epi-tab="${id}" role="tab">${label}</button>`).join('')}</div><div class="epi-pane active" data-epi-pane="situation"><p class="epi-standard">ข้อมูลจากการเฝ้าระวังโรค จากระบบเฝ้าระวังโรคดิจิทัล (Digital Disease Surveillance; DDS)</p><div class="module-cards"><article class="blue"><span>จำนวนผู้ป่วยสะสม</span><strong>${cases.length} ราย</strong><small>หน่วย: ราย</small></article><article><span>อัตราป่วย</span><strong>ยังไม่มีข้อมูล</strong><small>ต่อประชากรแสนคน · ต้องมีฐานประชากร</small></article><article class="red"><span>ผู้เสียชีวิต / อัตราตาย</span><strong>${deaths} ราย</strong><small>ต่อประชากรแสนคน: ยังไม่มีข้อมูล</small></article><article class="orange"><span>อัตราป่วยตาย (CFR)</span><strong>${cfr}</strong><small>หน่วย: ร้อยละ</small></article></div>${disease}</div><div class="epi-pane" data-epi-pane="trend" hidden>${trend}</div><div class="epi-pane" data-epi-pane="curve" hidden>${curve}</div><div class="epi-pane" data-epi-pane="person" hidden>${person}</div><div class="epi-pane" data-epi-pane="place" hidden>${place}</div><div class="epi-pane" data-epi-pane="time" hidden>${time}</div></section></div>`;
};
document.querySelector('#app').innerHTML = shell(overviewDashboard());
const root = document.querySelector('#module-root');
enableHistoryAreaFilter(root);
const readLocalList = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const updateNotificationBadge = () => {
  const tasks=readLocalList('ndss-response-tasks');
  const labs=readLocalList('ndss-lab-results');
  const contacts=readLocalList('ndss-case-contacts');
  const reports=readLocalList('ndss-506-records');
  const today=new Date().toISOString().slice(0,10);
  const overdue=tasks.filter(item=>item.status!=='ควบคุมแล้ว' && item.dueDate && item.dueDate<today).length;
  const waiting=tasks.filter(item=>item.status==='รอรับทราบ').length;
  const positive=labs.filter(item=>item.result==='Positive').length;
  const incomplete=reports.filter(item=>!item.disease || !(item.tambon || item.district) || !item.onset).length;
  const symptomaticContacts=contacts.filter(item=>item.symptom==='มีอาการ' && item.followup!=='ติดตามครบแล้ว').length;
  const total=overdue+waiting+positive+incomplete+symptomaticContacts;
  const badge=document.querySelector('.notification i');
  const button=document.querySelector('.notification');
  if(badge) badge.textContent=String(total);
  if(button) button.setAttribute('aria-label',total ? `การแจ้งเตือน ${total} รายการ` : 'การแจ้งเตือน ไม่มีรายการค้าง');
};
updateNotificationBadge();

const enhanceAlertFilters = () => {
  const feed = root.querySelector('.alert-feed');
  const panel = feed?.closest('.work-panel');
  const panelTop = panel?.querySelector('.panel-top');
  if (!feed || !panel || !panelTop || panel.querySelector('[data-alert-filter-controls]')) return;

  const controls = document.createElement('div');
  controls.className = 'alert-filter-controls';
  controls.dataset.alertFilterControls = 'true';
  const allCount = feed.querySelectorAll('article').length;
  const acknowledgedCount = feed.querySelectorAll('article.acknowledged').length;
  const activeCount = allCount - acknowledgedCount;
  controls.innerHTML = `
    <button type="button" data-alert-filter="all">ทั้งหมด <span>${allCount}</span></button>
    <button type="button" class="active" data-alert-filter="active">ยังไม่รับทราบ <span>${activeCount}</span></button>
    <button type="button" data-alert-filter="acknowledged">รับทราบแล้ว <span>${acknowledgedCount}</span></button>
    <input class="table-search" data-alert-search placeholder="ค้นหาโรค พื้นที่ หรือประเภทแจ้งเตือน" aria-label="ค้นหารายการแจ้งเตือน" />
  `;
  panelTop.append(controls);
  applyAlertFilter('active');
};

const applyAlertFilter = filter => {
  const feed = root.querySelector('.alert-feed');
  if (!feed) return;
  const query = root.querySelector('[data-alert-search]')?.value.trim().toLocaleLowerCase('th-TH') || '';
  feed.querySelectorAll('article').forEach(article => {
    const matchState = filter === 'all'
      ? true
      : filter === 'acknowledged'
        ? article.classList.contains('acknowledged')
        : !article.classList.contains('acknowledged');
    article.hidden = !matchState || Boolean(query && !article.textContent.toLocaleLowerCase('th-TH').includes(query));
  });
  let emptyState = feed.querySelector('.alert-filter-empty');
  const visible = [...feed.querySelectorAll('article')].some(article => !article.hidden);
  if (!visible && !emptyState) {
    emptyState = document.createElement('p');
    emptyState.className = 'alert-filter-empty';
    emptyState.textContent = 'ไม่มีรายการในตัวกรองนี้';
    feed.append(emptyState);
  }
  if (emptyState) emptyState.hidden = visible;
};

const filterKnowledge = () => {
  const search = root.querySelector('[data-knowledge-search]');
  const category = root.querySelector('[data-knowledge-category]');
  if (!search || !category) return;
  const term = search.value.trim().toLocaleLowerCase('th-TH');
  let visible = 0;
  root.querySelectorAll('[data-knowledge-topic]').forEach(topic => {
    const match = (!term || topic.textContent.toLocaleLowerCase('th-TH').includes(term))
      && (!category.value || topic.dataset.knowledgeCategory === category.value);
    topic.hidden = !match;
    if (match) visible += 1;
  });
  const empty = root.querySelector('[data-knowledge-empty]');
  if (empty) empty.hidden = visible > 0;
};

const filterSettings = () => {
  const search = root.querySelector('[data-settings-search]');
  if (!search) return;
  const term = search.value.trim().toLocaleLowerCase('th-TH');
  let visible = 0;
  root.querySelectorAll('[data-settings-item]').forEach(item => {
    const match = !term || item.textContent.toLocaleLowerCase('th-TH').includes(term);
    item.hidden = !match;
    if (match) visible += 1;
  });
  const empty = root.querySelector('[data-settings-empty]');
  if (empty) empty.hidden = visible > 0;
};

const filterAudit = () => {
  const search = root.querySelector('[data-audit-search]');
  if (!search) return;
  const term = search.value.trim().toLocaleLowerCase('th-TH');
  const category = root.querySelector('[data-audit-category]')?.value || '';
  const categoryOf = action => {
    if (/ส่งออก|สำรอง/.test(action)) return 'export';
    if (/นำเข้า|กู้คืน/.test(action)) return 'import';
    if (/ลบ|ล้าง/.test(action)) return 'delete';
    if (/บันทึก|มอบหมาย|ปิด|รับทราบ/.test(action)) return 'save';
    return 'other';
  };
  let visible = 0;
  root.querySelectorAll('[data-audit-row]').forEach(row => {
    const match = (!term || row.textContent.toLocaleLowerCase('th-TH').includes(term))
      && (!category || categoryOf(row.dataset.auditAction || '') === category);
    row.hidden = !match;
    if (match) visible += 1;
  });
  const empty = root.querySelector('[data-audit-empty]');
  if (empty) empty.hidden = visible > 0;
};

const filter506Report = () => {
  const search = root.querySelector('[data-506-report-search]');
  const rows = root.querySelectorAll('[data-506-report-rows] tr');
  if (!search || !rows.length) return;
  const term = search.value.trim().toLocaleLowerCase('th-TH');
  let visible = 0;
  rows.forEach(row => {
    const match = !term || row.textContent.toLocaleLowerCase('th-TH').includes(term);
    row.hidden = !match;
    if (match) visible += 1;
  });
  const empty = root.querySelector('[data-506-report-empty]');
  if (empty) empty.hidden = visible > 0;
};

const filterLabRows = () => {
  const keyword = root.querySelector('[data-lab-search]')?.value.trim().toLocaleLowerCase('th-TH') || '';
  const status = root.querySelector('[data-lab-status-filter]')?.value || '';
  root.querySelectorAll('[data-lab-rows] tr').forEach(row => {
    const matchText = !keyword || row.textContent.toLocaleLowerCase('th-TH').includes(keyword);
    const matchStatus = !status || row.textContent.includes(status);
    row.hidden = !(matchText && matchStatus);
  });
};

const enhanceLabFilters = () => {
  const search = root.querySelector('[data-lab-search]');
  const panelTop = search?.closest('.panel-top');
  if (!search || !panelTop || panelTop.querySelector('[data-lab-status-filter]')) return;
  const filter = document.createElement('select');
  filter.className = 'table-search';
  filter.setAttribute('data-lab-status-filter', 'true');
  filter.setAttribute('aria-label', 'คัดกรองผลตรวจ');
  filter.innerHTML = '<option value="">ทุกผลตรวจ</option><option value="Positive">Positive</option><option value="Negative">Negative</option><option value="รอตรวจสอบ">รอตรวจสอบ</option><option value="ไม่สามารถทดสอบได้">ไม่สามารถทดสอบได้</option>';
  panelTop.append(filter);
};

const trackingPanel = () => [...root.querySelectorAll('.work-panel')].find(panel => panel.querySelector('.panel-top h2')?.textContent.includes('Follow-up / Case Closure'));
const filterTrackingRows = () => {
  const panel = trackingPanel();
  if (!panel) return;
  const keyword = panel.querySelector('[data-tracking-search]')?.value.trim().toLocaleLowerCase('th-TH') || '';
  const status = panel.querySelector('[data-tracking-status]')?.value || '';
  panel.querySelectorAll('tbody tr').forEach(row => {
    const text = row.textContent.toLocaleLowerCase('th-TH');
    row.hidden = Boolean((keyword && !text.includes(keyword)) || (status && !text.includes(status)));
  });
};
const enhanceTrackingFilters = () => {
  const panel = trackingPanel();
  const panelTop = panel?.querySelector('.panel-top');
  if (!panelTop || panelTop.querySelector('[data-tracking-search]')) return;
  const tools = document.createElement('div');
  tools.className = 'panel-tools';
  tools.innerHTML = '<input class="table-search" data-tracking-search placeholder="ค้นหาเคสหรือผู้รับผิดชอบ" /><select class="table-search" data-tracking-status aria-label="คัดกรองสถานะงาน"><option value="">ทุกสถานะ</option><option value="รอรับทราบ">รอรับทราบ</option><option value="กำลังดำเนินการ">กำลังดำเนินการ</option><option value="ควบคุมแล้ว">ปิดเคสแล้ว</option></select>';
  panelTop.append(tools);
};
const enhanceTrackingSummary = () => {
  const label = root.querySelector('.tracking-workflow article:nth-child(3) span');
  if (label?.textContent.includes('งานกำลังดำเนินการ')) label.textContent = label.textContent.replace('งานกำลังดำเนินการ', 'งานยังไม่ปิด');
};
const enhanceSettingsHealth = () => {
  const heading = root.querySelector('.command-head h1');
  if (heading?.textContent !== 'ตั้งค่าและสถานะระบบ' || root.querySelector('[data-settings-health]')) return;
  const rows = commandRecords(), cases = commandCases();
  let tasks = [], labs = [];
  try { tasks = JSON.parse(localStorage.getItem('ndss-response-tasks') || '[]'); labs = JSON.parse(localStorage.getItem('ndss-lab-results') || '[]'); } catch { /* show zero counts */ }
  const incomplete = rows.filter(row => !row.disease || !row.onset || !(row.tambon || row.district)).length;
  const items = [
    ['ข้อมูล รง.506', `${rows.length} ราย`, incomplete ? `ควรตรวจสอบ ${incomplete} รายการ` : 'ข้อมูลสำคัญครบตามเกณฑ์', incomplete ? 'orange' : 'blue'],
    ['แบบสอบสวน', `${cases.length} เคส`, 'เก็บในอุปกรณ์ปัจจุบัน', 'green'],
    ['งานติดตาม', `${tasks.length} งาน`, `${tasks.filter(task => task.status !== 'ควบคุมแล้ว').length} งานยังไม่ปิด`, 'purple'],
    ['ผล LAB', `${labs.length} รายการ`, `${labs.filter(item => item.result === 'Positive').length} ผล Positive`, 'red']
  ];
  const section = document.createElement('section');
  section.className = 'command-stats';
  section.setAttribute('data-settings-health', 'true');
  items.forEach(([label, value, note, tone]) => {
    const card = document.createElement('article'); card.className = tone;
    const labelNode = document.createElement('span'); labelNode.textContent = label;
    const valueNode = document.createElement('strong'); valueNode.textContent = value;
    const noteNode = document.createElement('small'); noteNode.textContent = note;
    card.append(labelNode, valueNode, noteNode); section.append(card);
  });
  heading.closest('.command-head')?.after(section);
};
const enhanceSettingsPreflight = () => {
  const heading = root.querySelector('.command-head h1');
  const health = root.querySelector('[data-settings-health]');
  if (heading?.textContent !== 'ตั้งค่าและสถานะระบบ' || !health || root.querySelector('[data-settings-preflight]')) return;
  const section = document.createElement('section');
  section.className = 'work-panel'; section.setAttribute('data-settings-preflight', 'true');
  section.innerHTML = '<div class="panel-top"><div><h2>ตรวจสอบความพร้อมก่อนใช้งาน</h2><small>ตรวจเฉพาะความพร้อมของอุปกรณ์และการตั้งค่าหน้านี้ โดยไม่ส่งข้อมูลผู้ป่วยออกจากเครื่อง</small></div><button type="button" class="primary" data-run-preflight>ตรวจสอบตอนนี้</button></div><div class="command-list" data-preflight-results><div><b>ยังไม่ได้ตรวจสอบ</b><span>กดปุ่มเพื่อตรวจสอบองค์ประกอบสำคัญของระบบ</span></div></div>';
  health.after(section);
};
const runPreflight = () => {
  const result = root.querySelector('[data-preflight-results]');
  if (!result) return;
  const checks = [];
  try {
    const key = '__ndss_preflight__'; localStorage.setItem(key, 'ok'); const storageReady = localStorage.getItem(key) === 'ok'; localStorage.removeItem(key);
    checks.push(['ที่เก็บข้อมูลในอุปกรณ์', storageReady, storageReady ? 'พร้อมบันทึกข้อมูลในเบราว์เซอร์' : 'ไม่สามารถเขียนข้อมูลในเบราว์เซอร์ได้']);
  } catch { checks.push(['ที่เก็บข้อมูลในอุปกรณ์', false, 'ไม่สามารถเข้าถึงที่เก็บข้อมูลในเบราว์เซอร์ได้']); }
  checks.push(['แผนที่ Leaflet', Boolean(window.L), window.L ? 'พร้อมแสดงแผนที่และขอบเขตพื้นที่' : 'ไม่พบไลบรารีแผนที่']);
  checks.push(['การสร้าง PDF', typeof window.HTMLCanvasElement !== 'undefined', typeof window.HTMLCanvasElement !== 'undefined' ? 'รองรับการสร้างรายงาน PDF ในอุปกรณ์นี้' : 'เบราว์เซอร์ไม่รองรับ Canvas']);
  const centralReady = Boolean(globalThis.NDSS_CONFIG?.supabaseUrl && globalThis.NDSS_CONFIG?.supabasePublishableKey);
  checks.push(['ฐานข้อมูลกลาง', centralReady, centralReady ? 'ตรวจพบการตั้งค่า Supabase แล้ว' : 'ยังไม่ได้ตั้งค่า — ข้อมูลยังไม่ซิงก์ข้ามอุปกรณ์']);
  result.replaceChildren(...checks.map(([name, ok, detail]) => { const row = document.createElement('div'); const label = document.createElement('b'); const note = document.createElement('span'); label.textContent = `${ok ? '✓' : '!' } ${name}`; note.textContent = detail; row.append(label, note); return row; }));
  showToast(centralReady ? 'ตรวจสอบความพร้อมแล้ว' : 'ตรวจสอบแล้ว: ยังไม่ได้เชื่อมฐานข้อมูลกลาง', centralReady ? 'success' : 'info');
};
const enhanceImportQualityActions = () => {
  const panel = [...root.querySelectorAll('.work-panel')].find(item => item.querySelector('.panel-top h2')?.textContent === 'ตรวจสอบคุณภาพข้อมูล');
  const panelTop = panel?.querySelector('.panel-top');
  if (!panelTop || panelTop.querySelector('[data-export-506-quality]')) return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'secondary';
  button.setAttribute('data-export-506-quality', 'true');
  button.textContent = '⇩ ดาวน์โหลดรายการตรวจสอบ';
  panelTop.append(button);
};
const enhanceKnowledgeForms = () => {
  const heading = root.querySelector('.command-head h1');
  const tools = root.querySelector('.knowledge-tools');
  if (heading?.textContent !== 'Knowledge Center' || !tools || root.querySelector('[data-knowledge-forms]')) return;
  const section = document.createElement('section');
  section.className = 'work-panel knowledge-form-library';
  section.setAttribute('data-knowledge-forms', 'true');
  section.innerHTML = `<div class="panel-top"><div><h2>คลังแบบสอบสวนต้นฉบับ</h2><small>เปิดเอกสาร PDF ทั้ง 6 ฉบับจากหน้านี้ได้โดยตรง</small></div></div><div class="knowledge-form-links">${Object.entries(diseaseMeta).map(([name, meta], index) => `<a href="./public/forms/${encodeURIComponent(meta.template)}" target="_blank" rel="noopener" style="--disease-color:${meta.color}"><i>${String(index + 1).padStart(2,'0')}</i><span><b>${name}</b><small>${meta.pages} หน้า · PDF ต้นฉบับ</small></span><em>เปิด ↗</em></a>`).join('')}</div>`;
  tools.after(section);
};
const enhanceExportHistory = () => {
  const heading = root.querySelector('.command-head h1');
  const setupPanel = root.querySelector('[data-command-export]')?.closest('.work-panel');
  if (heading?.textContent !== 'ส่งออกรายงาน' || !setupPanel || root.querySelector('[data-export-history]')) return;
  let audits = []; try { audits = JSON.parse(localStorage.getItem('ndss-audit-log') || '[]'); } catch { /* no history */ }
  const entries = audits.filter(entry => String(entry.action || '').includes('ส่งออก')).slice(0, 10);
  const section = document.createElement('section');
  section.className = 'work-panel export-history'; section.setAttribute('data-export-history', 'true');
  const panelTop = document.createElement('div'); panelTop.className = 'panel-top';
  const title = document.createElement('div'); title.innerHTML = '<h2>ประวัติการส่งออกล่าสุด</h2><small>บันทึกเฉพาะกิจกรรมในอุปกรณ์นี้</small>';
  const openAudit = document.createElement('button'); openAudit.type = 'button'; openAudit.className = 'secondary'; openAudit.dataset.view = 'audit'; openAudit.textContent = 'ดู Audit Log';
  panelTop.append(title, openAudit); section.append(panelTop);
  if (entries.length) {
    const search = document.createElement('input');
    search.type = 'search'; search.className = 'table-search'; search.placeholder = 'ค้นหาชื่อไฟล์หรือชุดข้อมูล';
    search.setAttribute('data-export-history-search', 'true');
    section.append(search);
    const list = document.createElement('div'); list.className = 'command-list';
    entries.forEach(entry => { const row = document.createElement('div'); row.setAttribute('data-export-history-row', 'true'); const label = document.createElement('b'); const detail = document.createElement('span'); label.textContent = entry.action || 'ส่งออกข้อมูล'; detail.textContent = `${entry.detail || '-'} · ${new Date(entry.at).toLocaleString('th-TH')}`; row.append(label, detail); list.append(row); });
    section.append(list);
  } else { const note = document.createElement('p'); note.className = 'scope-note'; note.textContent = 'ยังไม่มีประวัติการส่งออกจากอุปกรณ์นี้'; section.append(note); }
  setupPanel.after(section);
};

const enhance506ReportFilters = () => {
  const disease = root.querySelector('[data-506-report-disease]');
  const panel = disease?.closest('.work-panel');
  const panelTop = panel?.querySelector('.panel-top');
  if (!disease || !panelTop || panelTop.querySelector('[data-reset-506-filter]')) return;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'secondary no-print';
  reset.setAttribute('data-reset-506-filter', 'true');
  reset.textContent = 'ล้างตัวกรอง';
  panelTop.append(reset);
};

const refreshAlertView = () => {
  if (!root.querySelector('.alert-feed')) return;
  root.innerHTML = `<div class="module-page">${moduleView('alerts')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === 'alerts');
  });
};

new MutationObserver(() => {
  enhanceAlertFilters();
  enhance506ReportFilters();
  enhanceLabFilters();
  enhanceTrackingFilters();
  enhanceTrackingSummary();
  enhanceSettingsHealth();
  enhanceSettingsPreflight();
  enhanceImportQualityActions();
  enhanceKnowledgeForms();
  enhanceExportHistory();
}).observe(root, { childList: true, subtree: true });
enhanceAlertFilters();
enhance506ReportFilters();
enhanceLabFilters();
enhanceTrackingFilters();
enhanceTrackingSummary();
enhanceSettingsHealth();
enhanceSettingsPreflight();
enhanceImportQualityActions();
enhanceKnowledgeForms();
enhanceExportHistory();

document.addEventListener('click', event => {
  if (event.target.closest('[data-run-preflight]')) { runPreflight(); return; }
  const filterButton = event.target.closest('[data-alert-filter]');
  if (!filterButton) return;
  root.querySelectorAll('[data-alert-filter]').forEach(button => {
    button.classList.toggle('active', button === filterButton);
  });
  applyAlertFilter(filterButton.dataset.alertFilter);
});

document.addEventListener('input', event => {
  if (!event.target.matches('[data-export-history-search]')) return;
  const query = event.target.value.trim().toLocaleLowerCase('th-TH');
  root.querySelectorAll('[data-export-history-row]').forEach(row => {
    row.hidden = Boolean(query) && !row.textContent.toLocaleLowerCase('th-TH').includes(query);
  });
});

document.addEventListener('click', event => {
  if (!event.target.closest('.nav-link[data-view="queue"]')) return;
  requestAnimationFrame(() => root.querySelector('[data-queue-filter="pending"]')?.click());
});

document.addEventListener('click', event => {
  if (!event.target.closest('[data-reset-506-filter]')) return;
  localStorage.removeItem('ndss-506-report-disease');
  localStorage.removeItem('ndss-506-report-area');
  localStorage.removeItem('ndss-506-report-page');
  localStorage.removeItem('ndss-506-report-search');
  localStorage.removeItem('ndss-506-report-list-open');
  root.innerHTML = `<div class="module-page">${moduleView('report506')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === 'report506');
  });
  showToast('ล้างตัวกรองรายงาน 506 แล้ว');
});

document.addEventListener('click', event => {
  if (event.target.closest('[data-close-506-report-list]')) {
    localStorage.removeItem('ndss-506-report-list-open');
    root.innerHTML = `<div class="module-page">${moduleView('report506')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === 'report506');
    });
    return;
  }
  if (event.target.closest('[data-open-506-report-list]')) {
    localStorage.setItem('ndss-506-report-list-open', 'true');
    root.innerHTML = `<div class="module-page">${moduleView('report506')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === 'report506');
    });
    return;
  }
  if (event.target.closest('[data-submit-506-report-search]')) {
    const search = root.querySelector('[data-506-report-search]');
    localStorage.setItem('ndss-506-report-search', search?.value.trim() || '');
    localStorage.setItem('ndss-506-report-page', '1');
    root.innerHTML = `<div class="module-page">${moduleView('report506')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === 'report506');
    });
    return;
  }
  const button = event.target.closest('[data-506-report-page]');
  if (!button || button.disabled) return;
  const page = Number(button.getAttribute('data-506-report-page'));
  if (!Number.isInteger(page) || page < 1) return;
  localStorage.setItem('ndss-506-report-page', String(page));
  root.innerHTML = `<div class="module-page">${moduleView('report506')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === 'report506');
  });
});

document.addEventListener('input', event => {
  if (event.target.matches('[data-knowledge-search]')) filterKnowledge();
  if (event.target.matches('[data-settings-search]')) filterSettings();
  if (event.target.matches('[data-audit-search]')) filterAudit();
  if (event.target.matches('[data-audit-category]')) filterAudit();
  if (event.target.matches('[data-506-report-search]')) filter506Report();
  if (event.target.matches('[data-alert-search]')) applyAlertFilter(root.querySelector('[data-alert-filter].active')?.dataset.alertFilter || 'active');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('[data-506-report-search]')) {
    event.preventDefault();
    event.target.closest('.report-search-control')?.querySelector('[data-submit-506-report-search]')?.click();
  }
});

document.addEventListener('change', event => {
  if (event.target.matches('[data-knowledge-category]')) filterKnowledge();
  if (event.target.matches('[data-lab-status-filter]')) filterLabRows();
  if (event.target.matches('[data-tracking-status]')) filterTrackingRows();
});

document.addEventListener('click', event => {
  if(event.target.closest('.notification')) {
    root.innerHTML=`<div class="module-page">${moduleView('alerts')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='alerts'));
  }
  window.setTimeout(updateNotificationBadge,0);
});
document.addEventListener('click', event => {
  const toggle=event.target.closest('[data-mobile-nav-toggle]');
  const sidebar=document.querySelector('.command-sidebar');
  const closeMobileNav=({restoreFocus=false}={})=>{
    if (!sidebar?.classList.contains('mobile-open')) return;
    sidebar.classList.remove('mobile-open');
    const trigger=document.querySelector('[data-mobile-nav-toggle]');
    trigger?.setAttribute('aria-expanded','false');
    if (restoreFocus) trigger?.focus();
  };
  if (toggle && sidebar) {
    const open=sidebar.classList.toggle('mobile-open');
    toggle.setAttribute('aria-expanded',String(open));
    return;
  }
  if (sidebar?.classList.contains('mobile-open') && (event.target.closest('.command-sidebar [data-view]') || !event.target.closest('.command-sidebar'))) {
    closeMobileNav();
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const sidebar=document.querySelector('.command-sidebar');
  if (!sidebar?.classList.contains('mobile-open')) return;
  sidebar.classList.remove('mobile-open');
  const trigger=document.querySelector('[data-mobile-nav-toggle]');
  trigger?.setAttribute('aria-expanded','false');
  trigger?.focus();
});
const renderCommandDashboard = () => {
  const page=root.querySelector('.overview-page');
  if(!page || page.querySelector('.reference-dashboard')) return;
  const records=overviewCases();
  const tasks=(()=>{ try { return JSON.parse(localStorage.getItem('ndss-response-tasks') || '[]'); } catch { return []; } })();
  const byDisease=Object.entries(countBy(records,'disease')).sort((a,b)=>b[1]-a[1]);
  const byArea=Object.entries(countBy(records.map(item=>({...item,area:item.tambon || item.subdistrict || item.district || item.location})),'area')).sort((a,b)=>b[1]-a[1]);
  const dated=records.filter(item=>item.onset || item.createdAt);
  const months=Array.from({length:12},(_,index)=>{ const date=new Date(); date.setMonth(date.getMonth()-11+index); const count=dated.filter(item=>{ const value=new Date(item.onset || item.createdAt); return !Number.isNaN(value) && value.getFullYear()===date.getFullYear() && value.getMonth()===date.getMonth(); }).length; return {label:date.toLocaleDateString('th-TH',{month:'short'}),count}; });
  const max=Math.max(...months.map(item=>item.count),1);
  const colors=['#287bd5','#f5a613','#16ab93','#875ad7','#e45263'];
  let position=0;
  const segments=byDisease.slice(0,5)…8658 tokens truncated…ase} ใช่หรือไม่?`)) { records.splice(index,1); localStorage.setItem('ndss-investigations',JSON.stringify(records)); renderPins(); renderHistory(); showToast('ลบเคสแล้ว'); } } });
const closeOnlineForm = async () => {
  const modal=root.querySelector('[data-form-modal]');
  if (!modal || modal.hidden) return;
  const confirmed=await confirmAction('ปิดแบบฟอร์มโดยไม่บันทึก?', 'ข้อมูลที่ยังไม่ได้บันทึกจะไม่ถูกเก็บ ต้องการปิดหรือไม่?');
  if (!confirmed) return;
  editingCaseIndex=null;
  modal.hidden=true;
  document.body.classList.remove('modal-open');
  showToast('ปิดแบบฟอร์มแล้ว','info');
};
document.addEventListener('click', async event => { if(event.target.closest('[data-print-report]')) printReport(); const modal=root.querySelector('[data-form-modal]'); if(!modal) return; const diseaseButton=event.target.closest('[data-open-disease-form]'); if(diseaseButton) openCaseForm({disease:diseaseButton.dataset.openDiseaseForm},null); if(event.target.closest('[data-open-online-form]')) openCaseForm({disease:'ไข้เลือดออก'},null); if(event.target.closest('[data-close-online-form]') || event.target === modal) await closeOnlineForm(); });
document.addEventListener('click', event => { const menu=root.querySelector('[data-original-forms-menu]'); if(!menu) return; const trigger=event.target.closest('[data-toggle-original-forms]'); if(trigger) { const open=menu.hidden; menu.hidden=!open; trigger.setAttribute('aria-expanded',String(open)); trigger.querySelector('span').textContent=open?'⌃':'⌄'; return; } if(!event.target.closest('[data-original-forms-menu]')) { menu.hidden=true; root.querySelector('[data-toggle-original-forms]')?.setAttribute('aria-expanded','false'); } });
document.addEventListener('keydown', async event => {
  if (event.key !== 'Escape') return;
  await closeOnlineForm();
});
const mountNarathiwatBoundaries = () => addNarathiwatBoundaries(investigationMap);
document.addEventListener('click', event => { if(event.target.closest('[data-view="investigation"],[data-map-filter],[data-clear-pins]')) setTimeout(mountNarathiwatBoundaries, 0); });
document.addEventListener('submit', event => { if(event.target.matches('[data-investigation-form]')) setTimeout(mountNarathiwatBoundaries, 0); });

// Command centre: client-side import and analysis helpers.  Data remains in the browser
// until a server-side 506 integration is configured by the administrator.
const commandRecords = () => { try { return JSON.parse(localStorage.getItem('ndss-506-records') || '[]'); } catch { return []; } };
const commandCases = () => { try { return JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); } catch { return []; } };
const recordAudit = (action, detail) => { let entries=[]; try { entries=JSON.parse(localStorage.getItem('ndss-audit-log') || '[]'); } catch { entries=[]; } entries.unshift({action,detail,at:new Date().toISOString()}); localStorage.setItem('ndss-audit-log',JSON.stringify(entries.slice(0,100))); };
const commandText = value => String(value ?? '').trim();
const fieldValue = (row, names) => {
  const found = Object.keys(row).find(key => names.some(name => key.toLowerCase().replaceAll(/[ _.-]/g,'').includes(name)));
  return found ? commandText(row[found]) : '';
};
const normalize506 = rows => rows.map(row => ({
  disease: fieldValue(row,['disease','โรค','diag','icd10']),
  patient: fieldValue(row,['patient','name','ชื่อ','ผู้ป่วย']),
  onset: fieldValue(row,['onset','วันที่เริ่มป่วย','dateonset','illdate']),
  sex: fieldValue(row,['sex','เพศ']),
  age: fieldValue(row,['age','อายุ']),
  nationality: fieldValue(row,['nationality','สัญชาติ']),
  tambon: fieldValue(row,['tambon','subdistrict','ตำบล','ตําบล']),
  district: fieldValue(row,['district','amphoe','อำเภอ','อําเภอ']),
  latitude: fieldValue(row,['latitude','lat','ละติจูด']),
  longitude: fieldValue(row,['longitude','lng','lon','ลองจิจูด']),
  raw: row,
  importedAt: new Date().toISOString()
})).filter(row => Object.values(row).some(value => commandText(value)));
const recordFingerprint = row => [row.disease,row.onset,row.tambon || row.subdistrict,row.district,row.patient].map(commandText).join('|').toLowerCase();
const csvRows = text => {
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const cells = line => { const result=[]; let value='', quoted=false; for(let i=0;i<line.length;i++){ const char=line[i]; if(char==='"') { if(quoted && line[i+1]==='"') { value+='"'; i++; } else quoted=!quoted; } else if(char===',' && !quoted) { result.push(value.trim()); value=''; } else value+=char; } result.push(value.trim()); return result; };
  const headers=cells(lines[0]); return lines.slice(1).map(line => Object.fromEntries(headers.map((header,index)=>[header,cells(line)[index] || ''])));
};
const import506File = async file => {
  if (!file) return;
  try {
    let rows=[];
    if (/\.csv$/i.test(file.name)) rows=csvRows(await file.text());
    else if (window.XLSX) { const data=await file.arrayBuffer(); const book=window.XLSX.read(data,{type:'array',cellDates:true}); rows=window.XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:''}); }
    else throw new Error('ไม่พบตัวอ่านไฟล์ Excel');
    const normalized=normalize506(rows);
    if(!normalized.length) throw new Error('ไม่พบแถวข้อมูลที่นำเข้าได้');
    const existing=commandRecords();
    const seen=new Set(existing.map(recordFingerprint));
    const unique=normalized.filter(row => { const fingerprint=recordFingerprint(row); if(seen.has(fingerprint)) return false; seen.add(fingerprint); return true; });
    const incomplete=normalized.filter(row => !row.disease || !row.onset || !(row.tambon || row.district)).length;
    const combined=[...existing,...unique];
    localStorage.setItem('ndss-506-records',JSON.stringify(combined));
    const meta={fileName:file.name,imported:unique.length,duplicates:normalized.length-unique.length,incomplete,at:new Date().toLocaleString('th-TH')};
    localStorage.setItem('ndss-506-import-meta',JSON.stringify(meta));
    recordAudit('นำเข้าข้อมูล รง.506',`ไฟล์ ${file.name} · เพิ่ม ${unique.length} ราย · ซ้ำ ${meta.duplicates} ราย`);
    root.querySelector('[data-import-status]')?.replaceChildren(document.createTextNode(`นำเข้าข้อมูลใหม่ ${unique.length} ราย · รวมข้อมูล รง.506 ${combined.length} ราย`));
    window.dispatchEvent(new Event('ndss-cases-updated'));
    showToast(`นำเข้าข้อมูล รง.506 ใหม่ ${unique.length} รายแล้ว`);
  } catch(error) { console.error(error); showToast(`นำเข้าข้อมูลไม่สำเร็จ: ${error.message}`); }
};
let commandMap;
const renderCommandMap = () => {
  const node=root.querySelector('[data-command-map]'); if(!node) return;
  if(!window.L) { node.textContent='กำลังโหลดแผนที่ Leaflet…'; return; }
  node.closest('.command-map-panel')?.querySelectorAll('.map-area-search').forEach(element=>element.remove());
  if(commandMap) commandMap.remove();
  commandMap=window.L.map(node,{scrollWheelZoom:false}).setView([6.426,101.825],11);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(commandMap);
  addNarathiwatBoundaries(commandMap);
  const scope=root.querySelector('[data-command-map-scope]')?.value || 'all';
  const points=[...commandRecords().filter(row => scope==='all' || row.disease===scope),...commandCases().filter(row => scope==='all' || row.disease===scope)].map((row,index)=>({row,lat:Number(row.latitude || row.lat),lng:Number(row.longitude || row.lng),index})).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng));
  const bounds=[];
  points.forEach(point=>{ const color=point.row.disease==='ไข้เลือดออก'?'#df3f48':'#176fca'; const marker=window.L.circleMarker([point.lat,point.lng],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:.95}).addTo(commandMap); marker.bindPopup(`<b>${escapeOverview(point.row.disease || 'ไม่ระบุโรค')}</b><br>${escapeOverview(point.row.tambon || point.row.subdistrict || point.row.location || 'ไม่ระบุพื้นที่')}`); bounds.push([point.lat,point.lng]); });
  if(bounds.length) commandMap.fitBounds(bounds,{padding:[30,30],maxZoom:14});
  else node.insertAdjacentHTML('beforeend','<div class="command-map-empty">ยังไม่มีข้อมูลพิกัดจาก รง.506 หรือแบบสอบสวน</div>');
  setTimeout(()=>commandMap.invalidateSize(),100);
};
const commandCsv = () => {
  const selectedDisease=root.querySelector('[data-506-report-disease]')?.value || '';
  const selectedArea=root.querySelector('[data-506-report-area]')?.value || '';
  const search=(root.querySelector('[data-506-report-search]')?.value || '').trim().toLocaleLowerCase('th-TH');
  const rows=commandRecords().filter(row=>{
    const matchDisease=!selectedDisease || row.disease===selectedDisease;
    const matchArea=!selectedArea || (row.tambon || row.district)===selectedArea;
    const matchSearch=!search || [row.disease,row.patient,row.tambon,row.district].join(' ').toLocaleLowerCase('th-TH').includes(search);
    return matchDisease && matchArea && matchSearch;
  });
  if(!rows.length) { showToast('ยังไม่มีข้อมูล รง.506 ตามเงื่อนไขที่เลือก'); return; }
  const head=['โรค','ชื่อผู้ป่วย','HN','วันเริ่มป่วย','เพศ','อายุ','ตำบล','อำเภอ','ละติจูด','ลองจิจูด'];
  const body=rows.map(r=>[r.disease,r.patient,r.hn,r.onset,r.sex,r.age,r.tambon,r.district,r.latitude,r.longitude]);
  const csvCell = value => {
    const text=String(value ?? '');
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  };
  const csv=[head,...body].map(line=>line.map(value=>`"${csvCell(value).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`ndss-506-${new Date().toISOString().slice(0,10)}.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),500);
  showToast(`ดาวน์โหลด CSV ${rows.length} รายการแล้ว`);
};
const export506Quality = () => {
  const rows = commandRecords().filter(row => !row.disease || !row.onset || !(row.tambon || row.district));
  if (!rows.length) { showToast('ไม่พบรายการ รง.506 ที่ข้อมูลสำคัญไม่ครบ'); return; }
  const headers = ['ผู้ป่วย / HN', 'โรค', 'วันเริ่มป่วย', 'ตำบล', 'อำเภอ', 'รายการที่ควรตรวจสอบ'];
  const values = rows.map(row => {
    const missing = [!row.disease && 'โรค', !row.onset && 'วันเริ่มป่วย', !(row.tambon || row.district) && 'พื้นที่'].filter(Boolean).join(', ');
    return [row.patient || row.hn || '-', row.disease || '-', row.onset || '-', row.tambon || '-', row.district || '-', missing];
  });
  const safe = value => { const text = String(value ?? ''); return /^[=+\-@]/.test(text) ? `'${text}` : text; };
  const csv = [headers, ...values].map(line => line.map(value => `"${safe(value).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff', csv], {type:'text/csv;charset=utf-8'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `ndss-506-quality-${new Date().toISOString().slice(0,10)}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
  recordAudit('ส่งออกรายการตรวจสอบ รง.506', `${rows.length} รายการ`);
  showToast(`ดาวน์โหลดรายการตรวจสอบ ${rows.length} รายการแล้ว`);
};
const commandExport = ({dataset,filename,detail='full'}) => {
  const sources={
    '506': commandRecords(),
    investigation: commandCases(),
    lab: (()=>{ try { return JSON.parse(localStorage.getItem('ndss-lab-results') || '[]'); } catch { return []; } })(),
    tasks: (()=>{ try { return JSON.parse(localStorage.getItem('ndss-response-tasks') || '[]'); } catch { return []; } })()
  };
  const source=sources[dataset] || [];
  const summaryFields = dataset === 'lab'
    ? [['การตรวจ', row => row.test || 'ไม่ระบุการตรวจ'], ['ผลตรวจ', row => row.result || 'ไม่ระบุผล']]
    : dataset === 'tasks'
      ? [['สถานะงาน', row => row.status || 'ไม่ระบุสถานะ'], ['ระดับความเร่งด่วน', row => row.priority || 'ไม่ระบุระดับ']]
      : [['โรค', row => row.disease || 'ไม่ระบุโรค'], ['พื้นที่', row => row.tambon || row.subdistrict || row.district || row.location || 'ไม่ระบุพื้นที่']];
  const rows=detail === 'summary'
    ? Object.values(source.reduce((all,row) => {
      const values=summaryFields.map(([,get]) => get(row));
      const key=values.join('\u001f');
      all[key]=all[key] || Object.fromEntries(summaryFields.map(([label], index) => [label, values[index]]));
      all[key]['จำนวนรายการ']=(all[key]['จำนวนรายการ'] || 0) + 1;
      return all;
    }, {}))
    : source;
  if(!rows.length) { showToast('ยังไม่มีข้อมูลในชุดที่เลือกสำหรับส่งออก'); return; }
  const keys=[...new Set(rows.flatMap(row=>Object.keys(row).filter(key=>!['raw','pdfData'].includes(key))))];
  const csv=[keys,...rows.map(row=>keys.map(key=>typeof row[key]==='object' ? JSON.stringify(row[key]) : row[key] ?? ''))].map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');
  const safeName=(filename || `ndss-${dataset}${detail === 'summary' ? '-summary' : ''}-${new Date().toISOString().slice(0,10)}`).replace(/[^a-zA-Z0-9ก-๙_\-]/g,'-');
  const blob=new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`${safeName}.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),500);
  recordAudit('ส่งออกข้อมูล CSV',`ชุดข้อมูล ${dataset} · ${detail === 'summary' ? 'สรุป' : 'รายละเอียด'} · ${rows.length} รายการ`);
  showToast(`ดาวน์โหลด${detail === 'summary' ? 'ข้อมูลสรุป ' : ''}${rows.length} รายการแล้ว`);
};
const backupKeys=['ndss-506-records','ndss-506-import-meta','ndss-investigations','ndss-response-tasks','ndss-case-contacts','ndss-lab-results','ndss-alert-state','ndss-audit-log'];
const backupLocalData = () => {
  const records=Object.fromEntries(backupKeys.map(key=>[key,JSON.parse(localStorage.getItem(key) || (key.includes('state') ? '{}' : '[]'))]));
  const blob=new Blob([JSON.stringify({version:1,createdAt:new Date().toISOString(),records},null,2)],{type:'application/json'});
  const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`ndss-local-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),500);
  recordAudit('สำรองข้อมูลในอุปกรณ์','สร้างไฟล์สำรอง JSON');
  showToast('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว');
};
const restoreLocalData = async file => {
  if(!file) return;
  try {
    const backup=JSON.parse(await file.text());
    if(backup?.version!==1 || !backup.records || typeof backup.records!=='object') throw new Error('invalid');
    if(!await confirmAction('ยืนยันการกู้คืนข้อมูล','การกู้คืนจะเขียนทับข้อมูลในอุปกรณ์นี้ ต้องการดำเนินการหรือไม่?')) return;
    backupKeys.forEach(key=>{
      if(Object.hasOwn(backup.records,key)) localStorage.setItem(key,JSON.stringify(backup.records[key]));
    });
    recordAudit('กู้คืนข้อมูลในอุปกรณ์',`กู้คืนจากไฟล์ ${file.name}`);
    root.innerHTML=`<div class="module-page">${moduleView('settings')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='settings'));
    showToast('กู้คืนข้อมูลเรียบร้อยแล้ว');
  } catch(error) { showToast('ไม่สามารถอ่านไฟล์สำรองนี้ได้'); }
};
const filterReportRows = () => {
  const query=(root.querySelector('[data-report-search]')?.value || '').toLowerCase();
  const status=root.querySelector('[data-report-status]')?.value || 'all';
  const rows=[...root.querySelectorAll('[data-report-rows] tr')];
  rows.forEach(row=>{
    row.hidden=(!row.textContent.toLowerCase().includes(query)) || (status!=='all' && row.dataset.reportStatus!==status);
  });
  updateFilteredTableMeta(rows,'[data-report-rows]');
};
const filterEventReportRows = () => {
  const query=(root.querySelector('[data-event-report-search]')?.value || '').toLowerCase();
  const status=root.querySelector('[data-event-report-status]')?.value || 'all';
  const rows=[...root.querySelectorAll('[data-event-report-rows] tr')];
  rows.forEach(row=>{
    row.hidden=(!row.textContent.toLowerCase().includes(query)) || (status!=='all' && row.dataset.eventReportStatus!==status);
  });
  updateFilteredTableMeta(rows,'[data-event-report-rows]');
};
const updateFilteredTableMeta = (rows, selector) => {
  const body=root.querySelector(selector);
  const panel=body?.closest('.work-panel');
  if(!panel) return;
  const visible=rows.filter(row=>!row.hidden).length;
  let meta=panel.querySelector('[data-filtered-table-meta]');
  if(!meta) {
    meta=document.createElement('p');
    meta.className='table-filter-meta';
    meta.dataset.filteredTableMeta='true';
    panel.append(meta);
  }
  meta.textContent=visible ? `แสดงผลการค้นหา ${visible} รายการ` : 'ไม่พบรายการที่ตรงกับเงื่อนไข';
  meta.classList.toggle('is-empty',visible===0);
};
document.addEventListener('change', event => {
  if(event.target.matches('[data-import-506]')) import506File(event.target.files?.[0]);
  if(event.target.matches('[data-restore-local]')) restoreLocalData(event.target.files?.[0]);
  if(event.target.matches('[data-command-map-scope]')) renderCommandMap();
  if(event.target.matches('[data-report-status]')) filterReportRows();
  if(event.target.matches('[data-event-report-status]')) filterEventReportRows();
  if(event.target.matches('[data-disease-analytics-select]')) {
    localStorage.setItem('ndss-analytics-disease',event.target.value);
    root.innerHTML=`<div class="module-page">${moduleView('epidemiology')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='epidemiology'));
  }
  if(event.target.matches('[data-epi-disease-filter]')) {
    localStorage.setItem('ndss-epi-disease',event.target.value);
    refreshEpidemiology();
  }
  if(event.target.matches('[data-506-report-disease],[data-506-report-area]')) {
    const disease=root.querySelector('[data-506-report-disease]')?.value || '';
    const area=root.querySelector('[data-506-report-area]')?.value || '';
    localStorage.setItem('ndss-506-report-disease',disease);
    localStorage.setItem('ndss-506-report-area',area);
    localStorage.setItem('ndss-506-report-page','1');
    root.innerHTML=`<div class="module-page">${moduleView('report506')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='report506'));
  }
});
document.addEventListener('input', event => {
  if(event.target.matches('[data-command-queue-search]')) { const keyword=event.target.value.toLowerCase(); root.querySelectorAll('[data-command-queue-rows] tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(keyword)); }
  if(event.target.matches('[data-lab-search]')) filterLabRows();
  if(event.target.matches('[data-tracking-search]')) filterTrackingRows();
  if(event.target.matches('[data-report-search]')) filterReportRows();
  if(event.target.matches('[data-event-report-search]')) filterEventReportRows();
});
document.addEventListener('click', event => {
  const commandView=event.target.closest('[data-view]')?.dataset.view;
  if(commandView==='area-map') setTimeout(renderCommandMap,0);
  if(event.target.closest('[data-open-506-import]')) document.querySelector('.nav-link[data-view="import506"]')?.click();
  if(event.target.closest('[data-clear-506]')) { localStorage.removeItem('ndss-506-records'); localStorage.removeItem('ndss-506-import-meta'); recordAudit('ล้างข้อมูล รง.506','ล้างข้อมูลที่นำเข้าในอุปกรณ์นี้'); root.querySelector('[data-import-status]')?.replaceChildren(document.createTextNode('ล้างข้อมูลนำเข้าแล้ว')); window.dispatchEvent(new Event('ndss-cases-updated')); showToast('ล้างข้อมูล รง.506 แล้ว'); }
  if(event.target.closest('[data-clear-audit]')) { localStorage.removeItem('ndss-audit-log'); root.innerHTML=`<div class="module-page">${moduleView('audit')}</div>`; document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='audit')); showToast('ล้างบันทึกกิจกรรมแล้ว'); }
  if(event.target.closest('[data-backup-local]')) backupLocalData();
  const queueFilter=event.target.closest('[data-queue-filter]');
  if(queueFilter) {
    const filter=queueFilter.dataset.queueFilter;
    root.querySelectorAll('[data-queue-filter]').forEach(button=>button.classList.toggle('active',button===queueFilter));
    root.querySelectorAll('[data-command-queue-rows] tr').forEach(row=>row.hidden=filter!=='all' && row.dataset.queueKind!==filter);
  }
  const alertAction=event.target.closest('[data-ack-alert]');
  if(alertAction) {
    let state={}; try { state=JSON.parse(localStorage.getItem('ndss-alert-state') || '{}'); } catch { state={}; }
    state[alertAction.dataset.ackAlert]=new Date().toISOString();
    localStorage.setItem('ndss-alert-state',JSON.stringify(state));
    recordAudit('รับทราบการแจ้งเตือน',alertAction.closest('article')?.querySelector('b')?.textContent || 'รายการแจ้งเตือน');
    root.innerHTML=`<div class="module-page">${moduleView('alerts')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='alerts'));
    showToast('บันทึกรับทราบการแจ้งเตือนแล้ว');
  }
  if(event.target.closest('[data-export-506-csv]')) commandCsv();
  if(event.target.closest('[data-export-506-quality]')) export506Quality();
  if(event.target.closest('[data-print-summary]')) window.print();
  if(event.target.closest('[data-print-command-report]')) window.print();
  if(event.target.closest('[data-print-ai-brief]')) {
    document.body.classList.add('printing-ai-report');
    window.print();
    window.setTimeout(()=>document.body.classList.remove('printing-ai-report'),250);
  }
  if(event.target.closest('[data-save-ai-brief]')) {
    const output=root.querySelector('[data-ai-output]');
    const text=output?.innerText?.trim() || '';
    if(!text || text.includes('เลือกเงื่อนไข')) { showToast('สร้างร่างรายงานก่อนบันทึก'); return; }
    let reports=[]; try { reports=JSON.parse(localStorage.getItem('ndss-ai-reports') || '[]'); } catch { reports=[]; }
    const report={
      period:root.querySelector('[data-ai-period]')?.value || 'ข้อมูลทั้งหมดที่นำเข้า',
      tone:root.querySelector('[data-ai-tone]')?.value || 'รายงานสถานการณ์',
      area:root.querySelector('[data-ai-area]')?.value || 'ทุกพื้นที่',
      text,
      createdAt:new Date().toISOString()
    };
    reports.unshift(report);
    localStorage.setItem('ndss-ai-reports',JSON.stringify(reports.slice(0,100)));
    recordAudit('บันทึกรายงานสถานการณ์',`${report.period} · ${report.tone}`);
    root.innerHTML=`<div class="module-page">${moduleView('ai-brief')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='ai-brief'));
    showToast('บันทึกร่างรายงานแล้ว');
    return;
  }
  const openAiReport=event.target.closest('[data-open-ai-report]');
  if(openAiReport) {
    let reports=[]; try { reports=JSON.parse(localStorage.getItem('ndss-ai-reports') || '[]'); } catch { reports=[]; }
    const report=reports[Number(openAiReport.dataset.openAiReport)];
    const output=root.querySelector('[data-ai-output]');
    if(!report || !output) return;
    output.replaceChildren();
    const heading=document.createElement('h2'); heading.textContent=`ร่าง${report.tone}`;
    const detail=document.createElement('p'); detail.textContent=report.text;
    const metadata=document.createElement('small'); metadata.textContent=`บันทึกเมื่อ ${new Date(report.createdAt).toLocaleString('th-TH')} · ${report.period} · ${report.area}`;
    output.append(heading,detail,metadata);
    output.scrollIntoView({behavior:'smooth',block:'center'});
  }
  const deleteAiReport=event.target.closest('[data-delete-ai-report]');
  if(deleteAiReport) {
    let reports=[]; try { reports=JSON.parse(localStorage.getItem('ndss-ai-reports') || '[]'); } catch { reports=[]; }
    const index=Number(deleteAiReport.dataset.deleteAiReport);
    if(!reports[index] || !window.confirm('ลบร่างรายงานฉบับนี้ใช่หรือไม่?')) return;
    reports.splice(index,1);
    localStorage.setItem('ndss-ai-reports',JSON.stringify(reports));
    recordAudit('ลบร่างรายงานสถานการณ์','ลบรายงานที่บันทึกไว้');
    root.innerHTML=`<div class="module-page">${moduleView('ai-brief')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='ai-brief'));
    showToast('ลบร่างรายงานแล้ว');
    return;
  }
  if(event.target.closest('[data-generate-ai-brief]')) {
    const period=root.querySelector('[data-ai-period]')?.value || 'ข้อมูลทั้งหมดที่นำเข้า';
    const tone=root.querySelector('[data-ai-tone]')?.value || 'รายงานสถานการณ์';
    const areaScope=root.querySelector('[data-ai-area]')?.value || 'ทุกพื้นที่';
    const now=new Date();
    const rows=commandRecords().filter(row=>{
      const date=new Date(row.onset || row.importedAt);
      const inMonth=period!=='เดือนปัจจุบัน' || (!Number.isNaN(date) && date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth());
      const inArea=areaScope!=='เฉพาะข้อมูลที่มีตำบล' || Boolean(row.tambon || row.subdistrict);
      return inMonth && inArea;
    });
    const cases=commandCases();
    const byDisease=rows.reduce((all,row)=>{ const disease=row.disease||'ไม่ระบุโรค'; all[disease]=(all[disease]||0)+1; return all; },{});
    const byArea=rows.reduce((all,row)=>{ const area=row.tambon||row.district||'ไม่ระบุพื้นที่'; all[area]=(all[area]||0)+1; return all; },{});
    const leading=Object.entries(byDisease).sort((a,b)=>b[1]-a[1])[0];
    const leadingArea=Object.entries(byArea).sort((a,b)=>b[1]-a[1])[0];
    const output=root.querySelector('[data-ai-output]');
    if(output) output.innerHTML=rows.length ? `<h2>ร่าง${tone}</h2><p>ขอบเขตที่เลือก: ${escapeOverview(period)} · ${escapeOverview(areaScope)} พบข้อมูล รง.506 ${rows.length} ราย${leading ? ` โรคที่มีรายงานมากที่สุดคือ ${escapeOverview(leading[0])} (${leading[1]} ราย)` : ''}${leadingArea ? ` และพื้นที่ที่มีรายงานมากที่สุดคือ ${escapeOverview(leadingArea[0])} (${leadingArea[1]} ราย)` : ''} แบบสอบสวนที่บันทึกในระบบทั้งหมด ${cases.length} ราย ข้อความนี้เป็นการพรรณนาจากข้อมูลที่เลือก ควรตรวจทานความครบถ้วนของวันเริ่มป่วย พื้นที่ และการจัดกลุ่มเหตุการณ์ก่อนใช้สื่อสารหรือสั่งการ</p><small>ร่างข้อความจากกฎการสรุปข้อมูลในระบบ ไม่ใช่การวินิจฉัยหรือข้อสรุปเชิงสาเหตุ</small>` : `<h2>ร่าง${tone}</h2><p>ยังไม่มีข้อมูล รง.506 ตามขอบเขตที่เลือก จึงยังไม่สร้างบทวิเคราะห์</p>`;
  }
  if(event.target.closest('[data-preview-line]')) { const rows=commandRecords(); const cases=commandCases(); const area=root.querySelector('[data-line-area]')?.value || ''; const disease=root.querySelector('[data-line-disease]')?.value || ''; const level=root.querySelector('[data-line-level]')?.value || 'ติดตามสถานการณ์'; const target=root.querySelector('[data-line-target]')?.value || 'ทีม SRRT'; const filtered=rows.filter(row=>(!area || row.tambon===area || row.district===area) && (!disease || row.disease===disease)); const breakdown=filtered.reduce((all,row)=>{const key=row.disease||'ไม่ระบุโรค';all[key]=(all[key]||0)+1;return all;},{}); const leading=Object.entries(breakdown).sort((a,b)=>b[1]-a[1])[0]; const message=filtered.length ? `แจ้ง${level}\nถึง: ${target}\nข้อมูล รง.506 ${filtered.length} ราย${area ? ` · พื้นที่ ${area}` : ''}${disease ? ` · โรค ${disease}` : ''}\n${leading ? `โรคที่มีรายงานมากสุด: ${leading[0]} ${leading[1]} ราย\n` : ''}แบบสอบสวนที่บันทึกในระบบ: ${cases.length} ราย\nโปรดตรวจสอบรายละเอียดและดำเนินการตามแนวทางของทีม SRRT` : 'ยังไม่มีข้อมูลตามเงื่อนไขที่เลือกสำหรับสร้างข้อความแจ้งเตือน'; const box=root.querySelector('[data-line-preview]'); if(box) box.textContent=message; const copy=root.querySelector('[data-copy-line]'); if(copy) { copy.hidden=!filtered.length; copy.dataset.lineMessage=message; } }
  if(event.target.closest('[data-copy-line]')) { const message=event.target.closest('[data-copy-line]').dataset.lineMessage; if(message && navigator.clipboard?.writeText) { navigator.clipboard.writeText(message).then(()=>showToast('คัดลอกข้อความแจ้งเตือนแล้ว')).catch(()=>showToast('ไม่สามารถคัดลอกข้อความได้ในขณะนี้')); } }
  if(event.target.closest('[data-send-line]')) showToast('การส่ง LINE OA ต้องตั้งค่า Messaging API และสิทธิ์ผู้ใช้งานก่อน');
});
document.addEventListener('submit', event => {
  if(event.target.matches('[data-command-export]')) {
    event.preventDefault();
    commandExport(Object.fromEntries(new FormData(event.target)));
    return;
  }
  if(event.target.matches('[data-lab-result]')) {
    event.preventDefault();
    const results=(()=>{ try { return JSON.parse(localStorage.getItem('ndss-lab-results') || '[]'); } catch { return []; } })();
    const result={...Object.fromEntries(new FormData(event.target)),createdAt:new Date().toISOString()};
    results.unshift(result);
    localStorage.setItem('ndss-lab-results',JSON.stringify(results));
    recordAudit('บันทึกผลตรวจห้องปฏิบัติการ',`${result.test} · ${result.result} · ${result.specimenNo}`);
    root.innerHTML=`<div class="module-page">${moduleView('lab')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='lab'));
    showToast('บันทึกผลตรวจแล้ว');
    return;
  }
  if(event.target.matches('[data-contact-tracing]')) {
    event.preventDefault();
    const contacts=(()=>{ try { return JSON.parse(localStorage.getItem('ndss-case-contacts') || '[]'); } catch { return []; } })();
    const contact={...Object.fromEntries(new FormData(event.target)),createdAt:new Date().toISOString()};
    contacts.unshift(contact);
    localStorage.setItem('ndss-case-contacts',JSON.stringify(contacts));
    recordAudit('บันทึกผู้สัมผัส',`${contact.contactName} · ${contact.relationship || 'ไม่ระบุความสัมพันธ์'}`);
    root.innerHTML=`<div class="module-page">${moduleView('tracking')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='tracking'));
    showToast('บันทึกข้อมูลผู้สัมผัสแล้ว');
    return;
  }
  if(!event.target.matches('[data-response-task]')) return;
  event.preventDefault();
  const tasks=(()=>{ try { return JSON.parse(localStorage.getItem('ndss-response-tasks') || '[]'); } catch { return []; } })();
  const task={...Object.fromEntries(new FormData(event.target)),createdAt:new Date().toISOString()};
  tasks.push(task);
  localStorage.setItem('ndss-response-tasks',JSON.stringify(tasks));
  recordAudit('มอบหมายงานติดตาม',`ผู้รับผิดชอบ: ${task.owner} · กำหนด ${task.dueDate || '-'}`);
  root.innerHTML=`<div class="module-page">${moduleView('tracking')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='tracking'));
  showToast('บันทึกมอบหมายงานแล้ว');
});
document.addEventListener('click', event => {
  const contactAction=event.target.closest('[data-complete-contact],[data-delete-contact]');
  if(contactAction) {
    const contacts=(()=>{ try { return JSON.parse(localStorage.getItem('ndss-case-contacts') || '[]'); } catch { return []; } })();
    const index=Number(contactAction.dataset.completeContact ?? contactAction.dataset.deleteContact);
    const contact=contacts[index];
    if(!contact) return;
    if(contactAction.dataset.deleteContact !== undefined) {
      if(!window.confirm(`ลบข้อมูลผู้สัมผัส ${contact.contactName} ใช่หรือไม่?`)) return;
      contacts.splice(index,1);
      recordAudit('ลบข้อมูลผู้สัมผัส',contact.contactName);
      showToast('ลบข้อมูลผู้สัมผัสแล้ว');
    } else {
      contact.followup='ติดตามครบแล้ว';
      contact.completedAt=new Date().toISOString();
      recordAudit('ปิดการติดตามผู้สัมผัส',contact.contactName);
      showToast('บันทึกว่าติดตามครบแล้ว');
    }
    localStorage.setItem('ndss-case-contacts',JSON.stringify(contacts));
    root.innerHTML=`<div class="module-page">${moduleView('tracking')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='tracking'));
    return;
  }
  const action=event.target.closest('[data-delete-lab]');
  if(!action) return;
  const results=(()=>{ try { return JSON.parse(localStorage.getItem('ndss-lab-results') || '[]'); } catch { return []; } })();
  const item=results[Number(action.dataset.deleteLab)];
  if(!item || !window.confirm(`ลบผลตรวจ ${item.specimenNo} ใช่หรือไม่?`)) return;
  results.splice(Number(action.dataset.deleteLab),1);
  localStorage.setItem('ndss-lab-results',JSON.stringify(results));
  recordAudit('ลบผลตรวจห้องปฏิบัติการ',`เลขสิ่งส่งตรวจ ${item.specimenNo}`);
  root.innerHTML=`<div class="module-page">${moduleView('lab')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='lab'));
  showToast('ลบผลตรวจแล้ว');
});
document.addEventListener('click', event => {
  const action=event.target.closest('[data-complete-response]');
  if(!action) return;
  const tasks=(()=>{ try { return JSON.parse(localStorage.getItem('ndss-response-tasks') || '[]'); } catch { return []; } })();
  const task=tasks[Number(action.dataset.completeResponse)];
  if(!task) return;
  task.status='ควบคุมแล้ว'; task.completedAt=new Date().toISOString();
  localStorage.setItem('ndss-response-tasks',JSON.stringify(tasks));
  recordAudit('ปิดงานติดตาม','บันทึกสถานะควบคุมแล้ว');
  root.innerHTML=`<div class="module-page">${moduleView('tracking')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='tracking'));
  showToast('บันทึกสถานะควบคุมแล้ว');
});
document.addEventListener('submit', event => {
  if(!event.target.matches('[data-investigation-form]')) return;
  const disease=event.target.querySelector('[data-disease]')?.value || 'ไม่ระบุโรค';
  setTimeout(()=>recordAudit('บันทึกแบบสอบสวนโรค',`บันทึกแบบสอบสวน ${disease}`),0);
});

