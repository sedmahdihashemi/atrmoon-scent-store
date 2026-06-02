## هدف
نسخه فعلی Lovable که در preview می‌بینی باید به GitHub منتقل شود تا لوکال هم بتواند با `git pull` همان نسخه را بگیرد.

## برنامه پیشنهادی

1. **بررسی وضعیت اتصال GitHub در Lovable**
   - از منوی GitHub داخل Lovable مطمئن می‌شویم پروژه به repo درست وصل است.
   - اگر پیام خطا یا حالت disconnected هنوز وجود دارد، اتصال را دوباره authorize می‌کنی.

2. **Trigger کردن sync از Lovable به GitHub**
   - یک تغییر خیلی کوچک و بی‌خطر در پروژه انجام می‌دهیم تا Lovable مجبور شود commit جدید بسازد.
   - بعد از آن چند دقیقه صبر می‌کنی و GitHub را refresh می‌کنی.

3. **بررسی اینکه GitHub واقعاً به‌روز شده**
   - آخرین commit در GitHub باید بعد از reconnect ساخته شده باشد.
   - اگر commit جدید نیامد، احتمالاً sync هنوز خطا دارد و باید پیام خطای GitHub integration را ببینیم.

4. **همگام‌سازی لوکال با GitHub**
   - وقتی GitHub به‌روز شد، روی لوکال اجرا می‌کنی:

```bash
git pull
bun install
bun dev
```

5. **اگر GitHub همچنان عقب ماند**
   - راه جایگزین سریع: از Code Editor داخل Lovable گزینه **Download codebase** را بگیر و لوکال را با آن جایگزین کن.
   - راه تمیزتر: مشکل GitHub integration را از داخل Lovable resolve کنیم و بعد sync اتوماتیک را دوباره راه بیندازیم.

## نیاز از تو
بعد از اجرای مرحله trigger، اگر هنوز GitHub عقب بود، اسکرین‌شات یا متن اروری که در بخش GitHub integration می‌بینی را بفرست تا دقیق‌تر بگم مشکل از authorization، repo access یا conflict sync است.