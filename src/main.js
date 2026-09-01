import { clearSupabaseSession, consumeSupabaseSessionFromUrl, getSupabaseRole, getSupabaseUser, hasSupabaseCredentials, hasSupabaseSession, invokeAdminUserManagement, requestSupabasePasswordRecovery, signInWithPassword, signUpWithPassword, updateSupabasePassword } from './config/supabase.js';
import { downloadCleanPdf } from './services/clean-pdf-generator.js';
import { enableHistoryAreaFilter } from './components/history-area-filter.js';
import { addNarathiwatBoundaries } from './components/narathiwat-boundaries.js';
import { shell } from './components/layout.js?v=20260901-4'; import { metricsGrid } from './components/metrics.js'; import { analytics } from './components/charts.js'; import { caseTracking } from './components/case-tracking.js'; import { rightRail } from './components/alerts.js'; import { moduleView, diseaseMeta, investigationForm } from './components/modules.js?v=20260901-6';
const authCallbackType = new URLSearchParams(location.hash.replace(/^#/, '')).get('type') || '';
consumeSupabaseSessionFromUrl();
const escapeOverview = value => String(value ?? '-').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
function cleanDiseaseLabel(value) {
  const raw=String(value ?? '').trim();
  if (!raw || /^(?:["']\s*){1,2}$/.test(raw)) return '';
  const parts=raw.replace(/[\[\]]/g,'').split(/[;,|]/).map(part=>part.trim().replace(/^["']+|["']+$/g,'').trim()).filter(part=>part && part !== '""');
  const tidy=part=>/^[A-Za-z]\d{3}$/.test(part) ? `${part.slice(0,3)}.${part.slice(3)}` : part;
  return (parts.length ? parts : [raw.replace(/^["']+|["']+$/g,'').trim()]).map(tidy).filter(Boolean).join(' · ');
}
const overviewCases = () => {
  let investigations=[], reports=[];
  try { investigations=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); } catch { investigations=[]; }
  try { reports=JSON.parse(localStorage.getItem('ndss-506-records') || '[]'); } catch { reports=[]; }
  const imported=reports.map(row => ({
    ...row,
    disease:cleanDiseaseLabel(row.disease),
    location:row.location || [row.tambon,row.district].filter(Boolean).join(' '),
    subdistrict:row.subdistrict || row.tambon,
    createdAt:row.importedAt || row.onset || '',
    updatedAt:row.importedAt || row.onset || '',
    source:'506'
  }));
  return [...investigations.map(row=>({...row,source:'investigation'})),...imported];
};
const countBy = (items, key, fallback = 'ไม่ระบุ') => items.reduce((all, item) => { const value = String(item[key] || fallback).trim() || fallback; all[value] = (all[value] || 0) + 1; return all; }, {});
const rankedCountRows = (rows, unit = 'ราย', maximum = Math.max(1,...rows.map(([,value])=>value))) => rows.map(([label,value]) => `<div><b>${escapeOverview(label)}</b><span><i style="width:${Math.max(8, value / Math.max(1,maximum) * 100)}%"></i></span><strong>${value} ${unit}</strong></div>`).join('');
const rankedRows = (records, key, unit = 'ราย') => rankedCountRows(Object.entries(countBy(records, key)).sort((a,b) => b[1] - a[1]),unit);
const overviewDashboard = (mode = 'dashboard') => {
  const epidemiologyMode = mode === 'epidemiology';
  const allCases = overviewCases();
  const selectedDisease = epidemiologyMode ? localStorage.getItem('ndss-epi-disease') || '' : '';
  const diseases = [...new Set(allCases.map(item => cleanDiseaseLabel(item.disease)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  const cases = selectedDisease ? allCases.filter(item => cleanDiseaseLabel(item.disease) === selectedDisease) : allCases;
  const importedCount=cases.filter(item=>item.source==='506').length;
  const investigationCount=cases.filter(item=>item.source==='investigation').length;
  const asOf = cases.reduce((latest, item) => !latest || String(item.updatedAt || item.createdAt || '') > String(latest.updatedAt || latest.createdAt || '') ? item : latest, null);
  const asOfText = asOf ? new Date(asOf.updatedAt || asOf.createdAt).toLocaleString('th-TH') : 'ยังไม่มีข้อมูล';
  const deaths = cases.filter(item => String(item.outcome || '').includes('เสียชีวิต')).length;
  const cfr = cases.length ? `${(deaths / cases.length * 100).toFixed(2)} ร้อยละ` : 'ยังไม่มีข้อมูล';
  const empty = message => `<section class="work-panel epi-empty"><strong>ยังไม่มีข้อมูล</strong><p>${message}</p></section>`;
  const tabs = [['situation','สถานการณ์โรค'],['trend','Trend'],['curve','Epidemic Curve'],['person','Person'],['place','Place'],['time','Time']];
  const diseaseCounts=Object.entries(countBy(cases,'disease')).sort((a,b)=>b[1]-a[1]);
  const storedDiseasePageSize=Number(localStorage.getItem('ndss-dashboard-disease-page-size') || 25);
  const diseasePageSize=[25,50,100].includes(storedDiseasePageSize) ? storedDiseasePageSize : 25;
  const diseasePageCount=Math.max(1,Math.ceil(diseaseCounts.length/diseasePageSize));
  const storedDiseasePage=Number(localStorage.getItem('ndss-dashboard-disease-page') || 1);
  const diseasePage=Math.min(Math.max(1,storedDiseasePage),diseasePageCount);
  const diseaseStart=(diseasePage-1)*diseasePageSize;
  const diseasePager=diseaseCounts.length > diseasePageSize ? `<div class="report-pagination dashboard-disease-pagination"><span>แสดง ${diseaseStart+1}–${Math.min(diseaseStart+diseasePageSize,diseaseCounts.length)} จาก ${diseaseCounts.length} โรค</span><label>แสดงต่อหน้า <select data-dashboard-disease-page-size aria-label="จำนวนโรคต่อหน้า"><option value="25" ${diseasePageSize===25?'selected':''}>25</option><option value="50" ${diseasePageSize===50?'selected':''}>50</option><option value="100" ${diseasePageSize===100?'selected':''}>100</option></select></label><button type="button" class="secondary" data-dashboard-disease-page="${diseasePage-1}" ${diseasePage<=1?'disabled':''}>ก่อนหน้า</button><span>หน้า ${diseasePage}/${diseasePageCount}</span><button type="button" class="secondary" data-dashboard-disease-page="${diseasePage+1}" ${diseasePage>=diseasePageCount?'disabled':''}>ถัดไป</button></div>` : '';
  const disease = cases.length ? `<section class="work-panel"><div class="panel-top"><h2>จำนวนผู้ป่วยจำแนกตามโรค</h2><small>รง.506 ${importedCount} ราย · แบบสอบสวน ${investigationCount} ราย</small></div><div class="epi-disease-list">${rankedCountRows(diseaseCounts.slice(diseaseStart,diseaseStart+diseasePageSize),'ราย',Math.max(1,...diseaseCounts.map(([,value])=>value)))}</div>${diseasePager}</section>` : empty('ยังไม่มีข้อมูล รง.506 หรือเคสที่บันทึกจากระบบแบบสอบสวนโรคออนไลน์');
  const year = new Date().getFullYear();
  const monthlyValues=Array.from({length:12},(_,month)=>[year-2,year-1,year].map(y=>cases.filter(item=>{ const d=new Date(item.onset || item.createdAt); return !Number.isNaN(d) && d.getFullYear()===y && d.getMonth()===month; }).length));
  const monthlyMax=Math.max(1,...monthlyValues.flat());
  const scaledHeight=(value,max,minimum=8,maximum=184)=>Math.max(minimum,Math.min(maximum,Math.round(value / Math.max(1,max) * maximum)));
  const trend = cases.length ? `<section class="work-panel"><h2>จำนวนผู้ป่วยรายเดือนย้อนหลัง 3 ปี</h2><small>Legend: ${[year-2,year-1,year].map((y,i)=>`<i class="epi-year y${i}"></i> ${y+543}`).join('　')}</small><div class="epi-month-chart">${monthlyValues.map((values,month)=>`<div><span>${values.map((v,i)=>`<b class="y${i}" style="height:${scaledHeight(v,monthlyMax,3)}px" title="${v} ราย"></b>`).join('')}</span><small>${month+1}</small></div>`).join('')}</div><p class="epi-note">กราฟแสดงจำนวนเคสที่มีวันเริ่มป่วยหรือวันบันทึกอยู่ในแต่ละเดือน · แท่งสูงสุดในชุดข้อมูลเท่ากับ ${monthlyMax} ราย</p></section>` : empty('ต้องมีวันเริ่มป่วยหรือวันบันทึกจึงจะแสดงกราฟย้อนหลังได้');
  const dated = cases.filter(item => item.onset || item.createdAt);
  const weekKey = item => { const d=new Date(item.onset || item.createdAt); const first=new Date(d.getFullYear(),0,1); return `${d.getFullYear()}-W${String(Math.ceil((((d-first)/86400000)+first.getDay()+1)/7)).padStart(2,'0')}`; };
  const weekRows = Object.entries(countBy(dated.map(item => ({ week:weekKey(item) })),'week')).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
  const weekMax=Math.max(1,...weekRows.map(([,value])=>value));
  const curve = weekRows.length ? `<section class="work-panel"><h2>Epidemic Curve · สัปดาห์เริ่มป่วย</h2><div class="epi-bars">${weekRows.map(([label,value])=>`<div><b style="height:${scaledHeight(value,weekMax)}px" title="${value} ราย"></b><small>${label}</small></div>`).join('')}</div><p class="epi-note">รูปแบบการกระจายแสดงเชิงพรรณนาตามสัปดาห์เริ่มป่วยเท่านั้น และยังไม่สรุปสาเหตุหรือรูปแบบการระบาด</p></section>` : empty('ยังไม่มีวันเริ่มป่วยหรือวันบันทึกสำหรับจัดกลุ่มตามสัปดาห์');
  const ageBand = item => { const age=Number(item.age); if(!Number.isFinite(age)) return 'ไม่ระบุ'; return age<5?'0–4 ปี':age<15?'5–14 ปี':age<60?'15–59 ปี':'60 ปีขึ้นไป'; };
  const person = cases.length ? `<section class="epi-split"><article class="work-panel"><h2>Person · กลุ่มอายุ</h2><div class="epi-disease-list">${rankedRows(cases.map(item=>({...item,ageBand:ageBand(item)})),'ageBand')}</div></article><article class="work-panel"><h2>Person · เพศและสัญชาติ</h2><div class="epi-disease-list">${rankedRows(cases,'sex')}${rankedRows(cases,'nationality')}</div><p class="epi-note">แสดงตามข้อมูลที่บันทึกในแบบสอบสวนโรค</p></article></section>` : empty('ยังไม่มีข้อมูลบุคคลจากแบบสอบสวนโรค');
  const place = cases.length ? `<section class="work-panel"><h2>Place · การกระจายเชิงพื้นที่</h2><p class="epi-limit">ขอบเขตข้อมูลปัจจุบัน: ระดับอำเภอจากแบบสอบสวนโรคออนไลน์เท่านั้น จึงจัดอันดับเฉพาะภายในขอบเขตนี้ และไม่เปรียบเทียบข้ามระดับพื้นที่</p><div class="epi-disease-list">${rankedRows(cases,'district')}</div><p class="epi-note">ตัวเลขในวงเล็บหมายถึงจำนวนผู้ป่วย (ราย); ยังไม่มีฐานประชากรสำหรับคำนวณอัตราป่วยต่อประชากรแสนคน</p></section>` : empty('ยังไม่มีข้อมูลพื้นที่ที่บันทึกในแบบสอบสวนโรค');
  const time = weekRows.length ? `<section class="work-panel"><h2>Time · แนวโน้มรายสัปดาห์</h2><div class="epi-bars">${weekRows.map(([label,value])=>`<div><b style="height:${scaledHeight(value,weekMax)}px" title="${value} ราย"></b><small>${label}</small></div>`).join('')}</div><p class="epi-note">ยังไม่มีข้อมูลครบ 5 ปีย้อนหลัง จึงยังไม่สามารถเปรียบเทียบกับค่ามัธยฐาน 5 ปีได้ การแสดงผลนี้เป็นเพียงแนวโน้มเชิงพรรณนาตามเวลา</p></section>` : empty('ยังไม่มีข้อมูลตามสัปดาห์สำหรับการแสดงแนวโน้มเวลา');
  const filter = epidemiologyMode ? `<section class="analytics-filter epi-filter"><label>เลือกโรคสำหรับวิเคราะห์<select data-epi-disease-filter aria-label="เลือกโรคสำหรับวิเคราะห์"><option value="">ทุกโรค</option>${diseases.map(name=>`<option value="${escapeOverview(name)}" ${name===selectedDisease?'selected':''}>${escapeOverview(name)}</option>`).join('')}</select><small>${selectedDisease ? `กำลังแสดงข้อมูลโรค ${escapeOverview(selectedDisease)}` : 'กำลังแสดงข้อมูลทุกโรค'}</small></label></section>` : '';
  return `<div class="module-page overview-page"><section class="module-head"><div><h1>${epidemiologyMode ? 'Dashboard ระบาดวิทยา' : 'Dashboard'}</h1><p>${epidemiologyMode ? 'วิเคราะห์สถานการณ์โรคตามกรอบ Person – Place – Time' : 'ภาพรวมสถานการณ์'} จากข้อมูล ณ วันที่: ${asOfText}</p></div></section>${filter}<section class="epi-dashboard"><div class="epi-tabs" role="tablist">${tabs.map(([id,label],index)=>`<button type="button" class="${index===0?'active':''}" data-epi-tab="${id}" role="tab">${label}</button>`).join('')}</div><div class="epi-pane active" data-epi-pane="situation"><p class="epi-standard">ข้อมูลจากการเฝ้าระวังโรค จากระบบเฝ้าระวังโรคดิจิทัล (Digital Disease Surveillance; DDS)</p><div class="module-cards"><article class="blue"><span>จำนวนผู้ป่วยสะสม</span><strong>${cases.length} ราย</strong><small>หน่วย: ราย</small></article><article><span>อัตราป่วย</span><strong>ยังไม่มีข้อมูล</strong><small>ต่อประชากรแสนคน · ต้องมีฐานประชากร</small></article><article class="red"><span>ผู้เสียชีวิต / อัตราตาย</span><strong>${deaths} ราย</strong><small>ต่อประชากรแสนคน: ยังไม่มีข้อมูล</small></article><article class="orange"><span>อัตราป่วยตาย (CFR)</span><strong>${cfr}</strong><small>หน่วย: ร้อยละ</small></article></div>${disease}</div><div class="epi-pane" data-epi-pane="trend" hidden>${trend}</div><div class="epi-pane" data-epi-pane="curve" hidden>${curve}</div><div class="epi-pane" data-epi-pane="person" hidden>${person}</div><div class="epi-pane" data-epi-pane="place" hidden>${place}</div><div class="epi-pane" data-epi-pane="time" hidden>${time}</div></section></div>`;
};
document.querySelector('#app').innerHTML = shell(overviewDashboard());
const root = document.querySelector('#module-root');
const ensureRefreshButton = () => {
  const actions=document.querySelector('.command-header .header-actions');
  if (!actions || actions.querySelector('[data-refresh-view]')) return;
  const button=document.createElement('button');
  button.type='button';
  button.className='header-import header-refresh';
  button.dataset.refreshView='true';
  button.setAttribute('aria-label','รีเฟรชข้อมูล');
  button.textContent='↻ รีเฟรช';
  actions.prepend(button);
};
ensureRefreshButton();
document.addEventListener('click', event => {
  if (!event.target.closest('[data-refresh-view]')) return;
  window.location.reload();
});
const mobileNavToggle = document.querySelector('[data-mobile-nav-toggle]');
const setMobileMenuOpen = open => {
  const sidebar = document.querySelector('.command-sidebar');
  const state = document.querySelector('#mobile-sidebar-state');
  sidebar?.classList.toggle('mobile-open', open);
  if (state) state.checked = open;
  setMobileNavToggleState(document.querySelector('[data-mobile-nav-toggle]'), open);
};
mobileNavToggle?.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  const sidebar = document.querySelector('.command-sidebar');
  if (!sidebar) return;
  setMobileMenuOpen(!sidebar.classList.contains('mobile-open'));
});
document.querySelector('[data-mobile-nav-close]')?.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  setMobileMenuOpen(false);
});
document.addEventListener('change', event => {
  if (!event.target.matches('#mobile-sidebar-state')) return;
  setMobileMenuOpen(event.target.checked);
});
document.addEventListener('keydown', event => {
  if (!['Enter',' '].includes(event.key)) return;
  if (!event.target.closest('.mobile-nav-toggle,.mobile-sidebar-close')) return;
  event.preventDefault();
  const sidebar = document.querySelector('.command-sidebar');
  setMobileMenuOpen(!sidebar?.classList.contains('mobile-open'));
});
const roleDefinitions = {
  admin: ['ADMIN', 'จัดการบัญชีและข้อมูลทั้งหมด'],
  officer: ['OFFICER', 'จัดการรายการที่ได้รับมอบหมาย'],
  viewer: ['VIEWER', 'ดูข้อมูลตามสิทธิ์ที่อนุญาต'],
};
const renderLoginGate = (mode = 'login') => {
  document.querySelector('.ndss-login-gate')?.remove();
  const role = getSupabaseRole();
  const signedIn = hasSupabaseSession();
  const allowed = Object.hasOwn(roleDefinitions, role);
  if (allowed) return;
  const message = signedIn
    ? 'บัญชีนี้กำลังรอการอนุมัติสิทธิ์จากผู้ดูแลระบบ กรุณาติดต่อผู้ดูแล NDSS'
    : mode === 'register'
      ? 'ลงทะเบียนด้วยอีเมลและรหัสผ่าน แล้วเลือกบทบาทที่ต้องการขอใช้บริการ'
      : 'เข้าสู่ระบบด้วยอีเมลและรหัสผ่านของเจ้าหน้าที่';
  const actions = signedIn
    ? '<button type="button" class="secondary" data-supabase-signout>ออกจากระบบ</button>'
    : mode === 'register'
      ? `<form class="ndss-login-actions" data-auth-form="register"><label>ชื่อ-สกุล<input name="fullName" type="text" autocomplete="name" placeholder="เช่น สมชาย ใจดี" required /></label><label>เบอร์โทรศัพท์<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="เช่น 0812345678" required /></label><label>อีเมล<input name="email" type="email" placeholder="name@hospital.go.th" autocomplete="email" required /></label><label>รหัสผ่าน<div class="password-field"><input name="password" type="password" autocomplete="new-password" minlength="8" required /><button type="button" data-toggle-password aria-label="แสดงรหัสผ่าน">◉</button></div></label><label>ยืนยันรหัสผ่าน<div class="password-field"><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /><button type="button" data-toggle-password aria-label="แสดงรหัสผ่าน">◉</button></div></label><p class="ndss-auth-note">หลังลงทะเบียน บัญชีจะรอให้ ADMIN กำหนดสิทธิ์ก่อนจึงจะเข้าใช้งานได้</p><button type="submit" class="primary" ${hasSupabaseCredentials() ? '' : 'disabled'}>ลงทะเบียนผู้ใช้งาน</button><button type="button" class="text-button" data-auth-mode="login">มีบัญชีแล้ว? เข้าสู่ระบบ</button></form>`
      : `<form class="ndss-login-actions" data-auth-form="login"><label>อีเมล<input name="email" type="email" placeholder="name@hospital.go.th" autocomplete="email" required /></label><label>รหัสผ่าน<div class="password-field"><input name="password" type="password" autocomplete="current-password" required /><button type="button" data-toggle-password aria-label="แสดงรหัสผ่าน">◉</button></div></label><button type="submit" class="primary" ${hasSupabaseCredentials() ? '' : 'disabled'}>เข้าสู่ระบบ</button><button type="button" class="text-button" data-password-recovery>ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่</button><p class="ndss-auth-note">บัญชีที่ลงทะเบียนใหม่จะใช้งานได้เมื่อ ADMIN จัดการสิทธิ์ในระบบแล้ว</p><button type="button" class="text-button" data-auth-mode="register">ลงทะเบียนผู้ใช้งาน</button></form>`;
  const gate = document.createElement('section');
  gate.className = 'ndss-login-gate';
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('role', 'dialog');
  gate.innerHTML = `<div class="ndss-login-card"><img src="./public/assets/naradhiwas-hospital-logo.jpg" alt="โลโก้โรงพยาบาลนราธิวาสราชนครินทร์" /><p class="ndss-login-kicker">NDSS · Secure Access</p><h1>${mode === 'register' ? 'ลงทะเบียนผู้ใช้งาน' : 'เข้าสู่ระบบเฝ้าระวังโรค'}</h1><p>${message}</p>${actions}<div class="ndss-role-guide"><strong>สิทธิ์การใช้งาน</strong><span><b>ADMIN</b> จัดการบัญชีและข้อมูลทั้งหมด</span><span><b>OFFICER</b> จัดการรายการที่ได้รับมอบหมาย</span><span><b>VIEWER</b> ดูข้อมูลตามสิทธิ์ที่อนุญาต</span></div><small>ข้อมูลผู้ป่วยจะไม่แสดงจนกว่าจะผ่านการยืนยันตัวตนและได้รับสิทธิ์ที่เหมาะสม</small></div>`;
  document.body.append(gate);
};
const renderPasswordRecoveryGate = () => {
  document.querySelector('.ndss-login-gate')?.remove();
  const gate = document.createElement('section');
  gate.className = 'ndss-login-gate'; gate.setAttribute('aria-modal', 'true'); gate.setAttribute('role', 'dialog');
  gate.innerHTML = `<div class="ndss-login-card"><img src="./public/assets/naradhiwas-hospital-logo.jpg" alt="โลโก้โรงพยาบาลนราธิวาสราชนครินทร์" /><p class="ndss-login-kicker">NDSS · Secure Access</p><h1>ตั้งรหัสผ่านใหม่</h1><p>กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ</p><form class="ndss-login-actions" data-password-recovery-form><label>รหัสผ่านใหม่<div class="password-field"><input name="password" type="password" autocomplete="new-password" minlength="8" required /><button type="button" data-toggle-password aria-label="แสดงรหัสผ่าน">◉</button></div></label><label>ยืนยันรหัสผ่านใหม่<div class="password-field"><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /><button type="button" data-toggle-password aria-label="แสดงรหัสผ่าน">◉</button></div></label><button type="submit" class="primary">บันทึกรหัสผ่านใหม่</button></form></div>`;
  document.body.append(gate);
};
if (authCallbackType === 'recovery' && hasSupabaseSession()) renderPasswordRecoveryGate(); else renderLoginGate();
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
  const authReady = hasSupabaseCredentials();
  const signedIn = hasSupabaseSession();
  section.innerHTML = `<div class="panel-top"><div><h2>ตรวจสอบความพร้อมก่อนใช้งาน</h2><small>ตรวจเฉพาะความพร้อมของอุปกรณ์และการตั้งค่าหน้านี้ โดยไม่ส่งข้อมูลผู้ป่วยออกจากเครื่อง</small></div><button type="button" class="primary" data-run-preflight>ตรวจสอบตอนนี้</button></div><div class="command-list" data-preflight-results><div><b>ยังไม่ได้ตรวจสอบ</b><span>กดปุ่มเพื่อตรวจสอบองค์ประกอบสำคัญของระบบ</span></div></div><div class="panel-top" data-supabase-auth><div><h2>บัญชี Supabase</h2><small>${authReady ? (signedIn ? `เข้าสู่ระบบแล้ว · สิทธิ์ ${roleDefinitions[getSupabaseRole()]?.[0] || 'รออนุมัติ'}` : 'เข้าสู่ระบบด้วยอีเมลและรหัสผ่านเพื่อใช้งานข้อมูลส่วนกลาง') : 'ยังไม่ได้กำหนด publishable key'}</small></div>${signedIn ? '<button type="button" class="secondary" data-supabase-signout>ออกจากระบบ</button>' : '<button type="button" class="primary" data-open-login>เข้าสู่ระบบ / ลงทะเบียน</button>'}</div>`;
  health.after(section);
};
const renderAdminUserManagement = users => {
  const section = root.querySelector('[data-admin-user-management]');
  const body = section?.querySelector('[data-admin-users]');
  if (!body) return;
  body.innerHTML = users.length ? users.map(user => {
    const role = String(user.role || 'pending').toLowerCase();
    const requested = String(user.requestedRole || '').toUpperCase() || '-';
    const accountStatus = user.bannedUntil ? 'suspended' : roleDefinitions[role] ? 'active' : 'pending';
    const status = accountStatus === 'suspended' ? 'ระงับแล้ว' : accountStatus === 'active' ? 'ใช้งานได้' : 'รออนุมัติ';
    const isSelf = user.id === getSupabaseUser().sub;
    return `<tr><td><b>${escapeOverview(user.fullName || '-')}</b><small>${escapeOverview(user.email || '-')} · ${escapeOverview(user.phone || '-')}</small><small>${escapeOverview(user.id)}</small><small>${user.confirmedAt ? 'ยืนยันอีเมลแล้ว' : 'รอยืนยันอีเมล'}</small></td><td><span class="role-pill ${role}">${roleDefinitions[role]?.[0] || 'PENDING'}</span><small>ขอ: ${escapeOverview(requested)}</small></td><td><b>${status}</b></td><td>${user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString('th-TH') : '-'}</td><td><div class="admin-user-actions"><label>สิทธิ์<select data-user-role="${escapeOverview(user.id)}" ${isSelf ? 'disabled' : ''}><option value="officer" ${role === 'officer' ? 'selected' : ''}>OFFICER</option><option value="viewer" ${role === 'viewer' ? 'selected' : ''}>VIEWER</option><option value="admin" ${role === 'admin' ? 'selected' : ''}>ADMIN</option></select></label><label>สถานะ<select data-user-status="${escapeOverview(user.id)}" ${isSelf ? 'disabled' : ''}><option value="pending" ${accountStatus === 'pending' ? 'selected' : ''}>รออนุมัติ</option><option value="active" ${accountStatus === 'active' ? 'selected' : ''}>เปิดใช้งาน</option><option value="suspended" ${accountStatus === 'suspended' ? 'selected' : ''}>ระงับบัญชี</option></select></label>${isSelf ? '<small>ไม่สามารถลดสิทธิ์หรือระงับบัญชีตนเอง</small>' : `<button type="button" class="table-action" data-admin-user-action="update" data-user-id="${escapeOverview(user.id)}">บันทึกสิทธิ์</button><button type="button" class="table-action danger" data-admin-user-action="delete" data-user-id="${escapeOverview(user.id)}">ลบ</button>`}</div></td></tr>`;
  }).join('') : '<tr><td colspan="5">ยังไม่มีบัญชีผู้ใช้</td></tr>';
};
const loadAdminUsers = async () => {
  if (getSupabaseRole() !== 'admin') return;
  const section = root.querySelector('[data-admin-user-management]');
  if (!section) return;
  try { renderAdminUserManagement((await invokeAdminUserManagement('list')).users || []); }
  catch (error) { section.querySelector('[data-admin-users]').innerHTML = `<tr><td colspan="5">${escapeOverview(error.message)}</td></tr>`; }
};
const enhanceAdminUserManagement = () => {
  const heading = root.querySelector('.command-head h1');
  if (heading?.textContent !== 'ตั้งค่าและสถานะระบบ' || getSupabaseRole() !== 'admin' || root.querySelector('[data-admin-user-management]')) return;
  const section = document.createElement('section');
  section.className = 'work-panel admin-user-management'; section.dataset.adminUserManagement = 'true';
  section.innerHTML = `<div class="panel-top"><div><h2>จัดการบัญชีและสิทธิ์ผู้ใช้งาน</h2><small>เฉพาะ ADMIN: เลือกสิทธิ์และสถานะ รออนุมัติ / เปิดใช้งาน / ระงับบัญชี / ลบบัญชี ได้จากตารางเดียว</small></div><button type="button" class="secondary" data-refresh-admin-users>รีเฟรช</button></div><div class="responsive-table"><table><thead><tr><th>บัญชี</th><th>สิทธิ์ปัจจุบัน</th><th>สถานะ</th><th>เข้าสู่ระบบล่าสุด</th><th>จัดการ</th></tr></thead><tbody data-admin-users><tr><td colspan="5">กำลังโหลดบัญชี...</td></tr></tbody></table></div><p class="scope-note">การเปลี่ยนสิทธิ์มีผลเมื่อผู้ใช้เข้าสู่ระบบใหม่หรือรีเฟรช session ครั้งถัดไป เพื่อให้ JWT รับ app metadata ชุดใหม่</p>`;
  root.querySelector('[data-settings-preflight]')?.after(section);
  loadAdminUsers();
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
  enhanceAdminUserManagement();
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
enhanceAdminUserManagement();
enhanceImportQualityActions();
enhanceKnowledgeForms();
enhanceExportHistory();

const setMobileNavToggleState=(trigger,open)=>{
  if(!trigger) return;
  trigger.setAttribute('aria-expanded',String(open));
  trigger.setAttribute('aria-label',open ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก');
  trigger.innerHTML=open ? '✕ <span>ปิดเมนู</span>' : '☰ <span>เมนู</span>';
};
document.addEventListener('click', event => {
  if (event.target.closest('[data-run-preflight]')) { runPreflight(); return; }
  if (event.target.closest('[data-supabase-signout]')) { clearSupabaseSession().finally(() => { showToast('ออกจากระบบแล้ว', 'success'); setTimeout(() => location.reload(), 350); }); return; }
  if (event.target.closest('[data-open-login]')) { renderLoginGate('login'); return; }
  const switchMode = event.target.closest('[data-auth-mode]');
  if (switchMode) { renderLoginGate(switchMode.dataset.authMode); return; }
  const passwordRecovery = event.target.closest('[data-password-recovery]');
  if (passwordRecovery) {
    const email = document.querySelector('.ndss-login-gate [name="email"]')?.value.trim() || '';
    if (!email) { showToast('กรุณาระบุอีเมลก่อนขอตั้งรหัสผ่านใหม่', 'info'); return; }
    passwordRecovery.disabled = true;
    requestSupabasePasswordRecovery(email)
      .then(() => showToast('หากบัญชีนี้มีอยู่ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลที่ระบุแล้ว', 'success'))
      .catch(error => showToast(error.message, 'error'))
      .finally(() => { passwordRecovery.disabled = false; });
    return;
  }
  const toggle = event.target.closest('[data-toggle-password]');
  if (toggle) { const input = toggle.closest('.password-field')?.querySelector('input'); if (input) { const isPassword = input.type === 'password'; input.type = isPassword ? 'text' : 'password'; toggle.textContent = isPassword ? '◉' : '◌'; toggle.setAttribute('aria-label', isPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'); } return; }
  if (event.target.closest('[data-refresh-admin-users]')) { loadAdminUsers(); return; }
  const adminAction = event.target.closest('[data-admin-user-action]');
  if (adminAction) {
    const id = adminAction.dataset.userId;
    const action = adminAction.dataset.adminUserAction;
    const select = root.querySelector(`[data-user-role="${CSS.escape(id)}"]`);
    const status = root.querySelector(`[data-user-status="${CSS.escape(id)}"]`);
    if (action === 'delete' && !confirm('ต้องการลบบัญชีนี้อย่างถาวรใช่หรือไม่?')) return;
    adminAction.disabled = true;
    invokeAdminUserManagement(action, { userId: id, role: select?.value, status: status?.value }).then(() => {
      showToast(action === 'delete' ? 'ลบบัญชีแล้ว' : action === 'update' ? 'บันทึกสิทธิ์และสถานะบัญชีแล้ว' : action === 'suspend' ? 'ระงับบัญชีแล้ว' : action === 'resume' ? 'ปลดระงับบัญชีแล้ว' : 'บันทึกสิทธิ์บัญชีแล้ว', 'success');
      loadAdminUsers();
    }).catch(error => showToast(error.message, 'error')).finally(() => { adminAction.disabled = false; });
    return;
  }
  const filterButton = event.target.closest('[data-alert-filter]');
  if (!filterButton) return;
  root.querySelectorAll('[data-alert-filter]').forEach(button => {
    button.classList.toggle('active', button === filterButton);
  });
  applyAlertFilter(filterButton.dataset.alertFilter);
});

document.addEventListener('submit', event => {
  const recoveryForm = event.target.closest('[data-password-recovery-form]');
  if (recoveryForm) {
    event.preventDefault();
    const values = new FormData(recoveryForm);
    const password = String(values.get('password') || '');
    if (password !== String(values.get('confirmPassword') || '')) { showToast('ยืนยันรหัสผ่านไม่ตรงกัน', 'error'); return; }
    const submit = recoveryForm.querySelector('[type="submit"]');
    submit.disabled = true;
    updateSupabasePassword(password).then(() => {
      showToast('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง', 'success');
      clearSupabaseSession().finally(() => setTimeout(() => location.reload(), 450));
    }).catch(error => { showToast(error.message, 'error'); submit.disabled = false; });
    return;
  }
  const form = event.target.closest('[data-auth-form]');
  if (!form) return;
  event.preventDefault();
  const values = new FormData(form);
  const email = String(values.get('email') || '').trim();
  const password = String(values.get('password') || '');
  const fullName = String(values.get('fullName') || '').trim();
  const phone = String(values.get('phone') || '').trim();
  const submit = form.querySelector('[type="submit"]');
  if (!email || !password) { showToast('กรุณาระบุอีเมลและรหัสผ่าน', 'info'); return; }
  if (form.dataset.authForm === 'register' && (!fullName || !phone)) { showToast('กรุณาระบุชื่อ-สกุลและเบอร์โทรศัพท์', 'error'); return; }
  if (form.dataset.authForm === 'register' && password !== String(values.get('confirmPassword') || '')) { showToast('ยืนยันรหัสผ่านไม่ตรงกัน', 'error'); return; }
  submit.disabled = true;
  const task = form.dataset.authForm === 'register'
    ? signUpWithPassword({ email, password, fullName, phone })
    : signInWithPassword({ email, password });
  task.then(() => {
    if (form.dataset.authForm === 'register') { showRegistrationSuccess(); renderLoginGate('login'); }
    else { showToast('เข้าสู่ระบบสำเร็จ', 'success'); setTimeout(() => location.reload(), 250); }
  }).catch(error => {
    const message = form.dataset.authForm === 'login' && !String(error.message).includes('จัดการสิทธิ์ในระบบ')
      ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่พร้อมใช้งาน'
      : error.message;
    showToast(message, 'error');
  }).finally(() => { submit.disabled = false; });
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
  const mobileSidebarState=document.querySelector('#mobile-sidebar-state');
  const closeMobileNav=({restoreFocus=false}={})=>{
    if (!sidebar?.classList.contains('mobile-open') && !mobileSidebarState?.checked) return;
    sidebar.classList.remove('mobile-open');
    if (mobileSidebarState) mobileSidebarState.checked=false;
    const trigger=document.querySelector('[data-mobile-nav-toggle]');
    setMobileNavToggleState(trigger,false);
    if (restoreFocus) trigger?.focus();
  };
  if (toggle && sidebar) {
    const open=sidebar.classList.toggle('mobile-open');
    setMobileNavToggleState(toggle,open);
    return;
  }
  if (event.target.closest('.mobile-nav-toggle')) return;
  if ((sidebar?.classList.contains('mobile-open') || mobileSidebarState?.checked) && (event.target.closest('.command-sidebar [data-view]') || !event.target.closest('.command-sidebar'))) {
    closeMobileNav();
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const sidebar=document.querySelector('.command-sidebar');
  const mobileSidebarState=document.querySelector('#mobile-sidebar-state');
  if (!sidebar?.classList.contains('mobile-open') && !mobileSidebarState?.checked) return;
  sidebar.classList.remove('mobile-open');
  if (mobileSidebarState) mobileSidebarState.checked=false;
  const trigger=document.querySelector('[data-mobile-nav-toggle]');
  setMobileNavToggleState(trigger,false);
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
  const segments=byDisease.slice(0,5).map(([name,count],index)=>{ const size=records.length ? count/records.length*100 : 0; const segment=`${colors[index]} ${position}% ${position+size}%`; position+=size; return segment; });
  if(position<100) segments.push(`#dfe8f1 ${position}% 100%`);
  const topDisease=byDisease[0] || ['ยังไม่มีข้อมูล',0];
  const waiting=tasks.filter(item=>item.status!=='ควบคุมแล้ว').length;
  const panel = records.length ? `<section class="reference-dashboard"><section class="reference-stats"><article class="blue"><span>ผู้ป่วยสะสม (ทุกตัวกรอง)</span><strong>${records.length.toLocaleString('th-TH')}</strong><small>จาก รง.506 และแบบสอบสวน</small></article><article class="purple"><span>โรคที่รายงานมากที่สุด</span><strong>${escapeOverview(topDisease[0])}</strong><small>${topDisease[1]} ราย · ตามข้อมูลปัจจุบัน</small></article><article class="red"><span>คิวที่ต้องติดตาม</span><strong>${waiting} งาน</strong><small>งานที่ยังไม่ปิดการดำเนินการ</small></article><article class="orange"><span>โรคที่ต้องเฝ้าระวัง</span><strong>${byDisease.length} โรค</strong><small>จำแนกตามชื่อโรคในข้อมูล</small></article><article class="green"><span>ผู้ป่วยใน (IPD)</span><strong>ยังไม่มีข้อมูล</strong><small>ต้องมีคอลัมน์ประเภทผู้ป่วย</small></article></section><section class="reference-grid"><article class="work-panel reference-curve"><div class="panel-top"><h2>▥ เส้นโค้งการระบาด (Epidemic Curve) รายเดือน</h2><small>12 เดือนล่าสุด · หน่วย: ราย</small></div><div class="reference-bars">${months.map(item=>`<div><b style="height:${Math.max(5,item.count/max*100)}%" title="${item.count} ราย"></b><small>${item.label}</small></div>`).join('')}</div><p class="reference-legend">ข้อมูลแสดงตามวันเริ่มป่วยหรือวันบันทึกที่มีในระบบ</p></article><article class="work-panel reference-share"><div class="panel-top"><h2>◉ สัดส่วนตามหมวดโรค</h2><small>หน่วย: ราย</small></div><div class="reference-donut" style="background:conic-gradient(${segments.join(',')})"><i>${records.length}<small>ราย</small></i></div><div class="reference-donut-legend">${byDisease.slice(0,5).map(([name,count],index)=>`<span><i style="background:${colors[index]}"></i>${escapeOverview(name)} <b>${count}</b></span>`).join('')}</div></article></section><section class="reference-grid bottom"><article class="work-panel"><div class="panel-top"><h2>☘ 10 อันดับโรคที่พบมากที่สุด</h2><small>เรียงตามจำนวนรายงาน</small></div><div class="ranked-list">${byDisease.slice(0,10).map(([name,count],index)=>`<div><b>${index+1}</b><span>${escapeOverview(name)}</span><i><em style="width:${count/(topDisease[1]||1)*100}%"></em></i><strong>${count} ราย</strong></div>`).join('')}</div></article><article class="work-panel"><div class="panel-top"><h2>▤ การกระจายตามพื้นที่</h2><small>ตำบล/อำเภอตามขอบเขตข้อมูล</small></div><div class="reference-area-table"><table><thead><tr><th>#</th><th>พื้นที่</th><th>ผู้ป่วย</th><th>โรคที่พบ</th><th>คิวติดตาม</th></tr></thead><tbody>${byArea.slice(0,8).map(([area,count],index)=>{ const diseases=new Set(records.filter(item=>(item.tambon || item.subdistrict || item.district || item.location || 'ไม่ระบุ')===area).map(item=>item.disease).filter(Boolean)); return `<tr><td>${index+1}</td><td><b>${escapeOverview(area)}</b></td><td>${count}</td><td>${diseases.size} โรค</td><td>${tasks.filter(task=>String(task.note || '').includes(area)).length}</td></tr>`; }).join('')}</tbody></table></div><p class="scope-note">จัดอันดับภายในระดับพื้นที่ที่มีในข้อมูลเท่านั้น และไม่เปรียบเทียบข้ามขอบเขต</p></article></section></section>` : `<section class="reference-dashboard reference-empty"><div><h2>แดชบอร์ดสถานการณ์โรค</h2><p>ยังไม่มีข้อมูล รง.506 หรือแบบสอบสวนในอุปกรณ์นี้ เริ่มต้นด้วยการนำเข้า Excel หรือบันทึกแบบสอบสวนโรคออนไลน์</p><button class="primary" type="button" data-open-506-import>＋ นำเข้า Excel</button></div></section>`;
  page.querySelector('.epi-dashboard')?.insertAdjacentHTML('beforebegin',panel);
};
renderCommandDashboard();
const refreshOverview = () => { if (root.querySelector('.overview-page')) { const mode=document.querySelector('.nav-link.active')?.dataset.view === 'epidemiology' ? 'epidemiology' : 'dashboard'; root.innerHTML = overviewDashboard(mode); renderCommandDashboard(); } };
const refreshEpidemiology = () => {
  if (document.querySelector('.nav-link.active')?.dataset.view !== 'epidemiology') return;
  const activeTab=root.querySelector('.epi-dashboard [data-epi-tab].active')?.dataset.epiTab || 'situation';
  root.innerHTML=overviewDashboard('epidemiology');
  renderCommandDashboard();
  root.querySelector(`[data-epi-tab="${activeTab}"]`)?.click();
};
const refreshDataViews = () => { refreshOverview(); refreshEpidemiology(); };
window.addEventListener('ndss-cases-updated', refreshDataViews);
window.addEventListener('storage', event => {
  if (['ndss-investigations','ndss-506-records'].includes(event.key)) refreshDataViews();
  if (['ndss-investigations','ndss-case-contacts','ndss-response-tasks','ndss-lab-results','ndss-506-records','ndss-alert-state'].includes(event.key)) {
    updateNotificationBadge();
    refreshAlertView();
  }
});
const showLocalAlert = (title, message, icon = 'success', duration = 2600) => {
  document.querySelector('.ndss-system-alert')?.remove();
  const alert = document.createElement('div');
  alert.className = 'ndss-system-alert';
  alert.dataset.icon = icon;
  alert.setAttribute('role', 'status');
  alert.innerHTML = '<span aria-hidden="true"></span><div><strong></strong><p></p></div>';
  alert.querySelector('span').textContent = icon === 'error' ? '!' : icon === 'warning' ? '!' : icon === 'info' ? 'i' : '✓';
  alert.querySelector('strong').textContent = title;
  alert.querySelector('p').textContent = message;
  document.body.append(alert);
  setTimeout(() => alert.remove(), duration);
};
const showToast = (message, icon = 'success') => {
  const resolvedIcon = icon === 'success' && /ไม่สามารถ|ไม่สำเร็จ/.test(message) ? 'error' : icon === 'success' && /ยังไม่มี/.test(message) ? 'info' : icon;
  if (window.Swal) {
    window.Swal.fire({
      toast: false,
      position: 'center',
      icon: resolvedIcon,
      title: message,
      showConfirmButton: false,
      timer: 2600,
      timerProgressBar: true,
      backdrop: false,
      allowOutsideClick: true,
      width: 360,
      customClass: { popup: 'ndss-swal-popup' }
    });
    return;
  }
  const title = resolvedIcon === 'error' ? 'ไม่สามารถดำเนินการได้' : resolvedIcon === 'warning' ? 'โปรดตรวจสอบ' : resolvedIcon === 'info' ? 'แจ้งเตือน' : 'ดำเนินการสำเร็จ';
  showLocalAlert(title, message, resolvedIcon);
};
const showRegistrationSuccess = () => {
  const message = 'คำขอลงทะเบียนถูกบันทึกแล้ว กรุณารอ ADMIN กำหนดสิทธิ์ก่อนเข้าใช้งาน';
  if (window.Swal) {
    window.Swal.fire({
      icon: 'success',
      title: 'ลงทะเบียนสำเร็จ',
      text: message,
      position: 'center',
      showConfirmButton: false,
      timer: 3600,
      timerProgressBar: true,
      backdrop: false,
      allowOutsideClick: true,
      width: 390,
      customClass: { popup: 'ndss-swal-popup' }
    });
    return;
  }
  showLocalAlert('ลงทะเบียนสำเร็จ', message, 'success', 3600);
};
const confirmAction = async (title, text) => {
  if (window.Swal) {
    const result = await window.Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#d33',
      reverseButtons: true,
      customClass: { popup: 'ndss-swal-popup' }
    });
    return result.isConfirmed;
  }
  return window.confirm(text);
};
document.addEventListener('click', async event => {
  const action=event.target.closest('[data-delete-case],[data-delete-contact],[data-delete-lab],[data-delete-ai-report],[data-clear-pins],[data-clear-506],[data-clear-audit]');
  if(!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(action.matches('[data-clear-pins]')) {
    if(!await confirmAction('ยืนยันการล้างหมุดเคส','ข้อมูลเคสสอบสวนทั้งหมดในอุปกรณ์นี้จะถูกลบ ต้องการดำเนินการหรือไม่?')) return;
    localStorage.removeItem('ndss-investigations'); activeDiseaseFilter='all'; recordAudit('ล้างเคสสอบสวน','ล้างข้อมูลเคสและหมุดทั้งหมดในอุปกรณ์นี้'); window.dispatchEvent(new Event('ndss-cases-updated')); renderPins(); renderHistory(); showToast('ล้างหมุดเคสและข้อมูลเคสแล้ว');
    return;
  }
  if(action.matches('[data-clear-506]')) {
    if(!await confirmAction('ยืนยันการล้างข้อมูล รง.506','ข้อมูล รง.506 ที่นำเข้าในอุปกรณ์นี้จะถูกลบ ต้องการดำเนินการหรือไม่?')) return;
    localStorage.removeItem('ndss-506-records'); localStorage.removeItem('ndss-506-import-meta');
    recordAudit('ล้างข้อมูล รง.506','ล้างข้อมูลที่นำเข้าในอุปกรณ์นี้'); root.querySelector('[data-import-status]')?.replaceChildren(document.createTextNode('ล้างข้อมูลนำเข้าแล้ว')); window.dispatchEvent(new Event('ndss-cases-updated')); showToast('ล้างข้อมูล รง.506 แล้ว');
    return;
  }
  if(action.matches('[data-clear-audit]')) {
    if(!await confirmAction('ยืนยันการล้างประวัติกิจกรรม','ประวัติการทำงานทั้งหมดในอุปกรณ์นี้จะถูกลบ ต้องการดำเนินการหรือไม่?')) return;
    localStorage.removeItem('ndss-audit-log'); root.innerHTML=`<div class="module-page">${moduleView('audit')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='audit')); showToast('ล้างบันทึกกิจกรรมแล้ว');
    return;
  }
  if(action.dataset.deleteCase !== undefined) {
    const index=Number(action.dataset.deleteCase), records=readLocalList('ndss-investigations'), item=records[index];
    if(!item || !await confirmAction('ยืนยันการลบเคส',`ต้องการลบเคส ${item.patient || item.disease} ใช่หรือไม่?`)) return;
    records.splice(index,1); localStorage.setItem('ndss-investigations',JSON.stringify(records)); recordAudit('ลบเคสสอบสวน',item.patient || item.disease || 'ไม่ระบุเคส');
    window.dispatchEvent(new Event('ndss-cases-updated')); renderPins(); renderHistory(); showToast('ลบเคสแล้ว');
    return;
  }
  if(action.dataset.deleteContact !== undefined) {
    const index=Number(action.dataset.deleteContact), contacts=readLocalList('ndss-case-contacts'), item=contacts[index];
    if(!item || !await confirmAction('ยืนยันการลบผู้สัมผัส',`ต้องการลบข้อมูลผู้สัมผัส ${item.contactName} ใช่หรือไม่?`)) return;
    contacts.splice(index,1); localStorage.setItem('ndss-case-contacts',JSON.stringify(contacts));
    recordAudit('ลบข้อมูลผู้สัมผัส',item.contactName); root.innerHTML=`<div class="module-page">${moduleView('tracking')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='tracking')); showToast('ลบข้อมูลผู้สัมผัสแล้ว');
    return;
  }
  if(action.dataset.deleteLab !== undefined) {
    const index=Number(action.dataset.deleteLab), results=readLocalList('ndss-lab-results'), item=results[index];
    if(!item || !await confirmAction('ยืนยันการลบผลตรวจ',`ต้องการลบผลตรวจ ${item.specimenNo} ใช่หรือไม่?`)) return;
    results.splice(index,1); localStorage.setItem('ndss-lab-results',JSON.stringify(results));
    recordAudit('ลบผลตรวจห้องปฏิบัติการ',`เลขสิ่งส่งตรวจ ${item.specimenNo}`); root.innerHTML=`<div class="module-page">${moduleView('lab')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='lab')); showToast('ลบผลตรวจแล้ว');
    return;
  }
  const index=Number(action.dataset.deleteAiReport), reports=readLocalList('ndss-ai-reports');
  if(!reports[index] || !await confirmAction('ยืนยันการลบร่างรายงาน','ต้องการลบร่างรายงานฉบับนี้ใช่หรือไม่?')) return;
  reports.splice(index,1); localStorage.setItem('ndss-ai-reports',JSON.stringify(reports));
  recordAudit('ลบร่างรายงานสถานการณ์','ลบรายงานที่บันทึกไว้'); root.innerHTML=`<div class="module-page">${moduleView('ai-brief')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='ai-brief')); showToast('ลบร่างรายงานแล้ว');
}, true);
const canvasLines = (ctx,text,width) => { const lines=[]; let line=''; for(const char of String(text || '-')) { if(ctx.measureText(line+char).width>width && line) { lines.push(line); line=char; } else line+=char; } if(line) lines.push(line); return lines; };
const downloadCanvasPdf = async (source,disease) => { await document.fonts?.ready; const width=1240,height=1754,margin=72,bodyWidth=width-margin*2; const logo=new Image(); const logoReady=new Promise(resolve=>{logo.onload=logo.onerror=resolve;logo.src='./public/assets/naradhiwas-hospital-logo.svg';}); await logoReady; const pages=[]; let canvas,ctx,y; const header=pageNo=>{ ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height); if(logo.naturalWidth) ctx.drawImage(logo,margin,45,95,95); ctx.fillStyle='#071d38';ctx.font='700 31px "IBM Plex Sans Thai",sans-serif';ctx.fillText('โรงพยาบาลนราธิวาสราชนครินทร์',margin+112,76);ctx.fillStyle='#31567f';ctx.font='600 18px "IBM Plex Sans Thai",sans-serif';ctx.fillText('Naradhiwas Rajanagarindra Hospital',margin+112,104);ctx.strokeStyle='#0b294d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(margin,154);ctx.lineTo(width-margin,154);ctx.stroke();ctx.fillStyle='#071d38';ctx.font='700 28px "IBM Plex Sans Thai",sans-serif';ctx.fillText(source.querySelector('.report-title span')?.textContent || 'แบบสอบสวนโรค',margin,198);ctx.fillStyle='#416582';ctx.font='500 16px "IBM Plex Sans Thai",sans-serif';ctx.fillText(`เอกสารแบบสอบสวนโรค · หน้า ${pageNo}`,margin,226);y=258;}; const nextPage=()=>{canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d');pages.push(canvas);header(pages.length);}; const entry=(label,value)=>{ctx.font='700 18px "IBM Plex Sans Thai",sans-serif';const heading=canvasLines(ctx,label,bodyWidth-36);ctx.font='600 18px "IBM Plex Sans Thai",sans-serif';const answer=canvasLines(ctx,value,bodyWidth-36);const needed=heading.length*24+answer.length*25+32;if(y+needed>height-margin) nextPage();ctx.fillStyle='#fff';ctx.fillRect(margin,y-4,bodyWidth,needed-8);ctx.strokeStyle='#d5e0ea';ctx.lineWidth=1;ctx.strokeRect(margin,y-4,bodyWidth,needed-8);ctx.fillStyle='#123b6d';ctx.font='700 18px "IBM Plex Sans Thai",sans-serif';heading.forEach(line=>{ctx.fillText(line,margin+18,y+18);y+=24;});ctx.fillStyle='#071d38';ctx.font='600 18px "IBM Plex Sans Thai",sans-serif';answer.forEach(line=>{ctx.fillText(line,margin+18,y+18);y+=25;});y+=18;}; nextPage(); source.querySelectorAll('label').forEach(label=>{const field=label.querySelector('input,select,textarea');if(!field)return;const labelCopy=label.cloneNode(true);labelCopy.querySelectorAll('input,select,textarea').forEach(node=>node.remove());const labelText=labelCopy.textContent.trim();let value='-';if(field.type==='checkbox'||field.type==='radio')value=field.checked?'เลือก':'ไม่เลือก';else if(field.tagName==='SELECT')value=field.options[field.selectedIndex]?.text || '-';else value=field.value || '-';entry(labelText,value);}); const encoder=new TextEncoder(),parts=[],offsets=[];let size=0;const rawAdd=chunk=>{parts.push(chunk);size+=chunk.length;};const rawText=text=>rawAdd(encoder.encode(text));const object=(id,content)=>{offsets[id]=size;rawText(`${id} 0 obj\n`);if(typeof content==='string')rawText(content);else content();rawText('\nendobj\n');};const jpegBytes=pages.map(page=>Uint8Array.from(atob(page.toDataURL('image/jpeg',.92).split(',')[1]),char=>char.charCodeAt(0)));const pageIds=pages.map((_,i)=>3+i*3);rawText('%PDF-1.4\n%âãÏÓ\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);pages.forEach((page,i)=>{const pageId=3+i*3,imageId=pageId+1,contentId=pageId+2,image=jpegBytes[i],stream=`q\n595.28 0 0 841.89 0 0 cm\n/Im${i} Do\nQ\n`;object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);object(imageId,()=>{rawText(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);rawAdd(image);rawText('\nendstream');});object(contentId,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);});const start=size;rawText(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(let i=1;i<offsets.length;i++)rawText(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);rawText(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);const blob=new Blob(parts,{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${disease}-แบบสอบสวนโรค.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
const printReport = async () => { const source=root.querySelector('[data-investigation-form]'); if(!source) return; const disease=source.querySelector('[data-disease]')?.value || 'แบบสอบสวนโรค'; const button=source.querySelector('[data-print-report]'); const originalLabel=button?.textContent; if(button) { button.disabled=true; button.textContent='กำลังสร้าง PDF…'; } try { await downloadCleanPdf(source,disease); showToast('สร้างไฟล์ PDF แล้ว'); } catch(error) { console.error(error); showToast('ไม่สามารถสร้าง PDF ได้ในขณะนี้'); } finally { if(button) { button.disabled=false; button.textContent=originalLabel; } } };
const renderModuleSaved = () => root.querySelectorAll('[data-module-saved]').forEach(node => { const records=JSON.parse(localStorage.getItem('ndss-module-records') || '[]').filter(item=>item.module===node.dataset.moduleSaved); const latest=records.at(-1); node.textContent=latest ? `บันทึกล่าสุด ${new Date(latest.createdAt).toLocaleString('th-TH')}` : 'ยังไม่มีรายการที่บันทึก'; });
const exportCsv = () => {
  const records=overviewCases();
  if(!records.length) { showToast('ยังไม่มีข้อมูลสำหรับส่งออก'); return; }
  const rows=[['เลขที่เคส / HN','โรค','ผู้ป่วย','พื้นที่','สถานะ'],...records.map(row=>[
    row.caseNumber || row.caseNo || row.hn || '-',
    cleanDiseaseLabel(row.disease) || '-',
    row.patient || row.patientName || '-',
    row.tambon || row.subdistrict || row.district || row.location || '-',
    row.status || row.outcome || '-'
  ])];
  const safe=value=>{ const text=String(value ?? ''); return ( /^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"','""'); };
  const file=new Blob([`\ufeff${rows.map(row=>row.map(value=>`"${safe(value)}"`).join(',')).join('\n')}`],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(file);
  link.download=`ndss-dashboard-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),500);
  showToast(`ดาวน์โหลดรายงาน ${records.length} รายการแล้ว`);
};
document.addEventListener('click', event => { const nav = event.target.closest('[data-view]'); if (nav) { const view = nav.dataset.view; root.innerHTML = ['dashboard','epidemiology'].includes(view) ? overviewDashboard(view) : `<div class="module-page">${moduleView(view)}</div>`; if (['dashboard','epidemiology'].includes(view)) renderCommandDashboard(); document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('active', x === nav)); renderModuleSaved(); if(view === 'investigation') { mountHistory(); setTimeout(()=>{renderPins();renderHistory();},0); } if(nav.dataset.epiTarget) { const tab=root.querySelector(`[data-epi-tab="${nav.dataset.epiTarget}"]`); if(tab) tab.click(); } } const epiTab=event.target.closest('[data-epi-tab]'); if(epiTab) { const scope=epiTab.closest('.epi-dashboard'); scope.querySelectorAll('[data-epi-tab]').forEach(tab=>tab.classList.toggle('active',tab===epiTab)); scope.querySelectorAll('[data-epi-pane]').forEach(pane=>{ const active=pane.dataset.epiPane===epiTab.dataset.epiTab; pane.hidden=!active; pane.classList.toggle('active',active); }); if(document.querySelector('.nav-link.active')?.dataset.view==='epidemiology') localStorage.setItem('ndss-epi-tab',epiTab.dataset.epiTab); } const progressButton=event.target.closest('[data-response-toggle]'); if(progressButton) { const card=progressButton.closest('article'); const expanded=card.classList.toggle('expanded'); progressButton.setAttribute('aria-expanded',String(expanded)); progressButton.textContent=expanded?'⌃':'⌄'; } if (event.target.closest('[data-export]')) exportCsv(); if (event.target.matches('[data-demo-action]')) showToast('เปิดรายละเอียดรายการแล้ว'); });
let investigationMap;
let activeDiseaseFilter = 'all';
let editingCaseIndex = null;
const escapeHtml = value => String(value || '-').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const historyPanel = `<section class="case-history no-print" data-case-history><div class="panel-top"><div><h2>ทะเบียนเคสย้อนหลัง</h2><small>ค้นหา ดูรายละเอียด และแก้ไขข้อมูลที่บันทึกไว้</small></div></div><div class="history-actions"><input data-history-search placeholder="ค้นหาชื่อ, HN, โรค, พื้นที่" /><select data-history-disease><option value="">ทุกโรค</option>${Object.keys(diseaseMeta).map(name=>`<option value="${name}">${name}</option>`).join('')}</select><input data-history-from type="date" aria-label="ตั้งแต่วันที่" /><input data-history-to type="date" aria-label="ถึงวันที่" /><button class="secondary history-search-button" type="button" data-run-history-search>⌕ ค้นหา</button></div><div class="history-table-wrap"><table><thead><tr><th>วันที่บันทึก</th><th>โรค</th><th>ผู้ป่วย</th><th>HN</th><th>พื้นที่</th><th>จัดการ</th></tr></thead><tbody data-history-rows></tbody></table></div><div class="history-detail" data-history-detail>เลือก “รายละเอียด” เพื่อดูข้อมูลของเคส</div></section>`;
const mountHistory = () => { const modal=root.querySelector('[data-form-modal]'); if(modal && !root.querySelector('[data-case-history]')) modal.insertAdjacentHTML('beforebegin',historyPanel); };
const renderHistory = keyword => { const rows=root.querySelector('[data-history-rows]'); if(!rows) return; const cases=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); const search=(keyword ?? root.querySelector('[data-history-search]')?.value ?? '').toLowerCase(); const disease=root.querySelector('[data-history-disease]')?.value || ''; const from=root.querySelector('[data-history-from]')?.value || ''; const to=root.querySelector('[data-history-to]')?.value || ''; const filtered=cases.map((item,index)=>({...item,index})).filter(item=>{ const day=(item.createdAt || '').slice(0,10); return [item.patient,item.hn,item.disease,item.location].join(' ').toLowerCase().includes(search) && (!disease || item.disease===disease) && (!from || day>=from) && (!to || day<=to); }); rows.innerHTML=filtered.length ? filtered.map(item=>`<tr><td>${item.createdAt?new Date(item.createdAt).toLocaleDateString('th-TH'):'-'}</td><td><span class="disease-dot" style="background:${diseaseMeta[item.disease]?.color || '#176fca'}"></span>${escapeHtml(item.disease)}</td><td>${escapeHtml(item.patient)}</td><td>${escapeHtml(item.hn)}</td><td>${escapeHtml(item.location)}</td><td class="case-actions"><button class="table-action" data-view-case="${item.index}">ดู</button><button class="table-action" data-edit-case="${item.index}">แก้ไข</button><button class="table-action" data-print-case="${item.index}">PDF</button><button class="table-action danger" data-delete-case="${item.index}">ลบ</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-history">ไม่พบข้อมูลที่ค้นหา</td></tr>'; };
const openCaseForm = (item = {}, index = null) => { const modal=root.querySelector('[data-form-modal]'); const dialog=modal.querySelector('.form-modal__dialog'); const oldForm=dialog.querySelector('[data-investigation-form]'); oldForm.outerHTML=investigationForm(item.disease || 'ไข้เลือดออก'); const form=dialog.querySelector('[data-investigation-form]'); Object.entries(item).forEach(([name,value])=>{ const field=form.elements[name]; if(!field) return; if(field.type==='checkbox') field.checked=Boolean(value); else field.value=value ?? ''; }); editingCaseIndex=index; modal.hidden=false; document.body.classList.add('modal-open'); const firstField=form.querySelector('input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled])'); requestAnimationFrame(()=>firstField?.focus()); };
const renderPins = () => { const mapNode = root.querySelector('[data-case-map]'); if (!mapNode) return; const cases = JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); const visibleCases=activeDiseaseFilter === 'all' ? cases : cases.filter(item => item.disease === activeDiseaseFilter); root.querySelector('[data-total-cases]').textContent = cases.length; Object.keys(diseaseMeta).forEach(disease => { root.querySelector(`[data-disease-total="${disease}"]`).textContent = cases.filter(item => item.disease === disease).length; }); root.querySelectorAll('[data-map-filter]').forEach(card=>card.classList.toggle('active',card.dataset.mapFilter===activeDiseaseFilter)); root.querySelector('[data-map-filter-label]').textContent=activeDiseaseFilter==='all'?'Leaflet.js · แสดงทุกโรค':`Leaflet.js · แสดงเฉพาะ ${activeDiseaseFilter}`; if (!window.L) { mapNode.textContent = 'กำลังโหลดแผนที่ Leaflet...'; return; } if (investigationMap) investigationMap.remove(); investigationMap = window.L.map(mapNode,{scrollWheelZoom:false}).setView([6.426,101.825],12); window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(investigationMap); const bounds=[]; visibleCases.forEach(item => { const lat=Number(item.lat); const lng=Number(item.lng); if (!hasMapCoordinates(lat,lng)) return; const color=diseaseMeta[item.disease]?.color || '#176fca'; const marker=window.L.circleMarker([lat,lng],{radius:10,color:'#fff',weight:3,fillColor:color,fillOpacity:1}).addTo(investigationMap); const detail=`<b>${escapeHtml(item.patient)}</b><br>${escapeHtml(item.disease)}<br>${escapeHtml(item.location)}<br><small>เริ่มป่วย ${escapeHtml(item.onset)} · ${lat.toFixed(5)}, ${lng.toFixed(5)}</small>`; marker.bindPopup(detail).on('click',()=>root.querySelector('[data-map-details]').innerHTML=detail); bounds.push([lat,lng]); }); if(bounds.length) investigationMap.fitBounds(bounds,{padding:[36,36],maxZoom:14}); investigationMap.on('click',event=>{ const lat=event.latlng.lat.toFixed(6), lng=event.latlng.lng.toFixed(6); const form=root.querySelector('[data-investigation-form]'); if(form?.elements.lat) form.elements.lat.value=lat; if(form?.elements.lng) form.elements.lng.value=lng; root.querySelector('[data-map-details]').textContent=`เลือกพิกัด ${lat}, ${lng} แล้ว — บันทึกแบบฟอร์มเพื่อปักหมุด`; }); root.querySelector('[data-map-details]').textContent = bounds.length ? `${bounds.length} เคสที่มีพิกัดบนแผนที่ — คลิกหมุดหรือพื้นที่บนแผนที่เพื่อเลือกพิกัด` : visibleCases.length ? 'ข้อมูลเคสมีอยู่ แต่ยังไม่มีพิกัดจริงสำหรับแสดงหมุด — โปรดเลือกตำแหน่งบนแผนที่แล้วบันทึกแบบสอบสวน' : 'ไม่พบเคสตามตัวกรองที่เลือก'; setTimeout(()=>investigationMap.invalidateSize(),100); };
document.addEventListener('submit', event => { if (event.target.matches('[data-module-save]')) { event.preventDefault(); const records=JSON.parse(localStorage.getItem('ndss-module-records') || '[]'); records.push({module:event.target.dataset.moduleName,values:Object.fromEntries(new FormData(event.target)),createdAt:new Date().toISOString()}); localStorage.setItem('ndss-module-records',JSON.stringify(records)); event.target.reset(); renderModuleSaved(); showToast('บันทึกข้อมูลในเครื่องแล้ว'); } if (event.target.matches('[data-investigation-form]')) { event.preventDefault(); const value=Object.fromEntries(new FormData(event.target)); const records=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); const saved={...value,location:value.location || [value.subdistrict,value.district,value.province].filter(Boolean).join(' '),disease:event.target.querySelector('[data-disease]').value,createdAt:editingCaseIndex === null ? new Date().toISOString() : records[editingCaseIndex].createdAt,updatedAt:new Date().toISOString()}; if(editingCaseIndex === null) records.push(saved); else records[editingCaseIndex]=saved; localStorage.setItem('ndss-investigations',JSON.stringify(records)); window.dispatchEvent(new Event('ndss-cases-updated')); editingCaseIndex=null; root.querySelector('[data-form-modal]').hidden=true; document.body.classList.remove('modal-open'); renderPins(); renderHistory(); showToast('บันทึกข้อมูลและอัปเดตแผนที่แล้ว'); } });
document.addEventListener('change', event => { if(event.target.matches('[data-disease]')) { const disease=event.target.value; const meta=diseaseMeta[disease]; const template=root.querySelector('[data-template-download]'); if(template) { template.href=`./public/forms/${encodeURIComponent(meta.template)}`; template.textContent=`เปิด PDF ต้นฉบับ: ${disease}`; } const pages=root.querySelector('[data-template-pages]'); if(pages) pages.innerHTML=Array.from({length:meta.pages},(_,i)=>`<img src="./public/form-pages/${encodeURIComponent(meta.template.replace('.pdf',''))}-${i+1}.png" alt="แบบฟอร์ม ${disease} หน้า ${i+1}" loading="lazy" />`).join(''); event.target.closest('[data-investigation-form]').outerHTML=investigationForm(disease); showToast(`เปลี่ยนเป็นแบบฟอร์ม ${disease} ตามต้นฉบับแล้ว`); } });
document.addEventListener('input', event => { if (event.target.matches('[data-filter]')) { const keyword = event.target.value.toLowerCase(); event.target.closest('.work-panel').querySelectorAll('tbody tr').forEach(row => row.hidden = !row.textContent.toLowerCase().includes(keyword)); } if(event.target.matches('[data-history-search],[data-history-from],[data-history-to]')) renderHistory(); });
document.addEventListener('keydown', event => { if(event.key === 'Enter' && event.target.matches('[data-history-search]')) { event.preventDefault(); renderHistory(); } });
document.addEventListener('change', event => { if(event.target.matches('[data-history-disease]')) renderHistory(); });
document.addEventListener('click', event => { const filter=event.target.closest('[data-map-filter]'); if(filter) { activeDiseaseFilter=filter.dataset.mapFilter; renderPins(); } if(event.target.matches('[data-clear-pins]')) { localStorage.removeItem('ndss-investigations'); activeDiseaseFilter='all'; renderPins(); renderHistory(); } if(event.target.closest('[data-run-history-search]')) renderHistory(); const newCase=event.target.closest('[data-new-case]'); if(newCase) openCaseForm({disease:'ไข้เลือดออก'},null); const viewCase=event.target.closest('[data-view-case]'); if(viewCase) { const item=JSON.parse(localStorage.getItem('ndss-investigations') || '[]')[Number(viewCase.dataset.viewCase)]; const detail=root.querySelector('[data-history-detail]'); if(item && detail) detail.innerHTML=`<div><b>${escapeHtml(item.patient)}</b><span>${escapeHtml(item.disease)}</span></div><dl><dt>HN</dt><dd>${escapeHtml(item.hn)}</dd><dt>วันเริ่มป่วย</dt><dd>${escapeHtml(item.onset)}</dd><dt>พื้นที่</dt><dd>${escapeHtml(item.location)}</dd><dt>พิกัด</dt><dd>${escapeHtml(item.lat)}, ${escapeHtml(item.lng)}</dd><dt>บันทึกล่าสุด</dt><dd>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('th-TH') : '-'}</dd></dl>`; } const editCase=event.target.closest('[data-edit-case]'); if(editCase) { const index=Number(editCase.dataset.editCase); openCaseForm(JSON.parse(localStorage.getItem('ndss-investigations') || '[]')[index],index); } const printCase=event.target.closest('[data-print-case]'); if(printCase) { const index=Number(printCase.dataset.printCase); const item=JSON.parse(localStorage.getItem('ndss-investigations') || '[]')[index]; if(item) { openCaseForm(item,index); setTimeout(printReport,120); } } const deleteCase=event.target.closest('[data-delete-case]'); if(deleteCase) { const index=Number(deleteCase.dataset.deleteCase); const records=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); if(records[index] && window.confirm(`ลบเคส ${records[index].patient || records[index].disease} ใช่หรือไม่?`)) { records.splice(index,1); localStorage.setItem('ndss-investigations',JSON.stringify(records)); renderPins(); renderHistory(); showToast('ลบเคสแล้ว'); } } });
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
const normalizedHeader = value => commandText(value).toLocaleLowerCase('th-TH').replaceAll(/[\s_.\-/()]/g,'');
const fieldRaw = (row, names) => {
  const keys=Object.keys(row);
  let fallback='';
  for (const name of names) {
    const normalizedName=normalizedHeader(name);
    const matches=[...keys.filter(key => normalizedHeader(key)===normalizedName),...keys.filter(key => normalizedHeader(key).includes(normalizedName) && normalizedHeader(key)!==normalizedName)];
    if (!fallback && matches[0]) fallback=matches[0];
    const populated=matches.find(key => commandText(row[key]));
    if (populated) return row[populated];
  }
  return fallback ? row[fallback] : '';
};
const fieldValue = (row, names) => commandText(fieldRaw(row, names));
const patientName = row => {
  const full=fieldValue(row,['ชื่อ-สกุล','ชื่อสกุล','patientname','patient','ผู้ป่วย']);
  if(full) return full;
  return [fieldValue(row,['ชื่อ','firstname']),fieldValue(row,['นามสกุล','lastname','surname'])].filter(Boolean).join(' ');
};
const localIsoDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const normalize506Date = value => {
  if (value instanceof Date && !Number.isNaN(value)) return localIsoDate(value);
  const text=commandText(value);
  if (!text) return '';
  const thaiDate=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s.*)?$/);
  if (thaiDate) {
    const [,day,month,rawYear]=thaiDate;
    let year=Number(rawYear);
    if(year>2400) year-=543;
    if(year<100) year+=2000;
    const date=new Date(year,Number(month)-1,Number(day));
    if(date.getFullYear()===year && date.getMonth()===Number(month)-1 && date.getDate()===Number(day)) return localIsoDate(date);
  }
  const parsed=new Date(text);
  return Number.isNaN(parsed) ? text : localIsoDate(parsed);
};
const isNormalized506Date = value => /^\d{4}-\d{2}-\d{2}$/.test(commandText(value)) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
const hasMapCoordinates = (latitude, longitude) => Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180 && !(Number(latitude) === 0 && Number(longitude) === 0);
const normalize506 = rows => rows.map(row => ({
  disease: cleanDiseaseLabel(fieldValue(row,['diagnosis_icd10_list','diagnosis icd10','icd10','icd-10','disease','diagnosis','diag','ชื่อโรค','โรค'])),
  patient: patientName(row),
  hn: fieldValue(row,['hn','hospitalnumber','เลขhn']),
  cid: fieldValue(row,['cid','pid','เลขบัตรประชาชน','เลข13หลัก']),
  onset: normalize506Date(fieldRaw(row,['วันที่เริ่มมีอาการ','onset','onsetdate','วันที่เริ่มป่วย','dateonset','illdate','วันเริ่มป่วย','วันป่วย'])),
  sex: fieldValue(row,['sex','เพศ']),
  age: fieldValue(row,['age','อายุ']),
  nationality: fieldValue(row,['nationality','สัญชาติ']),
  tambon: fieldValue(row,['ตำบลขณะป่วย','ตำบลที่อยู่','tambon','subdistrict','ตำบล','ตําบล']),
  district: fieldValue(row,['อำเภอขณะป่วย','อำเภอที่อยู่','district','amphoe','อำเภอ','อําเภอ']),
  latitude: fieldValue(row,['latitude','lat','ละติจูด']),
  longitude: fieldValue(row,['longitude','lng','lon','ลองจิจูด']),
  sourceSheet: commandText(row.__ndssSourceSheet),
  raw: row,
  importedAt: new Date().toISOString()
})).filter(row => [row.disease,row.patient,row.hn,row.cid,row.onset,row.sex,row.age,row.tambon,row.district,row.latitude,row.longitude].some(value => commandText(value)));
const recordFingerprint = row => [row.disease,row.onset,row.tambon || row.subdistrict,row.district,row.patient,row.hn,row.cid].map(commandText).join('|').toLowerCase();
const csvRows = text => {
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const cells = line => { const result=[]; let value='', quoted=false; for(let i=0;i<line.length;i++){ const char=line[i]; if(char==='"') { if(quoted && line[i+1]==='"') { value+='"'; i++; } else quoted=!quoted; } else if(char===',' && !quoted) { result.push(value.trim()); value=''; } else value+=char; } result.push(value.trim()); return result; };
  const headers=cells(lines[0]); return lines.slice(1).map(line => Object.fromEntries(headers.map((header,index)=>[header,cells(line)[index] || ''])));
};
const download506Template = () => {
  const headers=['โรค','ชื่อ-สกุล','HN','เลขบัตรประชาชน','วันที่เริ่มป่วย','เพศ','อายุ','สัญชาติ','ตำบล','อำเภอ','ละติจูด','ลองจิจูด'];
  const book=window.XLSX?.utils.book_new();
  const sheet=window.XLSX?.utils.aoa_to_sheet([headers]);
  if(book && sheet) {
    window.XLSX.utils.book_append_sheet(book,sheet,'รง506');
    const blob=new Blob([window.XLSX.write(book,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    link.download='ndss-506-template.xlsx';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),500);
    showToast('ดาวน์โหลดแม่แบบ Excel รง.506 แล้ว');
    return;
  }
  const blob=new Blob([`\ufeff${headers.map(value => `"${value}"`).join(',')}\n`],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='ndss-506-template.csv';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),500);
  showToast('ดาวน์โหลดแม่แบบ CSV รง.506 แล้ว');
};
const has506Headers = rows => {
  const supported=['disease','โรค','diag','diagnosis','icd10','icd-10','diagnosis_icd10_list','patient','name','ชื่อผู้ป่วย','ชื่อ','hn','cid','onset','วันที่เริ่มป่วย','วันที่เริ่มมีอาการ','dateonset','illdate','tambon','ตำบล','district','อำเภอ'];
  return Object.keys(rows[0] || {}).some(header => supported.some(name => normalizedHeader(header).includes(normalizedHeader(name))));
};
const import506File = async file => {
  if (!file) return;
  try {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv');
    let rows=[];
    if (/\.csv$/i.test(file.name)) rows=csvRows(await file.text());
    else if (window.XLSX) {
      const data=await file.arrayBuffer();
      const book=window.XLSX.read(data,{type:'array',cellDates:true});
      rows=book.SheetNames.flatMap(sheetName => window.XLSX.utils.sheet_to_json(book.Sheets[sheetName],{defval:''})
        .map(row => ({...row,__ndssSourceSheet:sheetName})));
    }
    else throw new Error('ไม่พบตัวอ่านไฟล์ Excel');
    if (!rows.length) throw new Error('ไม่พบแถวข้อมูลในไฟล์');
    if (!has506Headers(rows)) throw new Error('ไม่พบหัวคอลัมน์ รง.506 ที่ระบบรองรับ');
    const normalized=normalize506(rows);
    if(!normalized.length) throw new Error('ไม่พบแถวข้อมูลที่นำเข้าได้');
    const existing=commandRecords();
    const seen=new Set(existing.map(recordFingerprint));
    const unique=normalized.filter(row => { const fingerprint=recordFingerprint(row); if(seen.has(fingerprint)) return false; seen.add(fingerprint); return true; });
    const quality={
      missingDisease:normalized.filter(row => !row.disease).length,
      missingOnset:normalized.filter(row => !row.onset).length,
      invalidOnset:normalized.filter(row => row.onset && !isNormalized506Date(row.onset)).length,
      missingTambon:normalized.filter(row => !row.tambon).length,
      missingDistrict:normalized.filter(row => !row.district).length,
      invalidAge:normalized.filter(row => row.age && (!Number.isFinite(Number(row.age)) || Number(row.age)<0 || Number(row.age)>130)).length,
      withCoordinates:normalized.filter(row => hasMapCoordinates(row.latitude,row.longitude)).length
    };
    const incomplete=normalized.filter(row => !row.disease || !isNormalized506Date(row.onset) || !(row.tambon || row.district)).length;
    const combined=[...existing,...unique];
    localStorage.setItem('ndss-506-records',JSON.stringify(combined));
    const sourceSheets=[...new Set(rows.map(row => commandText(row.__ndssSourceSheet)).filter(Boolean))];
    const meta={fileName:file.name,imported:unique.length,duplicates:normalized.length-unique.length,incomplete,quality,sheetCount:sourceSheets.length,sourceSheets,mappingVersion:4,at:new Date().toLocaleString('th-TH')};
    localStorage.setItem('ndss-506-import-meta',JSON.stringify(meta));
    recordAudit('นำเข้าข้อมูล รง.506',`ไฟล์ ${file.name} · ${sourceSheets.length || 1} ชีต · เพิ่ม ${unique.length} ราย · ซ้ำ ${meta.duplicates} ราย`);
    root.querySelector('[data-import-status]')?.replaceChildren(document.createTextNode(`อ่าน ${sourceSheets.length || 1} ชีต · นำเข้าข้อมูลใหม่ ${unique.length} ราย · รวมข้อมูล รง.506 ${combined.length} ราย`));
    window.dispatchEvent(new Event('ndss-cases-updated'));
    showToast(`นำเข้าข้อมูล รง.506 ใหม่ ${unique.length} รายแล้ว`);
  } catch(error) { console.error(error); showToast(`นำเข้าข้อมูลไม่สำเร็จ: ${error.message}`); }
};
const open506Import = () => {
  root.innerHTML=`<div class="module-page">${moduleView('import506')}</div>`;
  document.querySelectorAll('.nav-link').forEach(link=>link.classList.remove('active'));
  const mobileMenu=document.getElementById('mobile-sidebar-state');
  if(mobileMenu) mobileMenu.checked=false;
  window.scrollTo({top:0,behavior:'smooth'});
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
  const points=[...commandRecords().filter(row => scope==='all' || row.disease===scope),...commandCases().filter(row => scope==='all' || row.disease===scope)].map((row,index)=>({row,lat:Number(row.latitude || row.lat),lng:Number(row.longitude || row.lng),index})).filter(point=>hasMapCoordinates(point.lat,point.lng));
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
    root.innerHTML=overviewDashboard('epidemiology');
    renderCommandDashboard();
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='epidemiology'));
  }
  if(event.target.matches('[data-epi-disease-filter]')) {
    localStorage.setItem('ndss-epi-disease',event.target.value);
    refreshEpidemiology();
  }
  if(event.target.matches('[data-dashboard-disease-page-size]')) {
    const pageSize=Number(event.target.value);
    localStorage.setItem('ndss-dashboard-disease-page-size',String([25,50,100].includes(pageSize) ? pageSize : 25));
    localStorage.setItem('ndss-dashboard-disease-page','1');
    refreshOverview();
  }
  if(event.target.matches('[data-506-report-page-size]')) {
    const pageSize=Number(event.target.value);
    localStorage.setItem('ndss-506-report-page-size', String([25,50,100].includes(pageSize) ? pageSize : 25));
    localStorage.setItem('ndss-506-report-page','1');
    root.innerHTML=`<div class="module-page">${moduleView('report506')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='report506'));
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
  const diseasePageButton=event.target.closest('[data-dashboard-disease-page]');
  if(diseasePageButton && !diseasePageButton.disabled) {
    localStorage.setItem('ndss-dashboard-disease-page',String(Math.max(1,Number(diseasePageButton.dataset.dashboardDiseasePage) || 1)));
    refreshOverview();
    return;
  }
  if(commandView==='area-map') setTimeout(renderCommandMap,0);
  if(event.target.closest('[data-open-506-import]')) open506Import();
  if(event.target.closest('[data-download-506-template]')) download506Template();
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

