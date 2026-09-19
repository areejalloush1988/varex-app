# Backend integration

هذه الملفات هي نسخة معزولة من كود VAREX AI Trading المنشور داخل موقع VAREX المركزي.

- تعتمد ملفات `lib` على وحدات المصادقة وSupabase relay المشتركة في الموقع المركزي.
- يضاف SQL الموجود في `drizzle/0005_trading_schema.sql` و`drizzle/0006_flippant_shatterstar.sql` إلى سلسلة ترحيلات D1 في الموقع.
- متغير `TRADING_CREDENTIAL_KEY` هو مفتاح Base64 بطول 32 بايت، ويُحفظ كسِر في بيئة الاستضافة فقط.
- مفاتيح Binance تُشفّر باستخدام AES-GCM قبل التخزين ولا تُعاد إلى المتصفح بعد الربط.
- موصل Binance يقرأ صلاحيات المفتاح من `/sapi/v1/account/apiRestrictions` ويرفض السحب والتحويلات وكل المنتجات غير Spot.
- تنفيذ الأمر الحقيقي يمر أولاً عبر `/api/v3/order/test` ثم `/api/v3/order`، مع معرف طلب فريد وسجل تدقيق دائم.
- لا توجد في التطبيق أي واجهة إيداع أو سحب؛ إدارة الأموال تتم من منصة Binance فقط.
