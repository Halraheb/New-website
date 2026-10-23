// Per-site settings read by common.js and the shared pages (login, profile, dashboard).
const SITE={
  name:"تحصيلي فيزياء 2",
  mark:"ف",
  school:"مدرسة الخويلدية الثانوية",
  pitchTitle:"تدرّب على تحصيلي الفيزياء، واعرف أين تقف",
  pitch:"أسئلة من تجميعات تحصيلي الفيزياء في ست وحدات مع شرح الحل. تُحفظ درجاتك في حسابك، وترى نقاط قوتك وضعفك في كل وحدة، وتجمع الإنجازات.",
  features:[["orbit","85 سؤالاً مع شرح الحل في ست وحدات"],["chart","نقاط القوة والضعف في كل وحدة"],["trophy","إنجازات ومستويات مع كل اختبار"],["users","مسابقات فرق داخل الفصل"]],
  areaWord:"وحدة", areaWordPlural:"الوحدات", areaIntro:"دقة الإجابات في كل وحدة من وحدات فيزياء 2",
  scopeHeader:"الوحدات", scopeLabel:r=>unitsLabel(r.units),
  legacy:true, // physics has attempts saved before accounts existed
  credits:[["إعداد","الأستاذ حسن الراهب"],["مدير المدرسة","رمضان حيدر الرمضان"]],
};
