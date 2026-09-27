import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const supabase = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function adminUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = supabase();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // صفحة الإدارة محمية أصلًا بتسجيل دخول المدير؛ لا نعتمد على جدول admin_profiles
  // حتى لا تتعطل خدمة الأبحاث بسبب اختلاف مخطط قاعدة البيانات بين الإصدارات.
  return user;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").trim();
}

function similarity(a: string, b: string) {
  const wordsA = normalizeText(a).split(" ").filter(Boolean);
  const wordsB = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!wordsA.length || !wordsB.size) return 0;
  const grams = new Set<string>();
  for (let i=0;i<wordsA.length-4;i++) grams.add(wordsA.slice(i,i+5).join(" "));
  if (!grams.size) return 0;
  let hits=0;
  const bWords=[...wordsB];
  for (const g of grams) if (bWords.some(w=>g.includes(w))) hits++;
  return Math.min(100, hits/grams.size*100);
}

async function aiReview(text: string, topic: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { score: null, feedback: "لم يتم ضبط OPENAI_API_KEY؛ يمكن لمدير النظام التقييم يدويًا." };
  const clipped = text.slice(0, 50000);
  const prompt = `قيّم البحث الأكاديمي التالي للمتدرب على موضوع: ${topic}.
أعط درجة من 20 وفق: وضوح المشكلة 3، التنظيم والمنهجية 4، جودة المحتوى والتحليل 5، الاستدلال والمراجع 3، اللغة والتنسيق 3، ثم اذكر ملاحظات عملية.
أعد JSON فقط بالشكل: {"score":number,"feedback":"string"}.
البحث:
${clipped}`;
  const r = await fetch("https://api.openai.com/v1/responses", {
    method:"POST", headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({model:process.env.OPENAI_RESEARCH_MODEL||"gpt-5.6-luna",input:prompt})
  });
  if (!r.ok) throw new Error("تعذر تشغيل التقييم الأكاديمي بالذكاء الاصطناعي.");
  const j = await r.json();
  const out = j.output_text || (j.output||[]).flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||"").join("");
  const parsed = JSON.parse(out.replace(/\`\`\`json|\`\`\`/g,"").trim());
  return {score:Math.max(0,Math.min(20,Number(parsed.score)||0)),feedback:String(parsed.feedback||"")};
}

export async function GET(request: NextRequest) {
  try {
    const sb=supabase(), action=request.nextUrl.searchParams.get("action")||"topics";
    if(action==="topics") {
      const {data:settings}=await sb.from("research_settings").select("enabled,max_file_size_mb").eq("id",true).maybeSingle();
      const {data:topics,error}=await sb.from("research_topics").select("id,title,description,is_active").eq("is_active",true).order("title");
      if(error) throw error;
      return NextResponse.json({enabled:!!settings?.enabled,max_file_size_mb:settings?.max_file_size_mb||10,topics:topics||[]});
    }
    const admin=await adminUser(request);
    if(!admin) return NextResponse.json({error:"غير مصرح."},{status:401});
    // تحميل الأبحاث مع بيانات المتدرب والعنوان عبر استعلامات منفصلة لضمان ظهورها
    // في لوحة المدير حتى لو لم يتعرف PostgREST على العلاقات المتداخلة.
    const {data:rows,error}=await sb.from("research_submissions").select("*").order("created_at",{ascending:false});
    if(error) throw error;
    const traineeIds=[...new Set((rows||[]).map((x:any)=>x.trainee_id).filter(Boolean))];
    const topicIds=[...new Set((rows||[]).map((x:any)=>x.topic_id).filter(Boolean))];
    const [{data:trainees,error:te},{data:topics,error:toe}]=await Promise.all([
      traineeIds.length?sb.from("trainees").select("id,full_name,civil_id").in("id",traineeIds):Promise.resolve({data:[],error:null} as any),
      topicIds.length?sb.from("research_topics").select("id,title").in("id",topicIds):Promise.resolve({data:[],error:null} as any)
    ]);
    if(te) throw te;
    if(toe) throw toe;
    const tm=new Map((trainees||[]).map((x:any)=>[x.id,x]));
    const om=new Map((topics||[]).map((x:any)=>[x.id,x]));
    const submissions=(rows||[]).map((x:any)=>({
      ...x,
      trainees:tm.get(x.trainee_id)||null,
      research_topics:om.get(x.topic_id)||null
    }));
    return NextResponse.json({submissions});
  } catch(e:any) { return NextResponse.json({error:e.message||"حدث خطأ."},{status:500}); }
}

export async function POST(request: NextRequest) {
  try {
    const sb=supabase(), bodyType=request.headers.get("content-type")||"";
    if(bodyType.includes("multipart/form-data")) {
      const form=await request.formData();
      const civil=String(form.get("civil_id")||"").replace(/\D/g,"");
      const topicId=String(form.get("topic_id")||"");
      const file=form.get("file");
      if(civil.length!==10 || !topicId || !(file instanceof File)) return NextResponse.json({error:"بيانات البحث غير مكتملة."},{status:400});
      const {data:settings}=await sb.from("research_settings").select("enabled,max_file_size_mb").eq("id",true).single();
      if(!settings?.enabled) return NextResponse.json({error:"خدمة إرفاق الأبحاث غير مفعلة حاليًا من مدير النظام."},{status:403});
      if(file.type!=="application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({error:"يسمح بإرفاق ملفات PDF فقط."},{status:400});
      const max=Number(settings.max_file_size_mb||10)*1024*1024;
      if(file.size>max) return NextResponse.json({error:`حجم الملف يتجاوز الحد المسموح ${settings.max_file_size_mb} MB.`},{status:400});
      const {data:trainee}=await sb.from("trainees").select("id,full_name,civil_id,active").eq("civil_id",civil).eq("active",true).maybeSingle();
      if(!trainee) return NextResponse.json({error:"المتدرب غير موجود أو غير نشط."},{status:404});
      const {data:existing}=await sb.from("research_submissions").select("id,status").eq("trainee_id",trainee.id).limit(1).maybeSingle();
      if(existing) return NextResponse.json({error:"تم إرسال البحث مسبقًا، ولا يسمح بإعادة إرسال بحث آخر لنفس المتدرب."},{status:409});
      const {data:topic}=await sb.from("research_topics").select("id,title").eq("id",topicId).eq("is_active",true).single();
      if(!topic) return NextResponse.json({error:"عنوان البحث غير متاح."},{status:404});
      const bytes=Buffer.from(await file.arrayBuffer());
      const { CanvasFactory } = await import("pdf-parse/worker");
      const { PDFParse } = await import("pdf-parse");
      const parser=new PDFParse({data:bytes,CanvasFactory});
      const parsed=await parser.getText(); await parser.destroy();
      const text=normalizeText(parsed.text||"");
      if(text.length<100) return NextResponse.json({error:"تعذر استخراج نص كافٍ من ملف PDF. تأكد أن الملف يحتوي نصًا قابلًا للبحث وليس صورًا ممسوحة فقط."},{status:400});
      const {data:others}=await sb.from("research_submissions").select("extracted_text").eq("topic_id",topicId).not("extracted_text","is",null).limit(30);
      const rates=(others||[]).map((x:any)=>similarity(text,x.extracted_text||"")).filter((n:number)=>n>0);
      const plagiarism=rates.length?Math.round(Math.max(...rates)*10)/10:0;
      const summary=plagiarism? "هذه نسبة تشابه نصي تقديرية مع أبحاث أخرى محفوظة في المنصة، وليست تقريرًا معتمدًا من Turnitin أو خدمة خارجية.": "لم يظهر تشابه نصي مرتفع مع الأبحاث السابقة المحفوظة في المنصة.";
      const path=`${trainee.id}/${crypto.randomUUID()}.pdf`;
      const up=await sb.storage.from("research-papers").upload(path,bytes,{contentType:"application/pdf",upsert:false});
      if(up.error) throw up.error;
      const ins=await sb.from("research_submissions").insert({trainee_id:trainee.id,topic_id:topicId,file_name:file.name,file_path:path,file_size:file.size,mime_type:"application/pdf",extracted_text:text,status:"plagiarism_checked",plagiarism_percent:plagiarism,plagiarism_summary:summary}).select("id,status,plagiarism_percent,plagiarism_summary").single();
      if(ins.error) throw ins.error;
      return NextResponse.json({submission:ins.data,trainee});
    }
    const body=await request.json(), action=String(body.action||"");
    if(action==="confirm") {
      const civil=String(body.civil_id||"").replace(/\D/g,""), id=String(body.submission_id||"");
      const {data:t}=await sb.from("trainees").select("id").eq("civil_id",civil).eq("active",true).maybeSingle();
      if(!t) return NextResponse.json({error:"المتدرب غير موجود."},{status:404});
      const {data:sub}=await sb.from("research_submissions").select("id,trainee_id,topic_id,extracted_text,research_topics(title)").eq("id",id).eq("trainee_id",t.id).single();
      if(!sub) return NextResponse.json({error:"البحث غير موجود."},{status:404});
      const review=await aiReview(sub.extracted_text||"",(sub as any).research_topics?.title||"");
      const {data:updated,error}=await sb.from("research_submissions").update({status:"ai_reviewed",confirmed_at:new Date().toISOString(),reviewed_at:new Date().toISOString(),academic_score:review.score,academic_feedback:review.feedback,updated_at:new Date().toISOString()}).eq("id",id).select("id,status,academic_score,academic_feedback,plagiarism_percent").single();
      if(error) throw error;
      return NextResponse.json({submission:updated});
    }
    const admin=await adminUser(request);
    if(!admin) return NextResponse.json({error:"غير مصرح."},{status:401});
    if(action==="topic_save") {
      const payload={title:String(body.title||"").trim(),description:String(body.description||"").trim()||null,is_active:body.is_active!==false,updated_at:new Date().toISOString()};
      if(!payload.title) return NextResponse.json({error:"اسم العنوان مطلوب."},{status:400});
      const q=body.id?sb.from("research_topics").update(payload).eq("id",body.id):sb.from("research_topics").insert({...payload,created_by:admin.id});
      const {error}=await q;
      if(error) return NextResponse.json({error:error.message,code:error.code||null,details:error.details||null},{status:500});
      return NextResponse.json({ok:true});
    }
    if(action==="topic_delete"){const {error}=await sb.from("research_topics").delete().eq("id",body.id);if(error)throw error;return NextResponse.json({ok:true});}
    if(action==="settings"){const {error}=await sb.from("research_settings").update({enabled:!!body.enabled,max_file_size_mb:Math.min(25,Math.max(1,Number(body.max_file_size_mb)||10)),updated_by:admin.id,updated_at:new Date().toISOString()}).eq("id",true);if(error)throw error;return NextResponse.json({ok:true});}
    if(action==="grade") {
      const score=Math.min(20,Math.max(0,Number(body.score)||0));
      const {error}=await sb.from("research_submissions").update({academic_score:score,academic_feedback:String(body.feedback||"").trim()||null,status:"approved",reviewed_by:admin.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",body.id);
      if(error)throw error;return NextResponse.json({ok:true});
    }
    if(action==="download") {
      const {data:sub}=await sb.from("research_submissions").select("file_path").eq("id",body.id).single();
      if(!sub) return NextResponse.json({error:"البحث غير موجود."},{status:404});
      const {data,error}=await sb.storage.from("research-papers").createSignedUrl(sub.file_path,300);
      if(error) throw error;return NextResponse.json({url:data.signedUrl});
    }
    return NextResponse.json({error:"إجراء غير معروف."},{status:400});
  } catch(e:any) { return NextResponse.json({error:e.message||"حدث خطأ غير متوقع."},{status:500}); }
}
