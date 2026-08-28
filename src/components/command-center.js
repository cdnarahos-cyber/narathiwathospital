const empty = (title, detail) => `<section class="command-empty"><strong>${title}</strong><p>${detail}</p></section>`;

const title = (heading, subtitle, actions = '') => `<div class="command-head"><div><p class="eyebrow">ศูนย์บัญชาการข้อมูลโรคระดับอำเภอ</p><h1>${heading}</h1><p>${subtitle}</p></div>${actions}</div>`;

const read506 = () => {
  try { return JSON.parse(localStorage.getItem('ndss-506-records') || '[]'); }
  catch { return []; }
};
const readImportMeta = () => {
  try { return JSON.parse(localStorage.getItem('ndss-506-import-meta') || 'null'); }
  catch { return null; }
};

const readCases = () => {
  try { return JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); }
  catch { return []; }
};
const readTasks = () => {
  try { return JSON.parse(localStorage.getItem('ndss-response-tasks') || '[]'); }
  catch { return []; }
};

const values = () => {
  const rows = read506();
  const cases = readCases();
  const byDisease = rows.reduce((all, row) => {
    const key = row.disease || 'ไม่ระบุโรค'; all[key] = (all[key] || 0) + 1; return all;
  }, {});
  const byTambon = rows.reduce((all, row) => {
    const key = row.tambon || row.district || 'ไม่ระบุพื้นที่'; all[key] = (all[key] || 0) + 1; return all;
  }, {});
  return { rows, cases, byDisease, byTambon };
};

const clusterSignals = () => {
  const records=[...read506(),...readCases()];
  const week = value => { const date=new Date(value); if(Number.isNaN(date)) return ''; const first=new Date(date.getFullYear(),0,1); return `${date.getFullYear()}-W${String(Math.ceil((((date-first)/86400000)+first.getDay()+1)/7)).padStart(2,'0')}`; };
  const grouped=records.reduce((all,row) => { const period=week(row.onset || row.createdAt); const area=row.tambon || row.subdistrict || row.district || 'ไม่ระบุพื้นที่'; const disease=row.disease || 'ไม่ระบุโรค'; if(!period || disease==='ไม่ระบุโรค') return all; const key=[disease,area,period].join('|'); all[key]=all[key] || {disease,area,period,count:0,records:[]}; all[key].count++; all[key].records.push(row); return all; },{});
  return Object.values(grouped).filter(item=>item.count>=3).sort((a,b)=>b.count-a.count);
};

const statCards = items => `<section class="command-stats">${items.map(([label, value, note, tone = 'blue']) => `<article class="${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('')}</section>`;

const ranked = (source, label) => {
  const entries = Object.entries(source).sort((a,b) => b[1] - a[1]).slice(0, 10);
  if (!entries.length) return empty('ยังไม่มีข้อมูล', `ยังไม่มีข้อมูล ${label} จากการนำเข้า รง.506`);
  const max = entries[0][1] || 1;
  return `<div class="ranked-list">${entries.map(([name,count], index) => `<div><b>${index + 1}</b><span>${name}</span><i><em style="width:${Math.max(8, count / max * 100)}%"></em></i><strong>${count} ราย</strong></div>`).join('')}</div>`;
};

const overview = () => {
  const { rows, cases, byDisease, byTambon } = values();
  return `${title('ภาพรวมสถานการณ์โรค', 'ข้อมูลจากระบบ รง.506 และแบบสอบสวนโรคออนไลน์ · ข้อมูลจะอัปเดตเมื่อมีการนำเข้าหรือบันทึกเคสใหม่', '<div class="command-actions"><button class="secondary" data-open-506-import>＋ นำเข้า รง.506</button><button class="primary" data-view="reports">✦ สรุปรายเดือน</button></div>')}${statCards([['ผู้ป่วยจาก รง.506', `${rows.length} ราย`, 'ข้อมูลสะสมที่นำเข้า', 'blue'], ['คิวสอบสวน', `${cases.length} ราย`, 'จากแบบสอบสวนโรคออนไลน์', 'orange'], ['พื้นที่มีรายงาน', `${Object.keys(byTambon).length} พื้นที่`, 'ตามขอบเขตข้อมูลที่นำเข้า', 'green'], ['โรคที่รายงาน', `${Object.keys(byDisease).length} โรค`, 'ไม่เปรียบเทียบข้ามขอบเขต', 'purple']])}<section class="command-grid"><article class="work-panel"><div class="panel-top"><h2>10 อันดับโรคที่มีรายงาน</h2><small>หน่วย: ราย</small></div>${ranked(byDisease,'โรค')}</article><article class="work-panel"><div class="panel-top"><h2>พื้นที่ที่มีรายงาน</h2><small>ตามตำบล/อำเภอที่มีในไฟล์</small></div>${ranked(byTambon,'พื้นที่')}</article></section>`;
};

const importer = () => { const meta=readImportMeta(); return `${title('นำเข้าข้อมูล รง.506', 'อัปโหลดไฟล์ Excel หรือ CSV เพื่อนำมาใช้ใน Dashboard, แผนที่ และคิวสอบสวน')}<section class="work-panel import-panel"><div class="import-drop"><span>⇧</span><h2>เลือกไฟล์รายงาน รง.506</h2><p>รองรับไฟล์ .xlsx, .xls และ .csv · ระบบอ่านแถวแรกเป็นชื่อคอลัมน์</p><input id="import-506-file" type="file" data-import-506 accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" /><label class="primary" for="import-506-file">เลือกไฟล์</label></div><div class="import-guide"><h2>คอลัมน์ที่ระบบพยายามตรวจจับ</h2><p>โรค / Disease, วันที่เริ่มป่วย / Onset date, เพศ / Sex, อายุ / Age, ตำบล / Tambon, อำเภอ / District และพิกัด Lat/Lng</p><p class="subtle">ระบบกันข้อมูลซ้ำจาก โรค + วันเริ่มป่วย + พื้นที่ + ชื่อผู้ป่วย (ถ้ามี) และแจ้งแถวที่ควรตรวจสอบก่อนใช้วิเคราะห์</p></div></section><section class="work-panel"><div class="panel-top"><h2>สถานะการนำเข้าล่าสุด</h2><button class="secondary" data-clear-506>ล้างข้อมูลนำเข้า</button></div><div data-import-status>${read506().length ? `มีข้อมูล รง.506 ${read506().length} รายในเครื่องนี้` : 'ยังไม่มีข้อมูลนำเข้า'}</div>${meta ? `<div class="import-quality"><span><b>${meta.imported}</b> รายการใหม่</span><span><b>${meta.duplicates}</b> รายการซ้ำ</span><span><b>${meta.incomplete}</b> รายการควรตรวจสอบ</span><small>${meta.fileName} · ${meta.at}</small></div>` : '<p class="subtle">ยังไม่มีประวัติการตรวจสอบไฟล์</p>'}</section>`; };

const areaMap = () => {
  const { rows, byTambon } = values();
  return `${title('แผนที่และข้อมูลรายพื้นที่', 'แสดงจุดรายงานจากข้อมูลที่มีพิกัด และสรุปพื้นที่ตามตำบล/อำเภอ')}<section class="command-map-layout"><article class="work-panel command-map-panel"><div class="panel-top"><div><h2>แผนที่สถานการณ์โรค</h2><small>Leaflet.js · ขอบเขตการแสดงผลขึ้นกับข้อมูลที่นำเข้า</small></div><select data-command-map-scope><option value="all">ทุกโรค</option>${Object.keys(values().byDisease).map(d => `<option>${d}</option>`).join('')}</select></div><div class="command-map" data-command-map></div></article><aside class="work-panel"><h2>สรุปพื้นที่</h2>${ranked(byTambon,'พื้นที่')}<p class="scope-note">ข้อจำกัด: หากไฟล์ไม่มีข้อมูลตำบล ระบบจะแสดงผลเฉพาะระดับอำเภอ และไม่จัดอันดับเทียบข้ามระดับพื้นที่</p></aside></section>${rows.length ? '' : '<p class="scope-note">ยังไม่มีข้อมูลพิกัดจาก รง.506 — สามารถดูหมุดจากแบบสอบสวนโรคออนไลน์ได้ในโมดูลเดิม</p>'}`;
};

const queue = () => {
  const { cases } = values();
  return `${title('กลุ่มโรคที่ต้องสอบสวน', 'คิวติดตามงานสอบสวนสำหรับทีม SRRT จากรายการที่บันทึกในระบบ', '<button class="primary" data-view="investigation">＋ เปิดแบบสอบสวนโรค</button>')}${statCards([['รายการในคิว', `${cases.length} ราย`, 'ข้อมูลจากแบบสอบสวน', 'orange'], ['บันทึกแล้ว', `${cases.length} ราย`, 'มีรายละเอียดในระบบ', 'green'], ['รอคัดกรอง', 'ยังไม่มีข้อมูล', 'ต้องนำเข้า/บันทึกข้อมูลเพิ่ม', 'blue'], ['ความเร่งด่วน', 'กำหนดโดยทีม', 'ระบบไม่ประเมินแทนผู้ปฏิบัติงาน', 'purple']])}<section class="work-panel"><div class="panel-top"><h2>ตารางงานสอบสวนรายบุคคล</h2><input class="table-search" data-command-queue-search placeholder="ค้นหาชื่อ, HN, โรค, พื้นที่" /></div>${cases.length ? `<div class="history-table-wrap"><table><thead><tr><th>วันที่บันทึก</th><th>โรค</th><th>ผู้ป่วย</th><th>พื้นที่</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody data-command-queue-rows>${cases.map((item,index) => `<tr><td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString('th-TH') : '-'}</td><td>${item.disease || '-'}</td><td>${item.patient || '-'}</td><td>${item.location || item.subdistrict || '-'}</td><td><mark class="blue">บันทึกแล้ว</mark></td><td><button class="table-action" data-edit-case="${index}">เปิดแบบสอบสวน</button></td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีคิวสอบสวน', 'เริ่มต้นด้วยการเปิดแบบสอบสวนโรคออนไลน์และบันทึกเคส')}</section>`;
};

const clusters = () => {
  const signals=clusterSignals();
  return `${title('ตรวจจับกลุ่มก้อนโรค', 'คัดกรองรายการที่มีรายงานโรคเดียวกันในพื้นที่เดียวกันภายในสัปดาห์เดียวกัน เพื่อให้ทีม SRRT ตรวจสอบ')}<section class="cluster-rule"><b>เกณฑ์คัดกรองปัจจุบัน</b><span>ตั้งแต่ 3 ราย · โรคเดียวกัน · พื้นที่เดียวกัน · สัปดาห์เริ่มป่วยเดียวกัน</span><small>เป็นสัญญาณคัดกรองเชิงพรรณนา ไม่ใช่การยืนยันการระบาดหรือสรุปสาเหตุ</small></section>${statCards([['สัญญาณที่พบ', `${signals.length} กลุ่ม`, 'ตามเกณฑ์คัดกรอง', 'orange'], ['เคสในสัญญาณ', `${signals.reduce((sum,item)=>sum+item.count,0)} ราย`, 'รวมทุกกลุ่มที่เข้าเงื่อนไข', 'blue'], ['เกณฑ์ที่ใช้', '3 ราย', 'ปรับใช้โดยผู้ดูแลได้ในอนาคต', 'purple'], ['สถานะ', signals.length?'รอตรวจสอบ':'ยังไม่มีข้อมูล', 'ต้องตรวจทานโดย SRRT', 'green']])}<section class="work-panel"><div class="panel-top"><h2>รายการที่ต้องตรวจสอบ</h2><button class="primary" data-view="investigation">เปิดแบบสอบสวนโรค</button></div>${signals.length ? `<div class="cluster-list">${signals.map((item,index)=>`<article><span class="cluster-index">${index+1}</span><div><h3>${item.disease}</h3><p>${item.area} · ${item.period}</p><small>รายงาน ${item.count} รายในช่วงข้อมูลเดียวกัน</small></div><strong>${item.count}<small>ราย</small></strong></article>`).join('')}</div>` : empty('ยังไม่พบกลุ่มที่เข้าเกณฑ์คัดกรอง', 'ระบบต้องมีข้อมูลโรค พื้นที่ และวันเริ่มป่วยอย่างน้อย 3 รายในสัปดาห์เดียวกัน')}</section>`;
};

const tracking = () => {
  const cases=readCases(), tasks=readTasks();
  const done=tasks.filter(task=>task.status==='ควบคุมแล้ว').length;
  const active=tasks.filter(task=>task.status==='กำลังดำเนินการ').length;
  return `${title('ติดตามและควบคุมโรค', 'มอบหมายผู้รับผิดชอบ ติดตามกำหนดเสร็จ และบันทึกผลการดำเนินงานของแต่ละเคส')}<section class="work-panel"><div class="panel-top"><h2>มอบหมายงานสอบสวน / ควบคุมโรค</h2><small>งานจะถูกบันทึกในเบราว์เซอร์นี้</small></div>${cases.length ? `<form class="form-grid" data-response-task><label>เคสที่รับผิดชอบ<select name="caseIndex" required>${cases.map((item,index)=>`<option value="${index}">${item.disease || 'ไม่ระบุโรค'} · ${item.patient || item.hn || `เคส ${index+1}`} · ${item.location || item.subdistrict || '-'}</option>`).join('')}</select></label><label>ผู้รับผิดชอบ<input name="owner" required placeholder="ชื่อเจ้าหน้าที่ / ทีม SRRT" /></label><label>กำหนดเสร็จ<input name="dueDate" type="date" required /></label><label>ระดับความเร่งด่วน<select name="priority"><option>ปกติ</option><option>เฝ้าระวัง</option><option>เร่งด่วน</option></select></label><label>รายละเอียดงาน<input name="note" placeholder="เช่น ตรวจสอบผู้สัมผัสและพื้นที่เสี่ยง" /></label><label>สถานะเริ่มต้น<select name="status"><option>รอรับทราบ</option><option>กำลังดำเนินการ</option></select></label><div class="form-actions"><button class="primary">บันทึกมอบหมายงาน</button></div></form>` : empty('ยังไม่มีเคสสำหรับมอบหมาย', 'เริ่มจากบันทึกข้อมูลในแบบสอบสวนโรคออนไลน์')}</section>${statCards([['งานทั้งหมด', `${tasks.length} งาน`, 'รายการที่มอบหมายแล้ว', 'blue'], ['กำลังดำเนินการ', `${active} งาน`, 'ต้องติดตามโดยผู้รับผิดชอบ', 'orange'], ['ควบคุมแล้ว', `${done} งาน`, 'บันทึกผลเสร็จสิ้นแล้ว', 'green'], ['ยังไม่มอบหมาย', `${Math.max(0,cases.length-tasks.length)} เคส`, 'เปรียบเทียบกับเคสที่บันทึก', 'purple']])}<section class="work-panel"><div class="panel-top"><h2>ตารางติดตามงาน</h2><small>การเปลี่ยนสถานะจะบันทึกทันที</small></div>${tasks.length ? `<div class="history-table-wrap"><table><thead><tr><th>เคส</th><th>ผู้รับผิดชอบ</th><th>กำหนดเสร็จ</th><th>ความเร่งด่วน</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${tasks.map((task,index)=>{ const item=cases[Number(task.caseIndex)] || {}; return `<tr><td><b>${item.disease || 'ไม่ระบุโรค'}</b><br/><small>${item.patient || item.hn || '-'}</small></td><td>${task.owner}</td><td>${task.dueDate ? new Date(task.dueDate).toLocaleDateString('th-TH') : '-'}</td><td><mark class="${task.priority==='เร่งด่วน'?'red':task.priority==='เฝ้าระวัง'?'gold':'blue'}">${task.priority}</mark></td><td><mark class="${task.status==='ควบคุมแล้ว'?'green':'blue'}">${task.status}</mark></td><td>${task.status==='ควบคุมแล้ว' ? '<span class="task-done">✓ เสร็จสิ้น</span>' : `<button class="table-action" data-complete-response="${index}">บันทึกควบคุมแล้ว</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : empty('ยังไม่มีงานที่มอบหมาย', 'กรอกแบบฟอร์มด้านบนเพื่อเริ่มติดตามงาน')}</section>`;
};

const reports = () => {
  const { rows, cases, byDisease } = values();
  return `${title('สรุปผลการสอบสวนและรายงาน', 'สร้างตารางสรุปตามข้อมูลที่บันทึกไว้ โดยไม่ใช้ข้อมูลจำลอง', '<div class="command-actions"><button class="secondary" data-export-506-csv>⇩ CSV</button><button class="primary" data-print-command-report>▣ พิมพ์รายงาน</button></div>')}${statCards([['ข้อมูล รง.506', `${rows.length} ราย`, 'รายการจากการนำเข้า', 'blue'], ['แบบสอบสวน', `${cases.length} ราย`, 'รายการที่บันทึก', 'green'], ['โรคที่สรุปได้', `${Object.keys(byDisease).length} โรค`, 'จากคอลัมน์โรค', 'purple']])}<section class="work-panel printable-command-report"><div class="panel-top"><h2>สรุปตามโรค</h2><small>หน่วย: ราย</small></div>${Object.keys(byDisease).length ? `<table><thead><tr><th>โรค</th><th>จำนวนผู้ป่วย</th><th>แบบสอบสวนที่บันทึก</th></tr></thead><tbody>${Object.entries(byDisease).sort((a,b)=>b[1]-a[1]).map(([d,count]) => `<tr><td>${d}</td><td>${count} ราย</td><td>${cases.filter(x=>x.disease===d).length} ราย</td></tr>`).join('')}</tbody></table>` : empty('ยังไม่มีข้อมูลรายงาน', 'นำเข้าข้อมูล รง.506 ก่อนสร้างรายงานสรุป')}</section>`;
};

const aiBrief = () => `${title('AI ช่วยสรุปสถานการณ์', 'สร้างร่างข้อความเชิงพรรณนาจากข้อมูลในระบบ เพื่อให้เจ้าหน้าที่ตรวจทานก่อนเผยแพร่')}<section class="work-panel ai-panel"><div class="form-grid"><label>ช่วงข้อมูล<select data-ai-period><option>ข้อมูลทั้งหมดที่นำเข้า</option><option>เดือนปัจจุบัน</option></select></label><label>รูปแบบข้อความ<select data-ai-tone><option>รายงานสถานการณ์</option><option>สรุปสำหรับทีม SRRT</option></select></label><label>ขอบเขตพื้นที่<select data-ai-area><option>ทุกพื้นที่</option><option>เฉพาะข้อมูลที่มีตำบล</option></select></label></div><div class="form-actions"><button class="primary" data-generate-ai-brief>✦ สร้างร่างบทวิเคราะห์</button></div><article class="ai-output" data-ai-output><h2>ร่างบทวิเคราะห์</h2><p>เลือกเงื่อนไขแล้วกด “สร้างร่างบทวิเคราะห์” ระบบจะแสดงข้อความเชิงพรรณนาจากข้อมูลที่มี โดยไม่สรุปสาเหตุเกินข้อมูล</p></article></section><section class="work-panel"><h2>หลักการใช้งาน</h2><ul class="command-list"><li>ผลลัพธ์เป็นร่างสำหรับตรวจทาน ไม่ใช่ข้อสรุปทางระบาดวิทยาอัตโนมัติ</li><li>หากไม่มีข้อมูล ระบบจะแสดง “ยังไม่มีข้อมูล” โดยไม่สร้างข้อมูลตัวอย่าง</li><li>การเชื่อมต่อ AI ภายนอกต้องกำหนดคีย์และนโยบายข้อมูลในส่วนผู้ดูแลก่อนใช้งานจริง</li></ul></section>`;

const lineNotify = () => `${title('ส่งข้อมูลแจ้งเตือนผ่าน LINE OA', 'เตรียมข้อความสรุปสำหรับส่งผ่าน LINE Official Account ตามสิทธิ์และการตั้งค่าของหน่วยงาน')}<section class="work-panel"><div class="form-grid"><label>กลุ่มเป้าหมาย<select><option>ทีม SRRT</option><option>ผู้บริหาร</option><option>ผู้รับผิดชอบรายพื้นที่</option></select></label><label>ขอบเขตข้อมูล<select><option>สรุปทุกพื้นที่</option><option>เฉพาะพื้นที่ที่มีรายงาน</option></select></label><label>ระดับการแจ้งเตือน<select><option>ติดตามสถานการณ์</option><option>เฝ้าระวัง</option><option>เร่งด่วน</option></select></label></div><div class="form-actions"><button class="secondary" data-preview-line>ดูตัวอย่าง</button><button class="primary" data-send-line>ส่งผ่าน LINE OA</button></div><div class="line-preview" data-line-preview>ยังไม่ได้สร้างข้อความแจ้งเตือน</div></section>`;

const security = () => `${title('สิทธิ์การเข้าถึงและข้อมูลส่วนบุคคล', 'กำหนดการเข้าถึงตามบทบาทผู้ใช้งานและพื้นที่รับผิดชอบ')}<section class="work-panel"><table><thead><tr><th>ข้อมูล/ความสามารถ</th><th>ผู้ใช้งานทั่วไป</th><th>ผู้รับผิดชอบพื้นที่</th><th>ผู้ดูแลระบบ</th></tr></thead><tbody><tr><td>ตัวเลขสรุปและแผนที่</td><td>✓</td><td>✓</td><td>✓</td></tr><tr><td>ดูข้อมูลผู้ป่วยรายบุคคล</td><td>—</td><td>ตามพื้นที่รับผิดชอบ</td><td>✓</td></tr><tr><td>แก้ไขแบบสอบสวน</td><td>—</td><td>ตามสิทธิ์ที่กำหนด</td><td>✓</td></tr><tr><td>นำเข้า / แก้ไข / ลบข้อมูล</td><td>—</td><td>—</td><td>✓</td></tr></tbody></table><p class="scope-note">หน้าจอนี้เป็นต้นแบบการกำหนดสิทธิ์ ฝั่งระบบจริงต้องบังคับใช้ผ่านการยืนยันตัวตนและ RLS ในฐานข้อมูล ไม่ควรพึ่งพาเพียงการซ่อนเมนู</p></section>`;

export function commandCenterView(id) {
  if (id === 'overview') return overview();
  if (id === 'import506') return importer();
  if (id === 'area-map') return areaMap();
  if (id === 'queue') return queue();
  if (id === 'clusters') return clusters();
  if (id === 'tracking') return tracking();
  if (id === 'reports') return reports();
  if (id === 'ai-brief') return aiBrief();
  if (id === 'line-notify') return lineNotify();
  if (id === 'security') return security();
  return '';
}
