export function shell(content) {
  const groups = [
    {root:true,items:[
      {id:'dashboard',label:'🏠 Dashboard'},
      {id:'epidemiology',label:'📊 Dashboard ระบาดวิทยา'},
      {id:'investigation',label:'📝 แบบสอบสวนโรคออนไลน์'},
      {id:'tracking',label:'🦠 ติดตามและควบคุมโรค'},
      {id:'alerts',label:'🚨 ระบบแจ้งเตือน'},
      {id:'queue',label:'🔥 Qutbreak Management'},
      {id:'report506',label:'📄 รายงาน 506'},
      {id:'lab',label:'🧪 รายงานห้องปฏิบัติการ'},
      {id:'executive',label:'👨‍💼 รายงานผู้บริหาร'},
      {id:'area-map',label:'🗺️ แผนที่ระบาดวิทยา'},
      {id:'export',label:'📥 Export Report'},
      {id:'knowledge',label:'📚 Knowledge Center'},
      {id:'settings',label:'⚙️ ตั้งค่า / ผู้ดูแลระบบ'}
    ]}
  ];
  const menu=groups.map(({heading,items,root:topLevel})=>`<section class="nav-group ${!topLevel&&items.length>1?'has-children':''} ${topLevel?'root-menu':''}">${heading ? `<p>${heading}</p>` : ''}${items.map(({id,label,epi})=>{ const hasIcon=/^[^A-Za-zก-๙]/.test(label); const icon=hasIcon ? label.slice(0,label.indexOf(' ')) : '•'; const text=hasIcon ? label.slice(label.indexOf(' ')+1) : label; return `<button class="nav-link ${id==='dashboard'?'active':''}" data-view="${id}"${epi ? ` data-epi-target="${epi}"` : ''}><i>${icon}</i><span>${text}</span></button>`; }).join('')}</section>`).join('');
  return `<aside class="sidebar command-sidebar"><div class="sidebar-identity"><img src="./public/assets/naradhiwas-hospital-logo.jpg" alt="โลโก้โรงพยาบาล" /><div><strong>ศูนย์บัญชาการข้อมูลโรค</strong><small>โรงพยาบาลนราธิวาสราชนครินทร์</small></div></div><div class="system-name"><b>NDSS</b><small>ระบบเฝ้าระวัง สอบสวน และวิเคราะห์<br/>สถานการณ์โรคระดับพื้นที่</small></div><nav aria-label="เมนูหลัก">${menu}</nav><div class="sync"><b><em>●</em> สถานะการเชื่อมต่อ</b><span>ข้อมูลจากอุปกรณ์นี้</span><small>เชื่อมฐานข้อมูลกลางได้จากเมนูตั้งค่า</small></div></aside><main><header class="top-header command-header"><div class="header-context"><b>ศูนย์บัญชาการระบาดวิทยา</b><small>ข้อมูลจริงจาก รง.506 และแบบสอบสวนโรคออนไลน์</small></div><div class="header-actions"><button class="header-import" type="button" data-open-506-import>＋ นำเข้า Excel</button><button class="notification" type="button" aria-label="การแจ้งเตือน">♧<i>0</i></button><div class="profile-chip"><span>👩‍⚕️</span><div><b>ผู้ใช้งานระบบ</b><small>NDSS Narathiwat</small></div><em>⌄</em></div></div></header><div id="module-root">${content}</div></main>`;
}
