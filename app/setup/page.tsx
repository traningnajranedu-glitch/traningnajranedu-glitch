"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function SetupAdmin() {
  const [email, setEmail] = useState("admin@ai.com");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("مدير النظام");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const completeProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus("لا توجد جلسة دخول. أنشئ الحساب أو سجّل الدخول أولاً.");
      return;
    }
    const { error } = await supabase.from("admin_profiles").insert({
      user_id: user.id,
      full_name: fullName.trim() || "مدير النظام",
      role: "super_admin",
    });
    setStatus(error ? error.message : "تم إنشاء ملف مدير النظام بنجاح. يمكنك الآن الدخول إلى المنصة.");
  };

  const createAdmin = async () => {
    setStatus("");
    if (!email.trim() || password.length < 8) {
      setStatus("أدخل البريد وكلمة مرور لا تقل عن 8 أحرف.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      setStatus(error.message);
    } else if (data.session) {
      await completeProfile();
    } else {
      setStatus("تم إنشاء حساب Auth. إذا كان تأكيد البريد مفعلاً، أكد البريد ثم عد إلى هذه الصفحة لإكمال ملف المدير.");
    }
    setBusy(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("توجد جلسة دخول. اضغط «إكمال ملف المدير».");
    });
  }, []);

  return (
    <main dir="rtl" style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f4f7fb",padding:24}}>
      <section style={{width:"100%",maxWidth:520,background:"#fff",padding:32,borderRadius:20,boxShadow:"0 12px 40px rgba(0,0,0,.08)"}}>
        <h1>إعداد مدير النظام</h1>
        <p>منصة اختبار المتدربين – الأمن العام</p>
        <label>الاسم الكامل<input value={fullName} onChange={e=>setFullName(e.target.value)} /></label>
        <label>البريد الإلكتروني<input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>كلمة المرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 أحرف على الأقل" /></label>
        {status && <div style={{margin:"16px 0",padding:12,borderRadius:10,background:"#eef6ff"}}>{status}</div>}
        <button className="primary full" onClick={createAdmin} disabled={busy}>{busy ? "جاري الإنشاء..." : "إنشاء المدير الأول"}</button>
        <button className="full" style={{marginTop:10}} onClick={completeProfile}>إكمال ملف المدير للجلسة الحالية</button>
      </section>
    </main>
  );
}
