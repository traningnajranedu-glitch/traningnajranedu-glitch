"use client";
import {useEffect,useState} from "react";

type Choice={id:string;question_id:string;choice_text:string};
type Question={id:string;question_text:string;question_type:string;points:number;choices:Choice[]};
export default function ExamPage(){
 const [civil,setCivil]=useState(""),[trainee,setTrainee]=useState<any>(null),[exams,setExams]=useState<any[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[selected,setSelected]=useState<any>(null),[attempt,setAttempt]=useState<any>(null),[questions,setQuestions]=useState<Question[]>([]),[answers,setAnswers]=useState<Record<string,string>>({}),[seconds,setSeconds]=useState(0),[result,setResult]=useState<any>(null),[submitting,setSubmitting]=useState(false);
 const verify=async()=>{setError("");setLoading(true);try{const r=await fetch("/api/exam",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"verify",civil_id:civil})});const d=await r.json();if(!r.ok)throw new Error(d.error);setTrainee(d.trainee);setExams(d.exams||[]);}catch(e:any){setError(e.message)}finally{setLoading(false)}};
 const start=async(ex:any)=>{setError("");setLoading(true);try{const r=await fetch("/api/exam",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start",civil_id:civil,exam_id:ex.id})});const d=await r.json();if(!r.ok)throw new Error(d.error);setSelected(d.exam);setAttempt(d.attempt);setQuestions(d.questions);setSeconds(Math.max(0,Math.floor((new Date(d.attempt.expires_at).getTime()-Date.now())/1000)));setAnswers({});}catch(e:any){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{if(!attempt||result)return;const t=setInterval(()=>{const left=Math.max(0,Math.floor((new Date(attempt.expires_at).getTime()-Date.now())/1000));setSeconds(left);if(left===0){clearInterval(t);submit(true)}},1000);return()=>clearInterval(t)},[attempt,result]);
 const submit=async(auto=false)=>{if(submitting)return;setSubmitting(true);setError("");try{const r=await fetch("/api/exam",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",attempt_id:attempt.id,answers:Object.entries(answers).map(([question_id,choice_id])=>({question_id,choice_id}))})});const d=await r.json();if(!r.ok)throw new Error(d.error);setResult(d);setAttempt(null);}catch(e:any){setError(e.message)}finally{setSubmitting(false)}};
 const fmt=(s:number)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
 if(result)return <main className="examScreen"><div className="examCard resultCard"><div className="examLogo">✓</div><h1>نتيجة الاختبار</h1><p>{result.trainee?.full_name}</p><div className="resultScore">{result.percentage}%</div><h2>{result.passed?"اجتاز الاختبار":"لم يجتز الاختبار"}</h2><p>الدرجة: {result.score} من {result.total} · درجة النجاح: {result.pass_score}%</p><button className="primary" onClick={()=>{setResult(null);setTrainee(null);setExams([]);setCivil("")}}>العودة للتحقق</button></div></main>;
 if(attempt)return <main className="examScreen"><div className="examCard examRun"><div className="examRunHead"><div><h1>{selected.title}</h1><p>{trainee?.full_name} · المحاولة {attempt.attempt_number}</p></div><div className={seconds<60?"timer dangerTimer":"timer"}>⏱ {fmt(seconds)}</div></div>{selected.instructions&&<div className="examInstructions">{selected.instructions}</div>}<div className="runQuestions">{questions.map((q,i)=><div className="runQuestion" key={q.id}><div className="questionNumber">السؤال {i+1} من {questions.length}</div><h2>{q.question_text}</h2><div className="runChoices">{q.choices.map(c=><label key={c.id} className={answers[q.id]===c.id?"runChoice selectedChoice":"runChoice"}><input type="radio" name={q.id} checked={answers[q.id]===c.id} onChange={()=>setAnswers({...answers,[q.id]:c.id})}/><span>{c.choice_text}</span></label>)}</div></div>)}</div><button className="primary full" onClick={()=>{if(confirm("هل أنت متأكد من تسليم الاختبار؟"))submit(false)}} disabled={submitting}>{submitting?"جاري التصحيح...":"تسليم الاختبار"}</button></div></main>;
 return <main className="examScreen nationalDayScreen" dir="rtl">
  <div className="nationalDayGlow nationalDayGlowOne"></div>
  <div className="nationalDayGlow nationalDayGlowTwo"></div>
  <div className="examCard nationalDayCard">
    <div className="nationalDayBanner">
      <div className="nationalDayPattern"></div>
      <div className="nationalDayBadge"><span>96</span><small>اليوم الوطني</small></div>
      <div className="nationalDayBannerText">
        <strong>اليوم الوطني السعودي 96</strong>
        <span>عزّنا بطبعنا</span>
      </div>
    </div>
    <div className="examLogo nationalExamLogo"><span>اختبار</span><b>🇸🇦</b></div>
    <div className="nationalDayTitle">
      <span className="eyebrow">منصة الاختبارات الإلكترونية</span>
      <h1>منصة اختبار المتدربين</h1>
      <p>الأمن العام</p>
    </div>
    <div className="loginWelcome">
      <div className="loginWelcomeIcon">✓</div>
      <div>
        <strong>دخول المتدرب / المختبر</strong>
        <span>أدخل رقم السجل المدني للتحقق من بياناتك والاطلاع على الاختبارات المتاحة.</span>
      </div>
    </div>
    <label className="examLabel nationalExamLabel">السجل المدني
      <input inputMode="numeric" maxLength={10} value={civil} onChange={e=>setCivil(e.target.value.replace(/\D/g,""))} placeholder="أدخل رقم السجل المدني — 10 أرقام"/>
    </label>
    <button className="primary full nationalPrimary" onClick={verify} disabled={loading||civil.length!==10}>
      <span>{loading?"جاري التحقق...":"تحقق وابدأ الاختبار"}</span>
      {!loading&&<span className="buttonArrow">←</span>}
    </button>
    {error&&<div className="error nationalError">{error}</div>}
    <div className="nationalDayValues">
      <span>🇸🇦 اعتزاز بالوطن</span><span>•</span><span>96 عامًا من المجد</span><span>•</span><span>عزّنا بطبعنا</span>
    </div>
    {trainee&&<div className="traineeWelcome nationalTraineeWelcome"><div><b>مرحبًا {trainee.full_name}</b><span>{trainee.civil_id}</span></div><span className="verifiedMark">✓ تم التحقق</span></div>}
    {trainee&&<div className="availableExams nationalAvailableExams"><h2>الاختبارات المتاحة</h2>{exams.length===0?<div className="empty">لا توجد اختبارات منشورة ومتاحة حاليًا.</div>:exams.map(ex=><div className="availableExam" key={ex.id}><div><b>{ex.title}</b><small>{ex.total_questions} سؤال · {ex.duration_minutes} دقيقة · النجاح {ex.pass_score}% · المحاولات {ex.attempts_used}/{ex.max_attempts}</small>{ex.description&&<small>{ex.description}</small>}</div><button className="primary nationalPrimary smallPrimary" onClick={()=>start(ex)} disabled={!ex.can_attempt||loading}>{ex.can_attempt?"بدء الاختبار":"انتهت المحاولات"}</button></div>)}</div>}
    <div className="nationalDayFooter"><span>المملكة العربية السعودية</span><span className="footerTree">✦</span><span>التعلم والإنجاز</span></div>
  </div>
</main>;
}