# Naradhiwas Disease Surveillance System (NDSS)

แดชบอร์ดเฝ้าระวังโรคสำหรับโรงพยาบาลนราธิวาสราชนครินทร์ ออกแบบจากภาพอ้างอิง
และแยกโค้ดตามหน้าที่ใน `src/components`, `src/data`, `src/services`, และ `src/styles`.

## เริ่มใช้งาน

เปิด `index.html` ด้วย web server แบบ static (เช่น VS Code Live Server) ได้ทันที
หรือใช้ `npx serve .` หากมี Node.js ติดตั้งอยู่

## ตรวจรับก่อนเผยแพร่

เมื่อมี Node.js ให้รันคำสั่งด้านล่างจากโฟลเดอร์โครงการก่อนพุชขึ้น GitHub:

```powershell
node tests/report506-service.test.mjs
node tests/ndss-readiness.test.mjs
node tests/supabase-session.test.mjs
```

คำสั่งนี้ไม่เชื่อมต่อ ไม่อ่าน และไม่เขียนข้อมูลผู้ป่วยใน Supabase โดยจะตรวจการนำเข้า รง.506, การ retry, การกันรายการซ้ำ, การต่ออายุ session, ไฟล์เริ่มต้นหน้าเว็บ, ความพร้อมของการซิงค์ และการไม่มี service-role key ใน runtime configuration.

## Supabase

คัดลอก `src/config/runtime-config.example.js` เป็น `src/config/runtime-config.js` และใส่ **publishable/anon key** ของโปรเจกต์
ห้ามนำ `service_role` key มาใส่ในเว็บเบราว์เซอร์โดยเด็ดขาด

การเชื่อมต่อจะถูกเปิดใช้เมื่อกำหนด key แล้ว โดยตัวอย่าง query อยู่ใน
`src/services/dashboard-service.js` และ UI จะใช้ข้อมูลตัวอย่างอย่างปลอดภัยเมื่อยังไม่ตั้งค่า key.

เริ่มสร้างตารางได้จาก `supabase/schema.sql` ซึ่งเปิด RLS และจำกัดการอ่านข้อมูล
ไว้สำหรับผู้ใช้ที่ยืนยันตัวตนแล้วเท่านั้น.

เมื่อตารางและ token ของผู้ใช้งานพร้อม หน้าเว็บจะเรียก Supabase REST API โดยตรง
และจะกลับไปใช้ข้อมูลตัวอย่างหากการเชื่อมต่อหรือสิทธิ์ RLS ยังไม่พร้อม.
