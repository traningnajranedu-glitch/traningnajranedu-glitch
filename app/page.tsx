"use client";
import {useState} from "react";

type Tab="overview"|"trainees"|"questions"|"exams"|"results";
type Trainee={id:number;civil:string;name:string;mobile:string;active:boolean};
const initial:Trainee[]=[];
export default function Home(){
 const [tab,setTab]=useState<Tab>("overview");
 const [civil,setCivil]=useState(""); const [verified,setVerified]=useState(false);
 const [trainees,setTrainees]=useState(initial); const [open,setOpen]=useState(false);
 const [form,setForm]=useState({civil:"",name:"",mobile:""});
 const add=()=>{if(/^\d{10}$/.test(form.civil)&&form.name.trim()){setTrainees([...trainees,{id:Date.now(),civil:form.civil,name:form.name,mobile:form.mobile,active:true}]);setForm({civil:"",name:"",mobile:""});setOpen(false)}};
 const nav=[["overview","نظرة عامة","⌂"],["trainees","المتدربون","♙"],["questions","بنك الأسئلة","▤"],["exams","الاختبارات","✓"],["results","النتائج والتقارير","▥"]] as const;
 return <main><header className="top"><div className="brand"><div className="shield">أ</div><div><h1>منصة اختبار المتدربين</h1><span>الأمن العام</span></div></div><div className="user">مدير النظام <b>⌄</b></div></header>
 <div className="shell"><aside><div className="sideTitle">لوحة التحكم</div>{nav.map(([id,label,icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><i>{icon}</i>{label}</button>)}<div className="sideBottom"><small>نظام اختبار المتدربين</small><strong>الإصدار 1.0</strong></div></aside>
 <section className="content">
 {tab==="overview"&&<><div className="welcome"><div><p>مرحبًا بك في لوحة إدارة الاختبارات</p><h2>منصة اختبار المتدربين – الأمن العام</h2><span>إدارة المتدربين والاختبارات والنتائج من مكان واحد.</span></div><button onClick={()=>setTab("exams")} className="primary">+ إنشاء اختبار</button></div>
 <div className="cards">{[["المتدربون",String(trainees.length),"👥"],["بنوك الأسئلة","0","▤"],["الاختبارات المنشورة","0","✓"],["محاولات الاختبار","0","◷"]].map(c=><div className="card" key={c[0]}><div className="icon">{c[2]}</div><div><small>{c[0]}</small><strong>{c[1]}</strong></div></div>)}</div>
 <div className="grid2"><div className="panel"><div className="panelHead"><h3>التحقق من السجل المدني</h3><span>أمان</span></div><p>تحقق من رقم السجل المدني المكون من 10 أرقام قبل بدء الاختبار.</p><div className="verify"><input inputMode="numeric" maxLength={10} value={civil} onChange={e=>{setCivil(e.target.value.replace(/\D/g,""));setVerified(false)}} placeholder="أدخل رقم السجل المدني"/><button onClick={()=>setVerified(/^\d{10}$/.test(civil))}>تحقق</button></div>{verified&&<div className="success">✓ تم التحقق من صحة صيغة الرقم.</div>}{civil.length===10&&!verified&&<div className="hint">اضغط تحقق لإكمال العملية.</div>}</div>
 <div className="panel"><div className="panelHead"><h3>مكونات المنصة</h3><span>جاهز</span></div><ul><li>مولد أسئلة بالذكاء الاصطناعي مع مراجعة واعتماد</li><li>ترتيب عشوائي للأسئلة والاختيارات</li><li>مؤقت ومحاولات محددة وتصحيح آلي</li><li>نتائج وتقارير وشهادة/نتيجة للمتدرب</li></ul></div></div></>}
 {tab==="trainees"&&<div><div className="sectionHead"><h2>إدارة المتدربين</h2><button className="primary" onClick={()=>setOpen(true)}>+ إضافة متدرب</button></div><div className="panel"><div className="tableHead"><b>المتدربون ({trainees.length})</b><input placeholder="بحث بالاسم أو السجل المدني"/></div>{trainees.length===0?<div className="empty">لا توجد بيانات متدربين حاليًا. أضف أول متدرب للبدء.</div>:<div className="trainees">{trainees.map(t=><div className="rowItem" key={t.id}><span><b>{t.name}</b><small>{t.civil} · {t.mobile||"بدون جوال"}</small></span><em>{t.active?"نشط":"غير نشط"}</em></div>)}</div>}</div></div>}
 {tab==="questions"&&<Section title="بنك الأسئلة" action="+ إضافة سؤال"><div className="empty">الخطوة التالية: الفئات، بنوك الأسئلة، الأسئلة والخيارات والاعتماد.</div></Section>}
 {tab==="exams"&&<Section title="إدارة الاختبارات" action="+ إنشاء اختبار"><div className="empty">الخطوة التالية: ربط الاختبار ببنك الأسئلة ثم النشر.</div></Section>}
 {tab==="results"&&<Section title="النتائج والتقارير"><div className="empty">ستظهر هنا النتائج والدرجات والتقارير بعد تشغيل الاختبارات.</div></Section>}
 </section></div>
 {open&&<div className="modal"><div className="modalBox"><button className="close" onClick={()=>setOpen(false)}>×</button><h2>إضافة متدرب</h2><label>السجل المدني<input inputMode="numeric" maxLength={10} value={form.civil} onChange={e=>setForm({...form,civil:e.target.value.replace(/\D/g,"")})} placeholder="10 أرقام"/></label><label>اسم المتدرب<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="الاسم الكامل"/></label><label>رقم الجوال<input inputMode="tel" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="اختياري"/></label><button className="primary full" onClick={add}>حفظ المتدرب</button></div></div>}</main>
}
function Section({title,action,children}:{title:string,action?:string,children:React.ReactNode}){return <div><div className="sectionHead"><h2>{title}</h2>{action&&<button className="primary">{action}</button>}</div><div className="panel">{children}</div></div>}
