# Mobile builds

مشروع واحد يخدم Android Phone وAndroid Tablet وiPhone وiPad.

## Android

```bash
npm install
npm run android:debug
```

الناتج التجريبي: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Google Play

```bash
npm run android:bundle
```

يجب إضافة مفتاح التوقيع خارج المستودع قبل إنتاج AAB نهائي للمتجر.

## iPhone وiPad

```bash
npm install
npm run ios:sync
npm run ios:open
```

افتحي المشروع في Xcode على جهاز Mac، ثم اختاري Team الخاص بحساب Apple Developer وأنشئي Archive. مشروع iOS مضبوط لدعم iPhone وiPad معًا.

