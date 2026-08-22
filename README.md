# Naradhiwas Disease Surveillance System (NDSS)

แดชบอร์ดเฝ้าระวังโรคสำหรับโรงพยาบาลนราธิวาสราชนครินทร์ ออกแบบจากภาพอ้างอิง
และแยกโค้ดตามหน้าที่ใน `src/components`, `src/data`, `src/services`, และ `src/styles`.

## เริ่มใช้งาน

เปิด `index.html` ด้วย web server แบบ static (เช่น VS Code Live Server) ได้ทันที
หรือใช้ `npx serve .` หากมี Node.js ติดตั้งอยู่

## Supabase

คัดลอก `.env.example` เป็น `.env` และใส่ **publishable/anon key** ของโปรเจกต์
ห้ามนำ `service_role` key มาใส่ในเว็บเบราว์เซอร์โดยเด็ดขาด

การเชื่อมต่อจะถูกเปิดใช้เมื่อกำหนด key แล้ว โดยตัวอย่าง query อยู่ใน
`src/services/dashboard-service.js` และ UI จะใช้ข้อมูลตัวอย่างอย่างปลอดภัยเมื่อยังไม่ตั้งค่า key.

เริ่มสร้างตารางได้จาก `supabase/schema.sql` ซึ่งเปิด RLS และจำกัดการอ่านข้อมูล
ไว้สำหรับผู้ใช้ที่ยืนยันตัวตนแล้วเท่านั้น.
