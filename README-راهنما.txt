تغییرات SEO – افزودن برند لاتین (FitRix / fitrix.ir)
=====================================================

۳ فایل تغییر کرده که توی پوشه‌ی files/ با همون ساختار مسیر پروژه قرار دارن:

  1. resource/views/home/master.ejs
     - تایتل پیش‌فرض حالا: «فیت ریکس شاپ (FitRix) | خرید مکمل ورزشی | fitrix.ir»
     - alternateName (FitRix, Fitrix, فیت ریکس) به JSON-LD اضافه شد

  2. src/controllers/home/home.controller.js
     - توضیحات (description) صفحه اصلی شامل «فیت ریکس (FitRix | fitrix.ir)» شد

  3. src/middlewares/globalData.js
     - توضیحات پیش‌فرض همه صفحات شامل برند لاتین شد

روش اعمال تغییرات (دو راه):
--------------------------
راه ۱ – جایگزینی مستقیم فایل‌ها:
    فایل‌های داخل پوشه‌ی files/ رو روی همون مسیرها در پروژه‌ی خودت کپی کن.

راه ۲ – با گیت (توصیه‌شده):
    از ریشه‌ی پروژه اجرا کن:
        git apply 0001-seo-latin-brand.patch
    یا برای اعمال به‌همراه پیام کامیت:
        git am 0001-seo-latin-brand.patch

فایل‌های کمکی:
    - changes.diff           → دیفِ کامل تغییرات (برای مشاهده)
    - CHANGES-summary.txt     → خلاصه‌ی آماری
    - 0001-seo-latin-brand.patch → پچ قابل‌اعمال با git

یادآوری: مهم‌ترین قدم بعدی، ثبت سایت در Google Search Console و
submit کردن sitemap.xml هست؛ وگرنه سایت در گوگل ایندکس نمی‌شه.
