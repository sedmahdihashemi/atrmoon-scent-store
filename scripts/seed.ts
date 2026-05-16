import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function ensureUser(email: string, password: string, full_name: string, role: "super_admin" | "seller", phone?: string) {
  // try fetch existing
  const list = await admin.auth.admin.listUsers({ perPage: 200 });
  let user = list.data.users.find((u) => u.email === email);
  if (!user) {
    const r = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, role: "customer", phone }, // never trust super_admin via meta
    });
    if (r.error) throw r.error;
    user = r.data.user!;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  }
  // ensure profile
  await admin.from("profiles").upsert({ id: user.id, full_name, email, phone, status: "active" });
  // wipe roles and set the intended one
  await admin.from("user_roles").delete().eq("user_id", user.id);
  await admin.from("user_roles").insert({ user_id: user.id, role });
  return user;
}

async function main() {
  console.log("Creating super admin...");
  const admin1 = await ensureUser("admin@atrmoon.test", "Atrmoon@2026!", "علی مدیر", "super_admin", "09120000001");
  console.log("admin id:", admin1.id);

  console.log("Creating seller...");
  const seller = await ensureUser("seller@atrmoon.test", "Seller@2026!", "نسترن دفترِ مون", "seller", "09120000002");
  console.log("seller id:", seller.id);

  // Store
  const storeName = "دفترِ مون";
  const storeSlug = "daftar-e-moon";
  const existingStore = await admin.from("stores").select("id").eq("seller_id", seller.id).maybeSingle();
  let storeId: string;
  if (existingStore.data) {
    storeId = existingStore.data.id;
    await admin.from("stores").update({
      store_name: storeName, slug: storeSlug, status: "approved",
      description: "دفترِ کوچک رایحه‌هایی که شب‌ها روایت می‌شوند. عطرفروشی شخصیِ نسترن، در گوشه‌ای ساکت از تهران.",
      city: "تهران", address: "تهران، خیابان نوفل‌لوشاتو، پلاک ۱۲", support_email: "seller@atrmoon.test",
      support_phone: "02100000000", whatsapp_number: "989120000002", instagram_url: "https://instagram.com/daftaremoon",
    }).eq("id", storeId);
  } else {
    const ins = await admin.from("stores").insert({
      seller_id: seller.id, store_name: storeName, slug: storeSlug, status: "approved",
      description: "دفترِ کوچک رایحه‌هایی که شب‌ها روایت می‌شوند. عطرفروشی شخصیِ نسترن، در گوشه‌ای ساکت از تهران.",
      city: "تهران", address: "تهران، خیابان نوفل‌لوشاتو، پلاک ۱۲", support_email: "seller@atrmoon.test",
      support_phone: "02100000000", whatsapp_number: "989120000002", instagram_url: "https://instagram.com/daftaremoon",
    }).select("id").single();
    if (ins.error) throw ins.error;
    storeId = ins.data.id;
  }
  console.log("store id:", storeId);

  // Brands
  const brandList = [
    { name: "تام فورد", slug: "tom-ford" },
    { name: "دیور", slug: "dior" },
    { name: "شنل", slug: "chanel" },
    { name: "موسم", slug: "mosem" },
    { name: "مَهتاب", slug: "mahtab" },
  ];
  for (const b of brandList) await admin.from("brands").upsert(b, { onConflict: "slug" });
  const { data: brands } = await admin.from("brands").select("id, slug");
  const brandBy = (slug: string) => brands!.find((x) => x.slug === slug)!.id;

  // Categories
  const cats = [
    { name: "نیچ", slug: "niche" },
    { name: "اورینتال", slug: "oriental" },
    { name: "گلی", slug: "floral" },
    { name: "چوبی", slug: "woody" },
  ];
  for (const c of cats) await admin.from("categories").upsert(c, { onConflict: "slug" });

  // Bottle types
  const bottles = [
    { name: "دکانتِ شیشه‌ای", volume_ml: 10 },
    { name: "بطری اصلی", volume_ml: 50 },
    { name: "بطری اصلی بزرگ", volume_ml: 100 },
    { name: "سمپل", volume_ml: 5 },
  ];
  for (const b of bottles) {
    const exists = await admin.from("bottle_types").select("id").eq("name", b.name).eq("volume_ml", b.volume_ml).maybeSingle();
    if (!exists.data) await admin.from("bottle_types").insert(b);
  }
  const { data: bts } = await admin.from("bottle_types").select("id, name, volume_ml");
  const bottleBy = (name: string, ml: number) => bts!.find((x) => x.name === name && x.volume_ml === ml)!.id;

  // Scent notes
  const notes = [
    { name: "برگاموت", type: "top" }, { name: "لیمو", type: "top" }, { name: "هل", type: "top" },
    { name: "گل رز", type: "middle" }, { name: "یاسمن", type: "middle" }, { name: "نرگس", type: "middle" }, { name: "زعفران", type: "middle" },
    { name: "عود", type: "base" }, { name: "صندل", type: "base" }, { name: "وانیل", type: "base" }, { name: "مشک", type: "base" }, { name: "کهربا", type: "base" },
  ];
  for (const n of notes) {
    const e = await admin.from("scent_notes").select("id").eq("name", n.name).maybeSingle();
    if (!e.data) await admin.from("scent_notes").insert(n);
  }
  const { data: sn } = await admin.from("scent_notes").select("id, name");
  const noteBy = (name: string) => sn!.find((x) => x.name === name)!.id;

  // Products
  const products = [
    { slug: "shab-e-yalda", name: "شبِ یلدا", brand: "mahtab", gender: "unisex", conc: "edp",
      desc: "گرما و شیرینیِ آرام؛ هل و زعفران، رزِ سرخ، و کهربایی که در پایان می‌ماند.",
      notes_top: ["هل", "برگاموت"], notes_mid: ["زعفران", "گل رز"], notes_base: ["کهربا", "وانیل"] },
    { slug: "khaab-e-naqre", name: "خوابِ نقره", brand: "mosem", gender: "female", conc: "parfum",
      desc: "نُتی نقره‌ای از یاسمن و نرگس، روی پایه‌ای از مشک سپید.",
      notes_top: ["لیمو", "برگاموت"], notes_mid: ["یاسمن", "نرگس"], notes_base: ["مشک", "صندل"] },
    { slug: "moon-oud", name: "عودِ ماه", brand: "tom-ford", gender: "male", conc: "extrait",
      desc: "عودی پیچیده و عمیق، با لمسی از زعفران و چوبِ صندل.",
      notes_top: ["زعفران"], notes_mid: ["گل رز"], notes_base: ["عود", "صندل", "کهربا"] },
    { slug: "naghme-rose", name: "نغمهٔ رز", brand: "dior", gender: "female", conc: "edp",
      desc: "رزی تازه و باغی، با درخششی از برگاموت.",
      notes_top: ["برگاموت", "لیمو"], notes_mid: ["گل رز", "یاسمن"], notes_base: ["مشک"] },
    { slug: "shab-aroom", name: "شب آرام", brand: "chanel", gender: "unisex", conc: "edt",
      desc: "شبی پاییزی، خنک و آرام؛ برای راه رفتن در کوچه‌های خیس.",
      notes_top: ["برگاموت"], notes_mid: ["یاسمن"], notes_base: ["وانیل", "مشک"] },
    { slug: "atre-pedar", name: "عطرِ پدر", brand: "mosem", gender: "male", conc: "parfum",
      desc: "خاطره‌ی کتِ پدر در کمدِ چوبی. صندل، عود، و کمی توتون.",
      notes_top: ["هل"], notes_mid: ["زعفران"], notes_base: ["صندل", "عود"] },
  ];

  for (const p of products) {
    const ex = await admin.from("products").select("id").eq("slug", p.slug).maybeSingle();
    let pid: string;
    const payload = {
      store_id: storeId, brand_id: brandBy(p.brand), name: p.name, slug: p.slug,
      description: p.desc, gender: p.gender as any, concentration: p.conc as any, status: "active" as const,
    };
    if (ex.data) {
      pid = ex.data.id;
      await admin.from("products").update(payload).eq("id", pid);
    } else {
      const ins = await admin.from("products").insert(payload).select("id").single();
      if (ins.error) throw ins.error;
      pid = ins.data.id;
    }

    // notes
    await admin.from("product_scent_notes").delete().eq("product_id", pid);
    const noteIds = [
      ...p.notes_top.map((n) => ({ product_id: pid, scent_note_id: noteBy(n) })),
      ...p.notes_mid.map((n) => ({ product_id: pid, scent_note_id: noteBy(n) })),
      ...p.notes_base.map((n) => ({ product_id: pid, scent_note_id: noteBy(n) })),
    ];
    if (noteIds.length) await admin.from("product_scent_notes").insert(noteIds);

    // variants
    await admin.from("product_variants").delete().eq("product_id", pid);
    const variants = [
      { product_id: pid, bottle_type_id: bottleBy("سمپل", 5), volume_ml: 5, price: 180000, status: "active" as const },
      { product_id: pid, bottle_type_id: bottleBy("دکانتِ شیشه‌ای", 10), volume_ml: 10, price: 320000, status: "active" as const },
      { product_id: pid, bottle_type_id: bottleBy("بطری اصلی", 50), volume_ml: 50, price: 1450000, status: "active" as const },
      { product_id: pid, bottle_type_id: bottleBy("بطری اصلی بزرگ", 100), volume_ml: 100, price: 2700000, discount_price: 2490000, status: "active" as const },
    ];
    await admin.from("product_variants").insert(variants);

    // inventory
    const inv = await admin.from("product_inventory").select("id").eq("product_id", pid).maybeSingle();
    const stock = 500;
    if (inv.data) {
      await admin.from("product_inventory").update({
        total_stock_ml: stock, available_stock_ml: stock, reserved_stock_ml: 0,
      }).eq("id", inv.data.id);
    } else {
      await admin.from("product_inventory").insert({
        product_id: pid, store_id: storeId, total_stock_ml: stock,
        available_stock_ml: stock, reserved_stock_ml: 0, low_stock_alert_ml: 50,
      });
    }
  }

  console.log("\n✓ Seed complete");
  console.log("\nLogin credentials:");
  console.log("  Super admin:  admin@atrmoon.test   /  Atrmoon@2026!");
  console.log("  Seller:       seller@atrmoon.test  /  Seller@2026!");
}

main().catch((e) => { console.error(e); process.exit(1); });
