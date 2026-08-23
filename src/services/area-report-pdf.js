const width = 1240;
const height = 1754;
const margin = 70;

const wrap = (ctx, value, maxWidth) => {
  const lines = [];
  let line = '';
  for (const character of String(value || '-')) {
    if (ctx.measureText(line + character).width > maxWidth && line) {
      lines.push(line);
      line = character;
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
};

const makePdf = pages => {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let size = 0;
  const add = bytes => { parts.push(bytes); size += bytes.length; };
  const text = value => add(encoder.encode(value));
  const object = (id, content) => {
    offsets[id] = size;
    text(`${id} 0 obj\n`);
    typeof content === 'string' ? text(content) : content();
    text('\nendobj\n');
  };
  const images = pages.map(page => Uint8Array.from(atob(page.toDataURL('image/jpeg', 0.92).split(',')[1]), item => item.charCodeAt(0)));
  const pageIds = pages.map((_, index) => 3 + index * 3);
  text('%PDF-1.4\n%âãÏÓ\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach((_, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const image = images[index];
    const stream = `q\n595.28 0 0 841.89 0 0 cm\n/Im${index} Do\nQ\n`;
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    object(imageId, () => {
      text(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
      add(image);
      text('\nendstream');
    });
    object(contentId, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
  });
  const xref = size;
  text(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let index = 1; index < offsets.length; index += 1) text(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
};

const recordsInPlace = place => JSON.parse(localStorage.getItem('ndss-investigations') || '[]').filter(item => {
  const values = place.level === 'district'
    ? [item.district, item.location]
    : [item.subdistrict, item.location];
  return values.filter(Boolean).some(value => String(value).includes(place.name));
});

const drawAreaMap = (ctx, geometry, x, y, mapWidth, mapHeight) => {
  ctx.fillStyle = '#f3f8fc';
  ctx.fillRect(x, y, mapWidth, mapHeight);
  ctx.strokeStyle = '#b8d0e6';
  ctx.strokeRect(x, y, mapWidth, mapHeight);
  ctx.fillStyle = '#31567f';
  ctx.font = '700 13px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('แผนที่ขอบเขตพื้นที่รายงาน', x + 10, y + 18);
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  const points = polygons.flat(2);
  if (!points.length) return;
  const lngs = points.map(point => point[0]);
  const lats = points.map(point => point[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const padding = 16, availableWidth = mapWidth - padding * 2, availableHeight = mapHeight - 34 - padding;
  const scale = Math.min(availableWidth / Math.max(maxLng - minLng, 0.00001), availableHeight / Math.max(maxLat - minLat, 0.00001));
  const offsetX = x + (mapWidth - (maxLng - minLng) * scale) / 2;
  const offsetY = y + 28 + (availableHeight - (maxLat - minLat) * scale) / 2;
  ctx.fillStyle = '#2489df';
  ctx.strokeStyle = '#063d73';
  ctx.lineWidth = 2;
  polygons.forEach(polygon => polygon.forEach(ring => {
    ctx.beginPath();
    ring.forEach(([lng, lat], index) => {
      const px = offsetX + (lng - minLng) * scale;
      const py = offsetY + (maxLat - lat) * scale;
      if (index) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }));
};

export const downloadAreaReportPdf = async place => {
  await document.fonts?.ready;
  const logo = new Image();
  const logoReady = new Promise(resolve => { logo.onload = logo.onerror = resolve; logo.src = './public/assets/naradhiwas-hospital-logo.svg'; });
  await logoReady;
  const records = recordsInPlace(place).sort((a, b) => String(a.disease).localeCompare(String(b.disease), 'th') || String(a.onset).localeCompare(String(b.onset)));
  const pages = [];
  let canvas;
  let ctx;
  let y;
  const columns = [
    { label: 'ลำดับ', width: 58, value: (_, index) => String(index + 1) },
    { label: 'โรค', width: 178, value: item => item.disease || '-' },
    { label: 'ผู้ป่วย', width: 210, value: item => item.patient || '-' },
    { label: 'HN', width: 115, value: item => item.hn || '-' },
    { label: 'วันเริ่มป่วย', width: 140, value: item => item.onset || '-' },
    { label: 'พื้นที่', width: 398, value: item => item.location || [item.subdistrict, item.district, item.province].filter(Boolean).join(' ') || '-' }
  ];
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);

  const drawTableHead = () => {
    let x = margin;
    ctx.fillStyle = '#0b3f76';
    ctx.fillRect(margin, y, tableWidth, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '700 15px "IBM Plex Sans Thai", sans-serif';
    columns.forEach(column => {
      ctx.fillText(column.label, x + 10, y + 21);
      x += column.width;
    });
    y += 32;
  };

  const startPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
    pages.push(canvas);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    if (logo.naturalWidth) ctx.drawImage(logo, margin, 42, 88, 88);
    ctx.fillStyle = '#071d38';
    ctx.font = '700 30px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('โรงพยาบาลนราธิวาสราชนครินทร์', margin + 108, 75);
    ctx.fillStyle = '#416582';
    ctx.font = '600 17px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('Naradhiwas Rajanagarindra Hospital', margin + 108, 102);
    ctx.strokeStyle = '#0b294d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, 148);
    ctx.lineTo(width - margin, 148);
    ctx.stroke();
    ctx.fillStyle = '#071d38';
    ctx.font = '700 27px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('รายงานเคสสอบสวนตามพื้นที่', margin, 193);
    ctx.fillStyle = '#0b63b6';
    ctx.font = '700 20px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(`${place.level === 'district' ? 'อำเภอ' : 'ตำบล'}${place.name}`, margin, 225);
    ctx.fillStyle = '#416582';
    ctx.font = '600 16px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(`จำนวน ${records.length} เคส · จัดทำ ${new Date().toLocaleString('th-TH')}`, margin, 251);
    drawAreaMap(ctx, place.geometry, width - margin - 270, 160, 270, 108);
    y = 278;
    drawTableHead();
  };

  startPage();
  records.forEach((record, index) => {
    ctx.font = '600 15px "IBM Plex Sans Thai", sans-serif';
    const cells = columns.map(column => wrap(ctx, column.value(record, index), column.width - 18));
    const rowHeight = Math.max(38, ...cells.map(lines => lines.length * 19 + 12));
    if (y + rowHeight > height - 70) startPage();
    let x = margin;
    ctx.fillStyle = index % 2 ? '#f6f9fc' : '#fff';
    ctx.fillRect(margin, y, tableWidth, rowHeight);
    ctx.strokeStyle = '#d3e0eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, tableWidth, rowHeight);
    cells.forEach((lines, cellIndex) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rowHeight);
      ctx.stroke();
      ctx.fillStyle = '#102f50';
      lines.forEach((line, lineIndex) => ctx.fillText(line, x + 9, y + 20 + lineIndex * 19));
      x += columns[cellIndex].width;
    });
    ctx.beginPath();
    ctx.moveTo(margin + tableWidth, y);
    ctx.lineTo(margin + tableWidth, y + rowHeight);
    ctx.stroke();
    y += rowHeight;
  });
  if (!records.length) {
    ctx.fillStyle = '#eef5fb';
    ctx.fillRect(margin, y + 18, tableWidth, 72);
    ctx.fillStyle = '#416582';
    ctx.font = '600 18px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('ไม่พบเคสที่บันทึกในพื้นที่นี้', margin + 22, y + 60);
  }
  pages.forEach((page, index) => {
    const pageContext = page.getContext('2d');
    pageContext.strokeStyle = '#d5e0ea';
    pageContext.beginPath();
    pageContext.moveTo(margin, height - 52);
    pageContext.lineTo(width - margin, height - 52);
    pageContext.stroke();
    pageContext.fillStyle = '#60778f';
    pageContext.font = '500 14px "IBM Plex Sans Thai", sans-serif';
    pageContext.fillText('ระบบแบบสอบสวนโรคออนไลน์ · โรงพยาบาลนราธิวาสราชนครินทร์', margin, height - 28);
    pageContext.textAlign = 'right';
    pageContext.fillText(`หน้า ${index + 1} / ${pages.length}`, width - margin, height - 28);
    pageContext.textAlign = 'left';
  });
  const url = URL.createObjectURL(makePdf(pages));
  const link = document.createElement('a');
  link.href = url;
  link.download = `NDSS-${place.code || place.level}-${new Date().toISOString().slice(0, 10)}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
