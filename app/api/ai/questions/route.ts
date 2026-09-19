import {NextRequest, NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

type GeneratedQuestion={question:string;choices:string[];correct_index:number;explanation:string};

export async function POST(request:NextRequest){
  try{
    const auth=request.headers.get("authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return NextResponse.json({error:"غير مصرح."},{status:401});
    const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:"Bearer "+token}}});
    const {data:{user},error:userError}=await supabase.auth.getUser(token);
    if(userError||!user)return NextResponse.json({error:"جلسة الدخول غير صالحة."},{status:401});
    const {data:admin}=await supabase.from("admin_profiles").select("user_id,role").eq("user_id",user.id).maybeSingle();
    if(!admin)return NextResponse.json({error:"هذا الحساب ليس مدير نظام."},{status:403});
    if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"لم يتم إعداد OPENAI_API_KEY في بيئة Vercel بعد."},{status:500});
    const body=await request.json();
    const topic=String(body.topic||"").trim();
    const count=Math.min(20,Math.max(1,Number(body.count)||5));
    const type=body.type==="true_false"?"true_false":"multiple_choice";
    const difficulty=["easy","medium","hard"].includes(body.difficulty)?body.difficulty:"medium";
    const bankId=String(body.bank_id||"");
    if(!topic||!bankId)return NextResponse.json({error:"الموضوع وبنك الأسئلة مطلوبان."},{status:400});
    const schema={type:"object",additionalProperties:false,properties:{questions:{type:"array",items:{type:"object",additionalProperties:false,properties:{question:{type:"string"},choices:{type:"array",items:{type:"string"},minItems:2,maxItems:4},correct_index:{type:"integer",minimum:0,maximum:3},explanation:{type:"string"}},required:["question","choices","correct_index","explanation"]},minItems:count,maxItems:count}},required:["questions"]};
    const prompt=`أنشئ ${count} سؤالًا باللغة العربية حول: ${topic}.
نوع السؤال: ${type==="true_false"?"صح أو خطأ":"اختيار من متعدد"}.
مستوى الصعوبة: ${difficulty==="easy"?"سهل":difficulty==="hard"?"صعب":"متوسط"}.
اجعل الأسئلة دقيقة ومناسبة لاختبار تدريبي مهني. لا تكرر الأسئلة. للاختيار من متعدد أنشئ 4 خيارات وإجابة صحيحة واحدة. لصح/خطأ استخدم خيارين فقط: "صح" و"خطأ". اكتب شرحًا مختصرًا للإجابة الصحيحة. أعد JSON فقط وفق المخطط.`;
    const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+process.env.OPENAI_API_KEY},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",input:prompt,text:{format:{type:"json_schema",name:"generated_questions",strict:true,schema}}})});
    const aiBody=await ai.json();
    if(!ai.ok)return NextResponse.json({error:aiBody?.error?.message||"تعذر الاتصال بخدمة الذكاء الاصطناعي."},{status:502});
    const output=aiBody.output?.find((x:any)=>x.type==="message")?.content?.find((x:any)=>x.type==="output_text")?.text;
    if(!output)throw new Error("لم تصل نتيجة نصية من نموذج الذكاء الاصطناعي.");
    const parsed=JSON.parse(output) as {questions:GeneratedQuestion[]};
    let created=0;
    for(const item of parsed.questions.slice(0,count)){
      const choices=(item.choices||[]).map((choice:string,index:number)=>({choice_text:choice,is_correct:index===item.correct_index,choice_order:index+1}));
      if(choices.filter(x=>x.is_correct).length!==1)continue;
      const {data:q,error:qError}=await supabase.from("questions").insert({bank_id:bankId,question_text:item.question,question_type:type,difficulty,explanation:item.explanation||null,points:1,status:"draft",ai_generated:true,ai_source:"OpenAI"}).select("id").single();
      if(qError)throw qError;
      const {error:cError}=await supabase.from("question_choices").insert(choices.map(c=>({...c,question_id:q.id})));
      if(cError)throw cError;
      created++;
    }
    return NextResponse.json({created});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"حدث خطأ غير متوقع."},{status:500});
  }
}
