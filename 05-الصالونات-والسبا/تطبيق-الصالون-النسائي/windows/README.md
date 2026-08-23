# Windows build

```powershell
npm install
npm run build
```

يُنشئ الأمر نسختين داخل `release/`:

- مثبت Windows بصيغة EXE.
- نسخة Portable بصيغة EXE.

لإزالة تحذير Windows SmartScreen عند التوزيع العام، أضيفي شهادة Code Signing في بيئة البناء ولا تضعيها داخل GitHub.

