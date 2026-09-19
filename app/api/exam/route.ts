import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

function adminClient(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);}

export async function POST(request:NextRequest){
  try{
    if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"لم يتم إعداد SUPABASE_SERVICE_ROLE_KEY في Vercel."},{status:500});
    const body=await request.json(); const action=String(body.action||"");
    const supabase=adminClient();
    if(action==="verify"){
      const civil=String(body.civil_id||"").replace(/\D/g,"");
      if(civil.length!==10)return NextResponse.json({error:"أدخل سجلًا مدنيًا مكونًا من 10 أرقام."},{status:400});
      const {data:trainee,error:tError}=await supabase.from("trainees").select("id,full_name,civil_id,mobile,active").eq("civil_id",civil).maybeSingle();
      if(tError)return NextResponse.json({error:tError.message},{status:500});
      if(!trainee||!trainee.active)return NextResponse.json({error:"المتدرب غير موجود أو غير نشط."},{status:404});
      const {data:exams,error:eError}=await supabase.from("exams").select("id,title,description,instructions,duration_minutes,total_questions,pass_score,max_attempts,shuffle_questions,shuffle_choices,starts_at,ends_at,status").eq("status","published").order("created_at",{ascending:false});
      if(eError)return NextResponse.json({error:eError.message},{status:500});
      const now=Date.now();
      const available=(exams||[]).filter((e:any)=>(!e.starts_at||new Date(e.starts_at).getTime()<=now)&&(!e.ends_at||new Date(e.ends_at).getTime()>=now));
      const {data:attempts}=await supabase.from("attempts").select("exam_id,attempt_number,status").eq("trainee_id",trainee.id);
      const examsWith=(available||[]).map((e:any)=>({...e,attempts_used:(attempts||[]).filter((a:any)=>a.exam_id===e.id).length,can_attempt:(attempts||[]).filter((a:any)=>a.exam_id===e.id).length<e.max_attempts}));
      return NextResponse.json({trainee,exams:examsWith});
    }
    if(action==="start"){
      const civil=String(body.civil_id||"").replace(/\D/g,""); const examId=String(body.exam_id||"");
      const {data:trainee}=await supabase.from("trainees").select("id,full_name,civil_id,active").eq("civil_id",civil).eq("active",true).maybeSingle();
      if(!trainee)return NextResponse.json({error:"بيانات المتدرب غير صالحة."},{status:404});
      const {data:exam}=await supabase.from("exams").select("*").eq("id",examId).eq("status","published").single();
      if(!exam)return NextResponse.json({error:"الاختبار غير متاح."},{status:404});
      const now=Date.now(); if(exam.starts_at&&new Date(exam.starts_at).getTime()>now)return NextResponse.json({error:"لم يبدأ الاختبار بعد."},{status:400}); if(exam.ends_at&&new Date(exam.ends_at).getTime()<now)return NextResponse.json({error:"انتهى وقت الاختبار."},{status:400});
      const {count}=await supabase.from("attempts").select("id",{count:"exact",head:true}).eq("exam_id",examId).eq("trainee_id",trainee.id);
      if((count||0)>=exam.max_attempts)return NextResponse.json({error:"تم استنفاد عدد المحاولات المسموح بها."},{status:400});
      const {data:eq,error:eqError}=await supabase.from("exam_questions").select("question_id,display_order,points_override").eq("exam_id",examId).order("display_order");
      if(eqError)return NextResponse.json({error:eqError.message},{status:500});
      const ids=(eq||[]).map((x:any)=>x.question_id); if(!ids.length)return NextResponse.json({error:"لا توجد أسئلة في هذا الاختبار."},{status:400});
      const {data:qs,error:qError}=await supabase.from("questions").select("id,question_text,question_type,points").in("id",ids).eq("status","approved");
      if(qError)return NextResponse.json({error:qError.message},{status:500});
      const {data:choices,error:cError}=await supabase.from("question_choices").select("id,question_id,choice_text").in("question_id",ids).order("choice_order");
      if(cError)return NextResponse.json({error:cError.message},{status:500});
      let ordered=(eq||[]).map((x:any)=>{const q=(qs||[]).find((z:any)=>z.id===x.question_id);return q?{...q,points:x.points_override??q.points,choices:(choices||[]).filter((c:any)=>c.question_id===q.id)}:null}).filter(Boolean) as any[];
      const rnd=(arr:any[])=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
      if(exam.shuffle_questions)ordered=rnd(ordered);
      if(exam.shuffle_choices)ordered=ordered.map((q:any)=>({...q,choices:rnd(q.choices)}));
      const expires=new Date(Date.now()+exam.duration_minutes*60000);
      const attemptNumber=(count||0)+1;
      const {data:attempt,error:aError}=await supabase.from("attempts").insert({exam_id:examId,trainee_id:trainee.id,expires_at:expires.toISOString(),attempt_number:attemptNumber,random_seed:Date.now()}).select("id,expires_at,attempt_number").single();
      if(aError)return NextResponse.json({error:aError.message},{status:500});
      const aq=ordered.map((q:any,i:number)=>({attempt_id:attempt.id,question_id:q.id,display_order:i+1,choice_order:q.choices.map((c:any)=>c.id),points:q.points}));
      const {error:aqError}=await supabase.from("attempt_questions").insert(aq); if(aqError)return NextResponse.json({error:aqError.message},{status:500});
      return NextResponse.json({attempt:{id:attempt.id,expires_at:attempt.expires_at,attempt_number:attempt.attempt_number},exam:{id:exam.id,title:exam.title,instructions:exam.instructions,duration_minutes:exam.duration_minutes,pass_score:exam.pass_score},questions:ordered});
    }
    if(action==="submit"){
      const attemptId=String(body.attempt_id||""); const answers=Array.isArray(body.answers)?body.answers:[]; 
      const {data:attempt}=await supabase.from("attempts").select("*,exams(title,pass_score),trainees(full_name,civil_id)").eq("id",attemptId).single();
      if(!attempt)return NextResponse.json({error:"المحاولة غير موجودة."},{status:404});
      if(attempt.status!=="in_progress")return NextResponse.json({error:"تم تسليم هذه المحاولة مسبقًا."},{status:400});
      const now=new Date(); const expired=new Date(attempt.expires_at)<=now;
      const {data:aq}=await supabase.from("attempt_questions").select("id,question_id,points,display_order").eq("attempt_id",attemptId).order("display_order");
      const qids=(aq||[]).map((x:any)=>x.question_id);
      const {data:choices}=await supabase.from("question_choices").select("id,question_id,is_correct").in("question_id",qids);
      let score=0,total=0; const rows=[];
      for(const q of (aq||[])){const pts=Number(q.points)||1;total+=pts;const ans=answers.find((a:any)=>a.question_id===q.question_id);const selected=String(ans?.choice_id||"");const correct=(choices||[]).some((c:any)=>c.question_id===q.question_id&&c.id===selected&&c.is_correct);if(correct)score+=pts;rows.push({attempt_question_id:q.id,selected_choice_id:selected||null,is_correct:correct,points_awarded:correct?pts:0});}
      const aqIds=(aq||[]).map((x:any)=>x.id); if(aqIds.length){const {error:delError}=await supabase.from("attempt_answers").delete().in("attempt_question_id",aqIds);if(delError)return NextResponse.json({error:delError.message},{status:500});} const {error:insError}=await supabase.from("attempt_answers").insert(rows); if(insError)return NextResponse.json({error:insError.message},{status:500});
      const percentage=total?Math.round(score/total*10000)/100:0; const passScore=Number(attempt.exams?.pass_score??60); const passed=percentage>=passScore;
      const {error:uError}=await supabase.from("attempts").update({submitted_at:now.toISOString(),status:expired?"expired":"submitted",score,percentage,passed}).eq("id",attemptId);
      if(uError)return NextResponse.json({error:uError.message},{status:500});
      return NextResponse.json({score,total,percentage,passed,pass_score:passScore,status:expired?"expired":"submitted",trainee:attempt.trainees,exam_title:attempt.exams?.title});
    }
    return NextResponse.json({error:"إجراء غير معروف."},{status:400});
  }catch(error:any){return NextResponse.json({error:error?.message||"حدث خطأ غير متوقع."},{status:500});}
}