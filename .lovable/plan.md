# اتصال دامنه atrmoon.top به پروژه Lovable

## هدل
اتصال دامنه atrmoon.top به پروژه Lovable، با حفظ backend فعلی (Supabase) و تنظیمات امنیتی.

---

## مراحل اجرا

### ۱. تنظیم DNS در ایران‌سرور (یا Cloudflare)
دو رکورد باید اضافه شود:
```
A     atrmoon.top          →   Lovable IP
CNAME www.atrmoon.top      →   atrmoon.top
```
اگر پنل ایران‌سرور رکورد A مستقیم نمی‌گیره، Nameserverها رو می‌بریم روی Cloudflare (رایگان) و DNS رو اونجا مدیریت می‌کنیم.

### ۲. اضافه کردن دامنه در Lovable
در تنظیمات پروژه:
```
Publish → Settings → Custom Domain → Add atrmoon.top
```
Lovable دو رکورد DNS ارائه می‌ده:
- IP address برای رکورد A
- Target برای رکورد CNAME (www)

### ۳. صبر برای تأیید DNS و SSL
بعد از ثبت رکوردها، Lovable به‌طور خودکار:
- DNS رو verify می‌کنه
- SSL certificate (HTTPS) صادر می‌کنه
- دامنه رو فعال می‌کنه

این مرحله می‌تونه از ۵ دقیقه تا چند ساعت طول بکشه.

### ۴. تنظیمات نهایی
- بررسی: atrmoon.top و www.atrmoon.top هر دو باید به سایت redirect بشن
- اگر "Edit with Lovable" badge رو می‌خوای مخفی کنی، این تنظیم رو update کن

---

## پیش‌نیازها از سمت شما
- **دسترسی به پنل مدیریت دامنه ایران‌سرور**
- **تصمیم در مورد www**: redirect to non-www یا برعکس (پیشنهاد: non-www اصلی، www redirect)
- **استفاده از Cloudflare به‌عنوان DNS proxy** (اختیاری اما پیشنهاد میشه برای SSL راحت‌تر)

---

## وضعیت backend
بدون تغییر. Supabase همچنان به‌صورت مستقل کار می‌کنه و URL های API فعلی:
- `https://gxoignprlnlwindigjkx.supabase.co`
- در آینده اگر خواستی می‌تونی custom domain (api.atrmoon.top) رو با پلن paid Supabase بگیری

## وضعیت ایمیل
برای اینکه ایمیل‌های سایت (مثل سفارشات) از atrmoon.top ارسال بشن، باید تنظیمات email domain رو انجام بدیم. می‌تونیم بعد از اتصال دامنه این کار رو انجام بدیم.
