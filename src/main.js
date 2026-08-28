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
  return `<div class="module-page overview-page"><section class="module-head"><div><h1>ภาพรวมระบบ</h1><p>ข้อมูล ณ วันที่: ${asOfText}</p></div></section><section class="epi-dashboard"><div class="epi-tabs" role="tablist">${tabs.map(([id,label],index)=>`<button type="button" class="${index===0?'active':''}" data-epi-tab="${id}" role="tab">${label}</button>`).join('')}</div><div class="epi-pane active" data-epi-pane="situation"><p class="epi-standard">ข้อมูลจากการเฝ้าระวังโรค จากระบบเฝ้าระวังโรคดิจิทัล (Digital Disease Surveillance; DDS)</p><div class="module-cards"><article class="blue"><span>จำนวนผู้ป่วยสะสม</span><strong>${cases.length} ราย</strong><small>หน่วย: ราย</small></article><article><span>อัตราป่วย</span><strong>ยังไม่มีข้อมูล</strong><small>ต่อประชากรแสนคน · ต้องมีฐานประชากร</small></article><article class="red"><span>ผู้เสียชีวิต / อัตราตาย</span><strong>${deaths} ราย</strong><small>ต่อประชากรแสนคน: ยังไม่มีข้อมูล</small></article><article class="orange"><span>อัตราป่วยตาย (CFR)</span><strong>${cfr}</strong><small>หน่วย: ร้อยละ</small></article></div>${disease}</div><div class="epi-pane" data-epi-pane="trend" hidden>${trend}</div><div class="epi-pane" data-epi-pane="curve" hidden>${curve}</div><div class="epi-pane" data-epi-pane="person" hidden>${person}</div><div class="epi-pane" data-epi-pane="place" hidden>${place}</div><div class="epi-pane" data-epi-pane="time" hidden>${time}</div></section></div>`;
};
document.querySelector('#app').innerHTML = shell(overviewDashboard());
const root = document.querySelector('#module-root');
enableHistoryAreaFilter(root);
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
const refreshOverview = () => { if (root.querySelector('.overview-page')) { root.innerHTML = overviewDashboard(); renderCommandDashboard(); } };
window.addEventListener('ndss-cases-updated', refreshOverview);
window.addEventListener('storage', event => { if (event.key === 'ndss-investigations') refreshOverview(); });
const showToast = message => { const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; document.body.append(toast); setTimeout(() => toast.remove(), 2600); };
const canvasLines = (ctx,text,width) => { const lines=[]; let line=''; for(const char of String(text || '-')) { if(ctx.measureText(line+char).width>width && line) { lines.push(line); line=char; } else line+=char; } if(line) lines.push(line); return lines; };
const downloadCanvasPdf = async (source,disease) => { await document.fonts?.ready; const width=1240,height=1754,margin=72,bodyWidth=width-margin*2; const logo=new Image(); const logoReady=new Promise(resolve=>{logo.onload=logo.onerror=resolve;logo.src='./public/assets/naradhiwas-hospital-logo.svg';}); await logoReady; const pages=[]; let canvas,ctx,y; const header=pageNo=>{ ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height); if(logo.naturalWidth) ctx.drawImage(logo,margin,45,95,95); ctx.fillStyle='#071d38';ctx.font='700 31px "IBM Plex Sans Thai",sans-serif';ctx.fillText('โรงพยาบาลนราธิวาสราชนครินทร์',margin+112,76);ctx.fillStyle='#31567f';ctx.font='600 18px "IBM Plex Sans Thai",sans-serif';ctx.fillText('Naradhiwas Rajanagarindra Hospital',margin+112,104);ctx.strokeStyle='#0b294d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(margin,154);ctx.lineTo(width-margin,154);ctx.stroke();ctx.fillStyle='#071d38';ctx.font='700 28px "IBM Plex Sans Thai",sans-serif';ctx.fillText(source.querySelector('.report-title span')?.textContent || 'แบบสอบสวนโรค',margin,198);ctx.fillStyle='#416582';ctx.font='500 16px "IBM Plex Sans Thai",sans-serif';ctx.fillText(`เอกสารแบบสอบสวนโรค · หน้า ${pageNo}`,margin,226);y=258;}; const nextPage=()=>{canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d');pages.push(canvas);header(pages.length);}; const entry=(label,value)=>{ctx.font='700 18px "IBM Plex Sans Thai",sans-serif';const heading=canvasLines(ctx,label,bodyWidth-36);ctx.font='600 18px "IBM Plex Sans Thai",sans-serif';const answer=canvasLines(ctx,value,bodyWidth-36);const needed=heading.length*24+answer.length*25+32;if(y+needed>height-margin) nextPage();ctx.fillStyle='#fff';ctx.fillRect(margin,y-4,bodyWidth,needed-8);ctx.strokeStyle='#d5e0ea';ctx.lineWidth=1;ctx.strokeRect(margin,y-4,bodyWidth,needed-8);ctx.fillStyle='#123b6d';ctx.font='700 18px "IBM Plex Sans Thai",sans-serif';heading.forEach(line=>{ctx.fillText(line,margin+18,y+18);y+=24;});ctx.fillStyle='#071d38';ctx.font='600 18px "IBM Plex Sans Thai",sans-serif';answer.forEach(line=>{ctx.fillText(line,margin+18,y+18);y+=25;});y+=18;}; nextPage(); source.querySelectorAll('label').forEach(label=>{const field=label.querySelector('input,select,textarea');if(!field)return;const labelCopy=label.cloneNode(true);labelCopy.querySelectorAll('input,select,textarea').forEach(node=>node.remove());const labelText=labelCopy.textContent.trim();let value='-';if(field.type==='checkbox'||field.type==='radio')value=field.checked?'เลือก':'ไม่เลือก';else if(field.tagName==='SELECT')value=field.options[field.selectedIndex]?.text || '-';else value=field.value || '-';entry(labelText,value);}); const encoder=new TextEncoder(),parts=[],offsets=[];let size=0;const rawAdd=chunk=>{parts.push(chunk);size+=chunk.length;};const rawText=text=>rawAdd(encoder.encode(text));const object=(id,content)=>{offsets[id]=size;rawText(`${id} 0 obj\n`);if(typeof content==='string')rawText(content);else content();rawText('\nendobj\n');};const jpegBytes=pages.map(page=>Uint8Array.from(atob(page.toDataURL('image/jpeg',.92).split(',')[1]),char=>char.charCodeAt(0)));const pageIds=pages.map((_,i)=>3+i*3);rawText('%PDF-1.4\n%âãÏÓ\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);pages.forEach((page,i)=>{const pageId=3+i*3,imageId=pageId+1,contentId=pageId+2,image=jpegBytes[i],stream=`q\n595.28 0 0 841.89 0 0 cm\n/Im${i} Do\nQ\n`;object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);object(imageId,()=>{rawText(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);rawAdd(image);rawText('\nendstream');});object(contentId,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);});const start=size;rawText(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(let i=1;i<offsets.length;i++)rawText(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);rawText(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);const blob=new Blob(parts,{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${disease}-แบบสอบสวนโรค.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
const printReport = async () => { const source=root.querySelector('[data-investigation-form]'); if(!source) return; const disease=source.querySelector('[data-disease]')?.value || 'แบบสอบสวนโรค'; const button=source.querySelector('[data-print-report]'); const originalLabel=button?.textContent; if(button) { button.disabled=true; button.textContent='กำลังสร้าง PDF…'; } try { await downloadCleanPdf(source,disease); showToast('สร้างไฟล์ PDF แล้ว'); } catch(error) { console.error(error); showToast('ไม่สามารถสร้าง PDF ได้ในขณะนี้'); } finally { if(button) { button.disabled=false; button.textContent=originalLabel; } } };
const renderModuleSaved = () => root.querySelectorAll('[data-module-saved]').forEach(node => { const records=JSON.parse(localStorage.getItem('ndss-module-records') || '[]').filter(item=>item.module===node.dataset.moduleSaved); const latest=records.at(-1); node.textContent=latest ? `บันทึกล่าสุด ${new Date(latest.createdAt).toLocaleString('th-TH')}` : 'ยังไม่มีรายการที่บันทึก'; });
const exportCsv = () => { const rows = [['เลขที่เคส','โรค','ผู้ป่วย','พื้นที่','สถานะ'], ...data.cases.map(x => [x[0],x[1],x[2],x[3],x[5]])]; const file = new Blob([rows.map(x => x.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = 'ndss-report.csv'; link.click(); URL.revokeObjectURL(link.href); showToast('ดาวน์โหลดรายงาน CSV แล้ว'); };
document.addEventListener('click', event => { const nav = event.target.closest('[data-view]'); if (nav) { const view = nav.dataset.view; root.innerHTML = view === 'dashboard' ? overviewDashboard() : `<div class="module-page">${moduleView(view)}</div>`; document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('active', x === nav)); renderModuleSaved(); if(view === 'investigation') { mountHistory(); setTimeout(()=>{renderPins();renderHistory();},0); } if(nav.dataset.epiTarget) { const tab=root.querySelector(`[data-epi-tab="${nav.dataset.epiTarget}"]`); if(tab) tab.click(); } } const epiTab=event.target.closest('[data-epi-tab]'); if(epiTab) { const scope=epiTab.closest('.epi-dashboard'); scope.querySelectorAll('[data-epi-tab]').forEach(tab=>tab.classList.toggle('active',tab===epiTab)); scope.querySelectorAll('[data-epi-pane]').forEach(pane=>{ const active=pane.dataset.epiPane===epiTab.dataset.epiTab; pane.hidden=!active; pane.classList.toggle('active',active); }); } const progressButton=event.target.closest('[data-response-toggle]'); if(progressButton) { const card=progressButton.closest('article'); const expanded=card.classList.toggle('expanded'); progressButton.setAttribute('aria-expanded',String(expanded)); progressButton.textContent=expanded?'⌃':'⌄'; } if (event.target.closest('[data-export]')) exportCsv(); if (event.target.matches('[data-demo-action]')) showToast('เปิดรายละเอียดรายการแล้ว'); });
let investigationMap;
let activeDiseaseFilter = 'all';
let editingCaseIndex = null;
const escapeHtml = value => String(value || '-').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const historyPanel = `<section class="case-history no-print" data-case-history><div class="panel-top"><div><h2>ทะเบียนเคสย้อนหลัง</h2><small>ค้นหา ดูรายละเอียด และแก้ไขข้อมูลที่บันทึกไว้</small></div></div><div class="history-actions"><input data-history-search placeholder="ค้นหาชื่อ, HN, โรค, พื้นที่" /><select data-history-disease><option value="">ทุกโรค</option>${Object.keys(diseaseMeta).map(name=>`<option value="${name}">${name}</option>`).join('')}</select><input data-history-from type="date" aria-label="ตั้งแต่วันที่" /><input data-history-to type="date" aria-label="ถึงวันที่" /><button class="secondary history-search-button" type="button" data-run-history-search>⌕ ค้นหา</button></div><div class="history-table-wrap"><table><thead><tr><th>วันที่บันทึก</th><th>โรค</th><th>ผู้ป่วย</th><th>HN</th><th>พื้นที่</th><th>จัดการ</th></tr></thead><tbody data-history-rows></tbody></table></div><div class="history-detail" data-history-detail>เลือก “รายละเอียด” เพื่อดูข้อมูลของเคส</div></section>`;
const mountHistory = () => { const modal=root.querySelector('[data-form-modal]'); if(modal && !root.querySelector('[data-case-history]')) modal.insertAdjacentHTML('beforebegin',historyPanel); };
const renderHistory = keyword => { const rows=root.querySelector('[data-history-rows]'); if(!rows) return; const cases=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); const search=(keyword ?? root.querySelector('[data-history-search]')?.value ?? '').toLowerCase(); const disease=root.querySelector('[data-history-disease]')?.value || ''; const from=root.querySelector('[data-history-from]')?.value || ''; const to=root.querySelector('[data-history-to]')?.value || ''; const filtered=cases.map((item,index)=>({...item,index})).filter(item=>{ const day=(item.createdAt || '').slice(0,10); return [item.patient,item.hn,item.disease,item.location].join(' ').toLowerCase().includes(search) && (!disease || item.disease===disease) && (!from || day>=from) && (!to || day<=to); }); rows.innerHTML=filtered.length ? filtered.map(item=>`<tr><td>${item.createdAt?new Date(item.createdAt).toLocaleDateString('th-TH'):'-'}</td><td><span class="disease-dot" style="background:${diseaseMeta[item.disease]?.color || '#176fca'}"></span>${escapeHtml(item.disease)}</td><td>${escapeHtml(item.patient)}</td><td>${escapeHtml(item.hn)}</td><td>${escapeHtml(item.location)}</td><td class="case-actions"><button class="table-action" data-view-case="${item.index}">ดู</button><button class="table-action" data-edit-case="${item.index}">แก้ไข</button><button class="table-action" data-print-case="${item.index}">PDF</button><button class="table-action danger" data-delete-case="${item.index}">ลบ</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-history">ไม่พบข้อมูลที่ค้นหา</td></tr>'; };
const openCaseForm = (item = {}, index = null) => { const modal=root.querySelector('[data-form-modal]'); const dialog=modal.querySelector('.form-modal__dialog'); const oldForm=dialog.querySelector('[data-investigation-form]'); oldForm.outerHTML=investigationForm(item.disease || 'ไข้เลือดออก'); const form=dialog.querySelector('[data-investigation-form]'); Object.entries(item).forEach(([name,value])=>{ const field=form.elements[name]; if(!field) return; if(field.type==='checkbox') field.checked=Boolean(value); else field.value=value ?? ''; }); editingCaseIndex=index; modal.hidden=false; document.body.classList.add('modal-open'); };
const renderPins = () => { const mapNode = root.querySelector('[data-case-map]'); if (!mapNode) return; const cases = JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); const visibleCases=activeDiseaseFilter === 'all' ? cases : cases.filter(item => item.disease === activeDiseaseFilter); root.querySelector('[data-total-cases]').textContent = cases.length; Object.keys(diseaseMeta).forEach(disease => { root.querySelector(`[data-disease-total="${disease}"]`).textContent = cases.filter(item => item.disease === disease).length; }); root.querySelectorAll('[data-map-filter]').forEach(card=>card.classList.toggle('active',card.dataset.mapFilter===activeDiseaseFilter)); root.querySelector('[data-map-filter-label]').textContent=activeDiseaseFilter==='all'?'Leaflet.js · แสดงทุกโรค':`Leaflet.js · แสดงเฉพาะ ${activeDiseaseFilter}`; if (!window.L) { mapNode.textContent = 'กำลังโหลดแผนที่ Leaflet...'; return; } if (investigationMap) investigationMap.remove(); investigationMap = window.L.map(mapNode,{scrollWheelZoom:false}).setView([6.426,101.825],12); window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(investigationMap); const bounds=[]; visibleCases.forEach((item,index) => { const lat=Number(item.lat) || 6.426 + (index % 4) * .008; const lng=Number(item.lng) || 101.825 + (index % 4) * .01; const color=diseaseMeta[item.disease]?.color || '#176fca'; const marker=window.L.circleMarker([lat,lng],{radius:10,color:'#fff',weight:3,fillColor:color,fillOpacity:1}).addTo(investigationMap); const detail=`<b>${escapeHtml(item.patient)}</b><br>${escapeHtml(item.disease)}<br>${escapeHtml(item.location)}<br><small>เริ่มป่วย ${escapeHtml(item.onset)} · ${lat.toFixed(5)}, ${lng.toFixed(5)}</small>`; marker.bindPopup(detail).on('click',()=>root.querySelector('[data-map-details]').innerHTML=detail); bounds.push([lat,lng]); }); if(bounds.length) investigationMap.fitBounds(bounds,{padding:[36,36],maxZoom:14}); investigationMap.on('click',event=>{ const lat=event.latlng.lat.toFixed(6), lng=event.latlng.lng.toFixed(6); const form=root.querySelector('[data-investigation-form]'); if(form?.elements.lat) form.elements.lat.value=lat; if(form?.elements.lng) form.elements.lng.value=lng; root.querySelector('[data-map-details]').textContent=`เลือกพิกัด ${lat}, ${lng} แล้ว — บันทึกแบบฟอร์มเพื่อปักหมุด`; }); root.querySelector('[data-map-details]').textContent = visibleCases.length ? `${visibleCases.length} เคสบนแผนที่ — คลิกหมุดหรือพื้นที่บนแผนที่เพื่อเลือกพิกัด` : 'ไม่พบเคสตามตัวกรองที่เลือก'; setTimeout(()=>investigationMap.invalidateSize(),100); };
document.addEventListener('submit', event => { if (event.target.matches('[data-module-save]')) { event.preventDefault(); const records=JSON.parse(localStorage.getItem('ndss-module-records') || '[]'); records.push({module:event.target.dataset.moduleName,values:Object.fromEntries(new FormData(event.target)),createdAt:new Date().toISOString()}); localStorage.setItem('ndss-module-records',JSON.stringify(records)); event.target.reset(); renderModuleSaved(); showToast('บันทึกข้อมูลในเครื่องแล้ว'); } if (event.target.matches('[data-investigation-form]')) { event.preventDefault(); const value=Object.fromEntries(new FormData(event.target)); const records=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); const saved={...value,location:value.location || [value.subdistrict,value.district,value.province].filter(Boolean).join(' '),disease:event.target.querySelector('[data-disease]').value,createdAt:editingCaseIndex === null ? new Date().toISOString() : records[editingCaseIndex].createdAt,updatedAt:new Date().toISOString()}; if(editingCaseIndex === null) records.push(saved); else records[editingCaseIndex]=saved; localStorage.setItem('ndss-investigations',JSON.stringify(records)); window.dispatchEvent(new Event('ndss-cases-updated')); editingCaseIndex=null; root.querySelector('[data-form-modal]').hidden=true; document.body.classList.remove('modal-open'); renderPins(); renderHistory(); showToast('บันทึกข้อมูลและอัปเดตแผนที่แล้ว'); } });
document.addEventListener('change', event => { if(event.target.matches('[data-disease]')) { const disease=event.target.value; const meta=diseaseMeta[disease]; const template=root.querySelector('[data-template-download]'); if(template) { template.href=`./public/forms/${encodeURIComponent(meta.template)}`; template.textContent=`เปิด PDF ต้นฉบับ: ${disease}`; } const pages=root.querySelector('[data-template-pages]'); if(pages) pages.innerHTML=Array.from({length:meta.pages},(_,i)=>`<img src="./public/form-pages/${encodeURIComponent(meta.template.replace('.pdf',''))}-${i+1}.png" alt="แบบฟอร์ม ${disease} หน้า ${i+1}" loading="lazy" />`).join(''); event.target.closest('[data-investigation-form]').outerHTML=investigationForm(disease); showToast(`เปลี่ยนเป็นแบบฟอร์ม ${disease} ตามต้นฉบับแล้ว`); } });
document.addEventListener('input', event => { if (event.target.matches('[data-filter]')) { const keyword = event.target.value.toLowerCase(); event.target.closest('.work-panel').querySelectorAll('tbody tr').forEach(row => row.hidden = !row.textContent.toLowerCase().includes(keyword)); } if(event.target.matches('[data-history-search],[data-history-from],[data-history-to]')) renderHistory(); });
document.addEventListener('keydown', event => { if(event.key === 'Enter' && event.target.matches('[data-history-search]')) { event.preventDefault(); renderHistory(); } });
document.addEventListener('change', event => { if(event.target.matches('[data-history-disease]')) renderHistory(); });
document.addEventListener('click', event => { const filter=event.target.closest('[data-map-filter]'); if(filter) { activeDiseaseFilter=filter.dataset.mapFilter; renderPins(); } if(event.target.matches('[data-clear-pins]')) { localStorage.removeItem('ndss-investigations'); activeDiseaseFilter='all'; renderPins(); renderHistory(); } if(event.target.closest('[data-run-history-search]')) renderHistory(); const newCase=event.target.closest('[data-new-case]'); if(newCase) openCaseForm({disease:'ไข้เลือดออก'},null); const viewCase=event.target.closest('[data-view-case]'); if(viewCase) { const item=JSON.parse(localStorage.getItem('ndss-investigations') || '[]')[Number(viewCase.dataset.viewCase)]; const detail=root.querySelector('[data-history-detail]'); if(item && detail) detail.innerHTML=`<div><b>${escapeHtml(item.patient)}</b><span>${escapeHtml(item.disease)}</span></div><dl><dt>HN</dt><dd>${escapeHtml(item.hn)}</dd><dt>วันเริ่มป่วย</dt><dd>${escapeHtml(item.onset)}</dd><dt>พื้นที่</dt><dd>${escapeHtml(item.location)}</dd><dt>พิกัด</dt><dd>${escapeHtml(item.lat)}, ${escapeHtml(item.lng)}</dd><dt>บันทึกล่าสุด</dt><dd>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('th-TH') : '-'}</dd></dl>`; } const editCase=event.target.closest('[data-edit-case]'); if(editCase) { const index=Number(editCase.dataset.editCase); openCaseForm(JSON.parse(localStorage.getItem('ndss-investigations') || '[]')[index],index); } const printCase=event.target.closest('[data-print-case]'); if(printCase) { const index=Number(printCase.dataset.printCase); const item=JSON.parse(localStorage.getItem('ndss-investigations') || '[]')[index]; if(item) { openCaseForm(item,index); setTimeout(printReport,120); } } const deleteCase=event.target.closest('[data-delete-case]'); if(deleteCase) { const index=Number(deleteCase.dataset.deleteCase); const records=JSON.parse(localStorage.getItem('ndss-investigations') || '[]'); if(records[index] && window.confirm(`ลบเคส ${records[index].patient || records[index].disease} ใช่หรือไม่?`)) { records.splice(index,1); localStorage.setItem('ndss-investigations',JSON.stringify(records)); renderPins(); renderHistory(); showToast('ลบเคสแล้ว'); } } });
document.addEventListener('click', event => { if(event.target.closest('[data-print-report]')) printReport(); const modal=root.querySelector('[data-form-modal]'); if(!modal) return; const diseaseButton=event.target.closest('[data-open-disease-form]'); if(diseaseButton) openCaseForm({disease:diseaseButton.dataset.openDiseaseForm},null); if(event.target.closest('[data-open-online-form]')) openCaseForm({disease:'ไข้เลือดออก'},null); if(event.target.closest('[data-close-online-form]') || event.target === modal) { editingCaseIndex=null; modal.hidden=true; document.body.classList.remove('modal-open'); } });
document.addEventListener('click', event => { const menu=root.querySelector('[data-original-forms-menu]'); if(!menu) return; const trigger=event.target.closest('[data-toggle-original-forms]'); if(trigger) { const open=menu.hidden; menu.hidden=!open; trigger.setAttribute('aria-expanded',String(open)); trigger.querySelector('span').textContent=open?'⌃':'⌄'; return; } if(!event.target.closest('[data-original-forms-menu]')) { menu.hidden=true; root.querySelector('[data-toggle-original-forms]')?.setAttribute('aria-expanded','false'); } });
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
  const rows=commandRecords(); if(!rows.length) { showToast('ยังไม่มีข้อมูล รง.506 สำหรับส่งออก'); return; }
  const head=['โรค','วันเริ่มป่วย','เพศ','อายุ','ตำบล','อำเภอ','ละติจูด','ลองจิจูด'];
  const body=rows.map(r=>[r.disease,r.onset,r.sex,r.age,r.tambon,r.district,r.latitude,r.longitude]);
  const blob=new Blob([[head,...body].map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='ndss-506-summary.csv'; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),500);
};
const commandExport = ({dataset,filename}) => {
  const sources={
    '506': commandRecords(),
    investigation: commandCases(),
    lab: (()=>{ try { return JSON.parse(localStorage.getItem('ndss-lab-results') || '[]'); } catch { return []; } })(),
    tasks: (()=>{ try { return JSON.parse(localStorage.getItem('ndss-response-tasks') || '[]'); } catch { return []; } })()
  };
  const rows=sources[dataset] || [];
  if(!rows.length) { showToast('ยังไม่มีข้อมูลในชุดที่เลือกสำหรับส่งออก'); return; }
  const keys=[...new Set(rows.flatMap(row=>Object.keys(row).filter(key=>!['raw','pdfData'].includes(key))))];
  const csv=[keys,...rows.map(row=>keys.map(key=>typeof row[key]==='object' ? JSON.stringify(row[key]) : row[key] ?? ''))].map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');
  const safeName=(filename || `ndss-${dataset}-${new Date().toISOString().slice(0,10)}`).replace(/[^a-zA-Z0-9ก-๙_\-]/g,'-');
  const blob=new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`${safeName}.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),500);
  recordAudit('ส่งออกข้อมูล CSV',`ชุดข้อมูล ${dataset} · ${rows.length} รายการ`);
  showToast(`ดาวน์โหลด ${rows.length} รายการแล้ว`);
};
const backupKeys=['ndss-506-records','ndss-506-import-meta','ndss-investigations','ndss-response-tasks','ndss-lab-results','ndss-alert-state','ndss-audit-log'];
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
    if(!window.confirm('กู้คืนข้อมูลจะเขียนทับข้อมูลในอุปกรณ์นี้ ต้องการดำเนินการหรือไม่?')) return;
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
  root.querySelectorAll('[data-report-rows] tr').forEach(row=>{
    row.hidden=(!row.textContent.toLowerCase().includes(query)) || (status!=='all' && row.dataset.reportStatus!==status);
  });
};
const filterEventReportRows = () => {
  const query=(root.querySelector('[data-event-report-search]')?.value || '').toLowerCase();
  const status=root.querySelector('[data-event-report-status]')?.value || 'all';
  root.querySelectorAll('[data-event-report-rows] tr').forEach(row=>{
    row.hidden=(!row.textContent.toLowerCase().includes(query)) || (status!=='all' && row.dataset.eventReportStatus!==status);
  });
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
  if(event.target.matches('[data-506-report-disease],[data-506-report-area]')) {
    const disease=root.querySelector('[data-506-report-disease]')?.value || '';
    const area=root.querySelector('[data-506-report-area]')?.value || '';
    localStorage.setItem('ndss-506-report-disease',disease);
    localStorage.setItem('ndss-506-report-area',area);
    root.innerHTML=`<div class="module-page">${moduleView('report506')}</div>`;
    document.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('active',link.dataset.view==='report506'));
  }
});
document.addEventListener('input', event => {
  if(event.target.matches('[data-command-queue-search]')) { const keyword=event.target.value.toLowerCase(); root.querySelectorAll('[data-command-queue-rows] tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(keyword)); }
  if(event.target.matches('[data-lab-search]')) { const keyword=event.target.value.toLowerCase(); root.querySelectorAll('[data-lab-rows] tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(keyword)); }
  if(event.target.matches('[data-report-search]')) filterReportRows();
  if(event.target.matches('[data-event-report-search]')) filterEventReportRows();
});
document.addEventListener('click', event => {
  const commandView=event.target.closest('[data-view]')?.dataset.view;
  if(commandView==='area-map') setTimeout(renderCommandMap,0);
  if(event.target.closest('[data-open-506-import]')) document.querySelector('.nav-link[data-view="import506"]')?.click();
  if(event.target.closest('[data-clear-506]')) { localStorage.removeItem('ndss-506-records'); localStorage.removeItem('ndss-506-import-meta'); recordAudit('ล้างข้อมูล รง.506','ล้างข้อมูลที่นำเข้าในอุปกรณ์นี้'); root.querySelector('[data-import-status]')?.replaceChildren(document.createTextNode('ล้างข้อมูลนำเข้าแล้ว')); showToast('ล้างข้อมูล รง.506 แล้ว'); }
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
