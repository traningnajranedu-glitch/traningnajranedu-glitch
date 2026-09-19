"use client";

import {useEffect, useState} from "react";
import {supabase} from "@/lib/supabase/client";

type Tab="overview"|"trainees"|"questions"|"exams"|"results";
type Trainee={id:string;civil_id:string;full_name:string;mobile:string|null;active:boolean};

const emptyForm={civil_id:"",full_name:"",mobile:""};

export default function Home(){
 const [session,setSession]=useState(false);
 const [loading,setLoading]=useState(true);
 const [authLoading,setAuthLoading]=useState(false);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [authError,setAuthError]=useState("");
 const [tab,setTab]=useState<Tab>("overview");
 const [civil,setCivil]=useState("");
 const [verified,setVerified]=useState<string|null>(null);
 const [trainees,setTrainees]=useState<Trainee[]>([]);
 const [search,setSearch]=useState("");
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<Trainee|null>(null);
 const [form,setForm]=useState(emptyForm);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");

 const loadTrainees=async()=>{
   setError("");
   const {data,error}=await supabase.from("trainees").select("id,civil_id,full_name,mobile,active").order("full_name");
   if(error){setError(error.message);return}
   setTrainees((data||[]) as Trainee[]);
 };

 useEffect(()=>{
   let mounted=true;
   supabase.auth.getSession().then(async ({data})=>{
     if(!mounted)return;
     const logged=!!data.session;
     setSession(logged);
     if(logged)await loadTrainees();
     setLoading(false);
   });
   const {data:{subscription}}=supabase.auth.onAuthStateChange(async (_event,newSession)=>{
     setSession(!!newSession);
     if(newSession)await loadTrainees();
     else setTrainees([]);
   });
   return()=>{mounted=false;subscription.unsubscribe()};
 },[]);

 const login=async()=>{
   setAuthError("");setAuthLoading(true);
   const {error}=await supabase.auth.signInWithPassword({email,password});
   if(error)setAuthError("بيانات الدخول غير صحيحة أو الحساب غير مصرح له كمدير.");
   setAuthLoading(false);
 };

 const logout=async()=>{await supabase.auth.signOut();setSession(false)};

 const saveTrainee=async()=>{
   setError("");setMessage("");
   if(!/^\d{10}$/.test(form.civil_id)){setError("السجل المدني يجب أن يتكون من 10 أرقام.");return}
   if(!form.full_name.trim()){setError("اسم المتدرب مطلوب.");return}
   setSaving(true);
   const payload={civil_id:form.civil_id,full_name:form.full_name.trim(),mobile:form.mobile.trim()||null};
   const result=editing
     ? await supabase.from("trainees").update(payload).eq("id",editing.id)
     : await supabase.from("trainees").insert(payload);
   if(result.error){setError(result.error.message);setSaving(false);return}
   await loadTrainees();setSaving(false);setOpen(false);setEditing(null);setForm(emptyForm);setMessage(editing?"تم تحديث بيانات المتدرب.":"تم حفظ المتدرب في قاعدة البيانات.");
 };

 const removeTrainee=async(id:string)=>{
   if(!confirm("هل تريد حذف هذا المتدرب؟"))return;
   const {error}=await supabase.from("trainees").delete().eq("id",id);
   if(error){setError(error.message);return}
   await loadTrainees();setMessage("تم حذف المتدرب.");
 };

 const toggleActive=async(t:Trainee)=>{
   const {error}=await supabase.from("trainees").update({active:!t.active}).eq("id",t.id);
   if(error){setError(error.message);return}
   await loadTrainees();
 };

 const verifyCivil=async()=>{
   setVerified(null);setError("");
   if(!/^\d{10}$/.test(civil)){setError("أدخل رقم سجل مدني مكونًا من 10 أرقام.");return}
   const {data,error}=await supabase.from("trainees").select("full_name,active").eq("civil_id",civil).maybeSingle();
   if(error){setError(error.message);return}
   if(!data){setVerified("not_found");return}
   setVerified(data.active?"active":"inactive");
 };

 const openAdd=()=>{setEditing(null);setForm(emptyForm);setError("");setOpen(true)};
 const openEdit=(t:Trainee)=>{setEditing(t);setForm({civil_id:t.civil_id,full_name:t.full_name,mobile:t.mobile||""});setError("");setOpen(true)};

 const filtered=trainees.filter(t=>(t.full_name+" "+t.civil_id).includes(search.trim()));

 if(loading)return <main className="authScreen"><div className="authBox"><h2>منصة اختبار المتدربين</h2><p>جاري الاتصال بقاعدة البيانات...</p></div></main>;

 if(!session)return <main className="authScreen" dir="rtl"><div className="authBox"><div className="shield">أ</div><h1>منصة اختبار المتدربين</h1><p>الأمن العام · دخول مدير النظام</p><label>البريد الإلكتروني<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label><label>كلمة المرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>{authError&&<div className="error">{authError}</div>}<button className="primary full" onClick={login} disabled={authLoading}>{authLoading?"جاري الدخول...":"دخول"}</button><small>يجب أن يكون الحساب موجودًا في Supabase Auth ومضافًا إلى ملف مدير النظام.</small></div></main>;

 const nav=[["overview","نظرة عامة","⌂"],["trainees","المتدربون","♙"],["questions","بنك الأسئلة","▤"],["exams","الاختبارات","✓"],["results","النتائج والتقارير","▥"]] as const;

 return <main dir="rtl"><header className="top"><div className="brand"><div className="shield">أ</div><div><h1>منصة اختبار المتدربين</h1><span>الأمن العام</span></div></div><div className="user">مدير النظام <button className="logout" onClick={logout}>خروج</button></div></header>
 <div className="shell"><aside><div className="sideTitle">لوحة التحكم</div>{nav.map(([id,label,icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><i>{icon}</i>{label}</button>)}<div className="sideBottom"><small>نظام اختبار المتدربين</small><strong>الإصدار 1.0</strong></div></aside>
 <section className="content">
 {error&&<div className="error pageError">{error}</div>}{message&&<div className="success">{message}</div>}
 {tab==="overview"&&<><div className="welcome"><div><p>مرحبًا بك في لوحة إدارة الاختبارات</p><h2>منصة اختبار المتدربين – الأمن العام</h2><span>إدارة المتدربين والاختبارات والنتائج من مكان واحد.</span></div><button onClick={()=>setTab("exams")} className="primary">+ إنشاء اختبار</button></div>
 <div className="cards">{[["المتدربون",String(trainees.length),"👥"],["بنوك الأسئلة","0","▤"],["الاختبارات المنشورة","0","✓"],["محاولات الاختبار","0","◷"]].map(c=><div className="card" key={c[0]}><div className="icon">{c[2]}</div><div><small>{c[0]}</small><strong>{c[1]}</strong></div></div>)}</div>
 <div className="grid2"><div className="panel"><div className="panelHead"><h3>التحقق من السجل المدني</h3><span>قاعدة البيانات</span></div><p>تحقق من رقم السجل المدني من بيانات المتدربين المسجلة في Supabase.</p><div className="verify"><input inputMode="numeric" maxLength={10} value={civil} onChange={e=>{setCivil(e.target.value.replace(/\D/g,""));setVerified(null)}} placeholder="أدخل رقم السجل المدني"/><button onClick={verifyCivil}>تحقق</button></div>{verified==="active"&&<div className="success">✓ المتدرب موجود وحسابه نشط.</div>}{verified==="inactive"&&<div className="hint">المتدرب موجود لكن حسابه غير نشط.</div>}{verified==="not_found"&&<div className="hint">لا يوجد متدرب بهذا السجل المدني.</div>}</div>
 <div className="panel"><div className="panelHead"><h3>حالة الاتصال</h3><span>Supabase</span></div><ul><li>إدارة المتدربين مرتبطة بقاعدة البيانات</li><li>القراءة والإضافة والتعديل والحذف عبر RLS</li><li>التحقق بالسجل المدني يتم من قاعدة البيانات</li><li>دخول المدير عبر Supabase Auth</li></ul></div></div></>}
 {tab==="trainees"&&<div><div className="sectionHead"><h2>إدارة المتدربين</h2><button className="primary" onClick={openAdd}>+ إضافة متدرب</button></div><div className="panel"><div className="tableHead"><b>المتدربون ({filtered.length})</b><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث بالاسم أو السجل المدني"/></div>{filtered.length===0?<div className="empty">لا توجد بيانات مطابقة.</div>:<div className="trainees">{filtered.map(t=><div className="rowItem" key={t.id}><span><b>{t.full_name}</b><small>{t.civil_id} · {t.mobile||"بدون جوال"}</small></span><div className="rowActions"><em>{t.active?"نشط":"غير نشط"}</em><button onClick={()=>toggleActive(t)}>{t.active?"تعطيل":"تفعيل"}</button><button onClick={()=>openEdit(t)}>تعديل</button><button className="danger" onClick={()=>removeTrainee(t.id)}>حذف</button></div></div>)}</div>}</div></div>}
 {tab==="questions"&&<Section title="بنك الأسئلة" action="+ إضافة سؤال"><div className="empty">الخطوة التالية: الفئات، بنوك الأسئلة، الأسئلة والخيارات والاعتماد.</div></Section>}
 {tab==="exams"&&<Section title="إدارة الاختبارات" action="+ إنشاء اختبار"><div className="empty">الخطوة التالية: ربط الاختبار ببنك الأسئلة ثم النشر.</div></Section>}
 {tab==="results"&&<Section title="النتائج والتقارير"><div className="empty">ستظهر هنا النتائج والدرجات والتقارير بعد تشغيل الاختبارات.</div></Section>}
 </section></div>
 {open&&<div className="modal"><div className="modalBox"><button className="close" onClick={()=>setOpen(false)}>×</button><h2>{editing?"تعديل متدرب":"إضافة متدرب"}</h2><label>السجل المدني<input inputMode="numeric" maxLength={10} value={form.civil_id} onChange={e=>setForm({...form,civil_id:e.target.value.replace(/\D/g,"")})} placeholder="10 أرقام"/></label><label>اسم المتدرب<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="الاسم الكامل"/></label><label>رقم الجوال<input inputMode="tel" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="اختياري"/></label><button className="primary full" onClick={saveTrainee} disabled={saving}>{saving?"جاري الحفظ...":editing?"حفظ التعديلات":"حفظ المتدرب"}</button></div></div>}</main>
}

function Section({title,action,children}:{title:string,action?:string,children:React.ReactNode}){return <div><div className="sectionHead"><h2>{title}</h2>{action&&<button className="primary">{action}</button>}</div><div className="panel">{children}</div></div>}
