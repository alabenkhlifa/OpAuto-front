---
name: daily-briefing
description: Use when the user asks for a morning summary, daily snapshot, end-of-day report, or 'what happened today/yesterday'. Compiles revenue, customer activity, active jobs, overdue invoices, and at-risk customers into a structured 5-section briefing.
triggers: [morning, daily, briefing, summary, snapshot]
tools: [get_dashboard_kpis, get_revenue_summary, get_customer_count, list_active_jobs, get_invoices_summary, list_overdue_invoices, list_at_risk_customers, list_low_stock_parts]
---

أنت تُعدّ ملخصًا يوميًا موجزًا لصاحب المرآب. اجعل الأسلوب مطابقًا للغة المستخدم. أسماء الأدوات تبقى بالإنجليزية لأنها معرّفات تقنية.

## جمع البيانات (تسلسليًا ثم التجميع)

1. استدعِ `get_revenue_summary({"period":"today"})` ثم `get_revenue_summary({"period":"week"})`. احسب نسبة الفارق بين إيرادات اليوم ومتوسط الأيام السبعة.
2. استدعِ `get_customer_count` مع `newSince` مضبوطًا على تاريخ الأمس بصيغة ISO-8601 (الساعة 00:00 محليًا) لمعرفة العملاء الجدد خلال 24 ساعة.
3. استدعِ `list_active_jobs` (بدون وسائط) للأعمال الجارية.
4. استدعِ `list_overdue_invoices` لعدد الفواتير المتأخرة وإجماليها.
5. استدعِ `list_at_risk_customers({"limit":5})` لأبرز خمسة عملاء معرّضين للانسحاب.
6. استدعِ `list_low_stock_parts` لتنبيهات المخزون.

إذا فشلت أداة، أشِر إلى ذلك بإيجاز في القسم المعني وتابع — لا تتخلَّ عن الملخص.

## صيغة الإخراج

أنتج خمسة أقسام قصيرة بالضبط، كل منها بسطرين أو ثلاثة كحد أقصى، بالترتيب التالي:

1. **الإيرادات** — مجموع اليوم، مجموع الأسبوع، والفارق مقابل متوسط 7 أيام.
2. **العملاء** — العملاء الجدد خلال 24 ساعة، مع سطر يصف النشاط.
3. **الأعمال** — عدد الأعمال النشطة، وأقدم عمل لا يزال مفتوحًا إن كان ذا أهمية.
4. **الفواتير غير المسددة** — عدد الفواتير المتأخرة والمبلغ الإجمالي.
5. **المخاطر والمخزون** — عدد العملاء المعرّضين للانسحاب (مع ذكر أبرز 1-2) وقطع الغيار شحيحة المخزون.

اختم بسطر واحد: `الإجراء الموصى به:` يليه اقتراح ملموس واحد — ويُفضَّل أن يُحيل إلى أداة أو عميل أو فاتورة يجب التعامل معها أولًا.

أبقِ الملخص الكامل تحت 200 كلمة. لا تحيات ولا عبارات ختامية.
