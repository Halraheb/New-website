# تحصيلي فيزياء 2 — مدرسة الخويلدية الثانوية

موقع اختبار ومسابقات فيزياء 2 (إعداد الأستاذ حسن الراهب)، مع قاعدة بيانات تسجّل:

- **كل من دخل الموقع** (وقت الدخول، نوع الجهاز، رقم مميز لكل جهاز).
- **بدء كل اختبار** (اسم الطالب أو أسماء الفرق والوحدات المختارة).
- **نتيجة كل طالب** في الاختبار الفردي (الصحيحة، النسبة، المستوى، والنتيجة في كل وحدة).
- **نتائج مسابقات الفرق**.

| الملف | الوظيفة |
|---|---|
| `index.html` | صفحة الاختبار للطلاب |
| `admin.html` | لوحة المعلم: الطلاب، المحاولات، سجل الزيارات، تنزيل Excel |
| `config.js` | رابط قاعدة البيانات ومفتاحها |
| `db.js` | إرسال الزيارات والنتائج لقاعدة البيانات |
| `supabase/schema.sql` | إنشاء الجداول وقواعد الأمان |

## الخطوة 1: نشر الموقع على GitHub Pages

1. في المستودع على GitHub افتح **Settings ← Pages**.
2. في **Source** اختر **Deploy from a branch**، ثم الفرع `main` والمجلد `/ (root)` واضغط **Save**.
3. بعد دقيقة يظهر الرابط: `https://halraheb.github.io/New-website/`
   ولوحة المعلم: `https://halraheb.github.io/New-website/admin.html`

## الخطوة 2: إنشاء قاعدة البيانات (Supabase — مجاني)

1. سجّل في [supabase.com](https://supabase.com) وأنشئ مشروعًا جديدًا (**New project**).
2. افتح **SQL Editor ← New query**، والصق محتوى `supabase/schema.sql` كاملًا واضغط **Run**.
3. أنشئ حساب المعلم: **Authentication ← Users ← Add user ← Create new user** (بريد وكلمة مرور، وفعّل *Auto Confirm User*).
4. في **SQL Editor** شغّل هذا السطر ببريدك نفسه:
   ```sql
   insert into public.teachers (email) values ('بريدك@example.com');
   ```
5. (يُنصح به) **Authentication ← Sign In / Providers**: أوقف *Allow new users to sign up*.
6. من **Project Settings ← API** انسخ **Project URL** و **anon public key** وضعهما في `config.js`:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi..."
   };
   ```
   (يمكن تعديل الملف مباشرة من GitHub بالضغط على أيقونة القلم ثم **Commit changes**.)

## الأمان

- المفتاح `anon` عام بطبيعته ويُوضع في المتصفح.
- قواعد الأمان (RLS) تسمح للزوار **بالإضافة فقط**، ولا يستطيع أحد **قراءة** البيانات إلا المعلم المسجّل بريده في جدول `teachers`.
- يمكنك أيضًا رؤية الجداول مباشرة من **Supabase ← Table Editor** (`visits` و `attempts`).

إذا لم تُضبط `config.js` يعمل الموقع عاديًا وتُحفظ النتائج على جهاز الطالب فقط.
