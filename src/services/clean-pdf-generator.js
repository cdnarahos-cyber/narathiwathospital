const pageWidth = 1240;
const pageHeight = 1754;
const margin = 72;
const bodyWidth = pageWidth - margin * 2;

const lineWrap = (ctx, value, maxWidth) => {
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

const readFields = source => {
  const headings = [...source.querySelectorAll('h2')];
  return [...source.querySelectorAll('label')].flatMap(label => {
  const control = label.querySelector('input, select, textarea');
  if (!control) return [];
  const copy = label.cloneNode(true);
  copy.querySelectorAll('input, select, textarea').forEach(node => node.remove());
  const name = copy.textContent.trim() || 'ข้อมูล';
  let value = '-';
  if (control.type === 'checkbox' || control.type === 'radio') value = control.checked ? 'เลือก' : 'ไม่เลือก';
  else if (control.tagName === 'SELECT') value = control.options[control.selectedIndex]?.text || '-';
  else value = control.value || '-';
    const section = headings.filter(heading => heading.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1)?.textContent.trim() || 'ข้อมูลแบบสอบสวน';
    return [{ name, value, section }];
  });
};

const makePdf = (pages) => {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let size = 0;
  const add = value => { chunks.push(value); size += value.length; };
  const text = value => add(encoder.encode(value));
  const object = (id, content) => {
    offsets[id] = size;
    text(`${id} 0 obj\n`);
    typeof content === 'string' ? text(content) : content();
    text('\nendobj\n');
  };
  const images = pages.map(page => Uint8Array.from(atob(page.toDataURL('image/jpeg', 0.92).split(',')[1]), char => char.charCodeAt(0)));
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
      text(`<< /Type /XObject /Subtype /Image /Width ${pageWidth} /Height ${pageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
      add(image);
      text('\nendstream');
    });
    object(contentId, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
  });
  const xref = size;
  text(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let index = 1; index < offsets.length; index += 1) text(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
};

export const downloadCleanPdf = async (source, disease) => {
  await document.fonts?.ready;
  const logo = new Image();
  const logoReady = new Promise(resolve => { logo.onload = logo.onerror = resolve; logo.src = './public/assets/naradhiwas-hospital-logo.svg'; });
  await logoReady;
  const pages = [];
  let canvas;
  let ctx;
  let y;
  let column = 0;
  let rowHeight = 0;
  let currentSection = '';
  const fieldValue = name => source.elements[name]?.value || '-';

  const startPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    ctx = canvas.getContext('2d');
    pages.push(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    if (logo.naturalWidth) ctx.drawImage(logo, margin, 44, 96, 96);
    ctx.fillStyle = '#071d38';
    ctx.font = '700 31px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('โรงพยาบาลนราธิวาสราชนครินทร์', margin + 116, 76);
    ctx.fillStyle = '#31567f';
    ctx.font = '600 18px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('Naradhiwas Rajanagarindra Hospital', margin + 116, 104);
    ctx.strokeStyle = '#0b294d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, 154);
    ctx.lineTo(pageWidth - margin, 154);
    ctx.stroke();
    ctx.fillStyle = '#071d38';
    ctx.font = '700 28px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(source.querySelector('.report-title span')?.textContent || 'แบบสอบสวนโรค', margin, 199);
    ctx.fillStyle = '#416582';
    ctx.font = '500 16px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(`เอกสารแบบสอบสวนโรค · หน้าที่ ${pages.length}`, margin, 227);
    ctx.strokeStyle = '#d5e0ea';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, pageHeight - 52);
    ctx.lineTo(pageWidth - margin, pageHeight - 52);
    ctx.stroke();
    ctx.fillStyle = '#60778f';
    ctx.font = '500 14px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('โรงพยาบาลนราธิวาสราชนครินทร์ · ระบบแบบสอบสวนโรคออนไลน์', margin, pageHeight - 28);
    ctx.textAlign = 'right';
    ctx.fillText(`พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}`, pageWidth - margin, pageHeight - 28);
    ctx.textAlign = 'left';
    if (pages.length === 1) {
      const overview = [
        ['แบบฟอร์ม', disease],
        ['ผู้ป่วย', fieldValue('patient')],
        ['HN', fieldValue('hn')],
        ['วันเริ่มป่วย', fieldValue('onset')]
      ];
      const cardWidth = (bodyWidth - 36) / 4;
      overview.forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + 12);
        ctx.fillStyle = '#f4f8fc';
        ctx.fillRect(x, 264, cardWidth, 64);
        ctx.fillStyle = '#416582';
        ctx.font = '600 14px "IBM Plex Sans Thai", sans-serif';
        ctx.fillText(label, x + 14, 286);
        ctx.fillStyle = '#071d38';
        ctx.font = '700 17px "IBM Plex Sans Thai", sans-serif';
        const valueLine = lineWrap(ctx, value, cardWidth - 28)[0] || '-';
        ctx.fillText(valueLine, x + 14, 312);
      });
      y = 350;
    } else y = 264;
    column = 0;
    rowHeight = 0;
  };

  const drawSection = title => {
    if (column) {
      y += rowHeight + 14;
      column = 0;
      rowHeight = 0;
    }
    if (y + 48 > pageHeight - margin) startPage();
    ctx.fillStyle = '#edf5fc';
    ctx.fillRect(margin, y, bodyWidth, 42);
    ctx.fillStyle = '#176fca';
    ctx.fillRect(margin, y, 6, 42);
    ctx.fillStyle = '#0b3f76';
    ctx.font = '700 20px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(title, margin + 20, y + 27);
    y += 56;
  };

  const drawField = ({ name, value }) => {
    const isWide = String(value).length > 54 || name.length > 38 || /ที่อยู่|รายละเอียด|อาการ|ประวัติ|หมายเหตุ|ผลการ|สถานที่|ความสัมพันธ์/.test(name);
    if (isWide && column) {
      y += rowHeight + 14;
      column = 0;
      rowHeight = 0;
    }
    const gutter = 22;
    const width = isWide ? bodyWidth : (bodyWidth - gutter) / 2;
    const x = isWide ? margin : margin + column * (width + gutter);
    ctx.font = '700 18px "IBM Plex Sans Thai", sans-serif';
    const titleLines = lineWrap(ctx, name, width - 36);
    ctx.font = '600 18px "IBM Plex Sans Thai", sans-serif';
    const valueLines = lineWrap(ctx, value, width - 36);
    const height = Math.max(84, titleLines.length * 24 + valueLines.length * 25 + 34);
    if (y + height > pageHeight - margin) {
      startPage();
      if (currentSection) drawSection(currentSection);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y - 4, width, height - 8);
    ctx.strokeStyle = '#d5e0ea';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y - 4, width, height - 8);
    ctx.fillStyle = '#123b6d';
    ctx.font = '700 18px "IBM Plex Sans Thai", sans-serif';
    titleLines.forEach((line, index) => ctx.fillText(line, x + 18, y + 18 + index * 24));
    ctx.fillStyle = '#071d38';
    ctx.font = '600 18px "IBM Plex Sans Thai", sans-serif';
    valueLines.forEach((line, index) => ctx.fillText(line, x + 18, y + 18 + titleLines.length * 24 + index * 25));
    if (isWide) {
      y += height + 12;
      column = 0;
      rowHeight = 0;
    } else {
      rowHeight = Math.max(rowHeight, height);
      if (column === 0) column = 1;
      else {
        y += rowHeight + 12;
        column = 0;
        rowHeight = 0;
      }
    }
  };

  startPage();
  readFields(source).forEach(field => {
    if (field.section !== currentSection) {
      currentSection = field.section;
      drawSection(currentSection);
    }
    drawField(field);
  });
  pages.forEach((page, index) => {
    const pageContext = page.getContext('2d');
    pageContext.fillStyle = '#416582';
    pageContext.font = '600 16px "IBM Plex Sans Thai", sans-serif';
    pageContext.textAlign = 'right';
    pageContext.fillText(`หน้า ${index + 1} / ${pages.length}`, pageWidth - margin, 227);
    pageContext.textAlign = 'left';
  });
  const blob = makePdf(pages);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const hn = String(fieldValue('hn')).replace(/[^a-zA-Z0-9_-]/g, '') || 'case';
  const date = new Date().toISOString().slice(0, 10);
  link.download = `NDSS-${hn}-${date}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
