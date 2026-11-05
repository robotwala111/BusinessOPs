import type { CopilotRecord } from "@/types/copilot";
import type { SupportedLanguage } from "./amiroIntelligenceDemo";

export type ClientIntakeStep = "company" | "contact" | "phone_industry" | "address_tax" | "ready";

export interface ClientIntakeData {
  company_name: string;
  client_short_name: string;
  contact_person: string;
  email: string;
  phone: string;
  industry: string;
  city: string;
  state: string;
  address: string;
  country: string;
  gst_number: string;
  pan_number: string;
}

export interface ClientIntakeSession {
  convId: string;
  step: ClientIntakeStep;
  data: Partial<ClientIntakeData>;
  lastUpdated: string;
}

export const DEMO_CLIENT_INTAKE_PREFIX = "business-ops-client-intake-";
export const DEMO_CLIENT_INTAKE_PREFILL_KEY = "amiro-client-intake-prefill";

const inMemoryClientIntakes: Map<string, ClientIntakeSession> = new Map();

export function getClientIntakeSession(convId: string): ClientIntakeSession | null {
  if (inMemoryClientIntakes.has(convId)) {
    return inMemoryClientIntakes.get(convId)!;
  }
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(`${DEMO_CLIENT_INTAKE_PREFIX}${convId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ClientIntakeSession;
        inMemoryClientIntakes.set(convId, parsed);
        return parsed;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export function saveClientIntakeSession(session: ClientIntakeSession) {
  inMemoryClientIntakes.set(session.convId, session);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(`${DEMO_CLIENT_INTAKE_PREFIX}${session.convId}`, JSON.stringify(session));
    if (session.step === "ready" && session.data) {
      window.localStorage.setItem(DEMO_CLIENT_INTAKE_PREFILL_KEY, JSON.stringify(session.data));
    }
  }
}

export function clearClientIntakeSession(convId: string) {
  inMemoryClientIntakes.delete(convId);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(`${DEMO_CLIENT_INTAKE_PREFIX}${convId}`);
  }
}

export function generateIntakeStepContent(
  step: ClientIntakeStep,
  data: Partial<ClientIntakeData>,
  lang: SupportedLanguage,
  convId: string
): { answer: string; records: CopilotRecord[] } {
  let answer = "";
  const records: CopilotRecord[] = [];

  const company = data.company_name || "Apex Innovations";
  const contact = data.contact_person || "Rajesh Kumar";
  const email = data.email || "rajesh@apexinnovations.com";
  const phone = data.phone || "+91 98490 12345";
  const industry = data.industry || "Enterprise Cloud & Software Services";
  const address = data.address || "Plot 42, Hitech City, Madhapur";
  const city = data.city || "Hyderabad";
  const state = data.state || "Telangana";
  const gst = data.gst_number || "36AAACA1234A1Z5";
  const pan = data.pan_number || "AAACA1234A";

  const domain = company.toLowerCase().replace(/[^a-z0-9]/g, "") || "company";

  if (step === "company") {
    switch (lang) {
      case "te":
        answer = `నేను చాట్ ద్వారా దశలవారీగా కొత్త క్లయింట్ వివరాలను సేకరించి పోర్టల్‌లో ఆటో-ఫిల్ చేయడానికి సహాయం చేస్తాను! 📝\n\n**దశ 1/4: కంపెనీ పేరు**\nమీ క్లయింట్ యొక్క అధికారిక **కంపెనీ పేరు** ఏమిటి?\n*(ఉదాహరణకు: 'Acme Innovations' లేదా మీ క్లయింట్ పేరు — లేదా డెమో కోసం 'Apex Global' అని టైప్ చేయండి)*\n\n*(రద్దు చేయడానికి 'cancel' అని టైప్ చేయండి)*`;
        break;
      case "ta":
        answer = `அரட்டை மூலம் படிப்படியாக புதிய வாடிக்கையாளர் விவரங்களை சேகரித்து போர்ட்டலில் தானாக நிரப்ப நான் உதவுகிறேன்! 📝\n\n**படி 1/4: நிறுவனத்தின் பெயர்**\nஉங்கள் வாடிக்கையாளரின் அதிகாரப்பூர்வ **நிறுவனத்தின் பெயர்** என்ன?\n*(எ.கா: 'Acme Innovations' அல்லது உங்கள் வாடிக்கையாளர் பெயர் — அல்லது டெமோவுக்கு 'Apex Global' என தட்டச்சு செய்யவும்)*\n\n*(ரத்து செய்ய 'cancel' என தட்டச்சு செய்யவும்)*`;
        break;
      case "ml":
        answer = `ചാറ്റിലൂടെ ഘട്ടം ഘട്ടമായി പുതിയ ക്ലയന്റ് വിവരങ്ങൾ ശേഖരിച്ച് പോർട്ടലിൽ ഓട്ടോ-ഫിൽ ചെയ്യാൻ ഞാൻ സഹായിക്കാം! 📝\n\n**ഘട്ടം 1/4: കമ്പനിയുടെ പേര്**\nനിങ്ങളുടെ ക്ലയന്റിന്റെ ഔദ്യോഗിക **കമ്പനി പേര്** എന്താണ്?\n*(ഉദാഹരണത്തിന്: 'Acme Innovations' അല്ലെങ്കിൽ നിങ്ങളുടെ ക്ലയന്റ് പേര് — അല്ലെങ്കിൽ ഡെമോയ്ക്കായി 'Apex Global' എന്ന് ടൈപ്പ് ചെയ്യുക)*\n\n*(റദ്ദാക്കാൻ 'cancel' എന്ന് ടൈപ്പ് ചെയ്യാം)*`;
        break;
      case "kn":
        answer = `ಚಾಟ್ ಮೂಲಕ ಹಂತ-ಹಂತವಾಗಿ ಹೊಸ ಗ್ರಾಹಕರ ವಿವರಗಳನ್ನು ಸಂಗ್ರಹಿಸಿ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಆಟೋ-ಫಿಲ್ ಮಾಡಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ! 📝\n\n**ಹಂತ 1/4: ಕಂಪನಿಯ ಹೆಸರು**\nನಿಮ್ಮ ಗ್ರಾಹಕರ ಅಧಿಕೃತ **ಕಂಪನಿಯ ಹೆಸರು** ಏನು?\n*(ಉದಾ: 'Acme Innovations' ಅಥವಾ ನಿಮ್ಮ ಕ್ಲೈಂಟ್ ಹೆಸರು — ಅಥವಾ ಡೆಮೋಗಾಗಿ 'Apex Global' ಎಂದು ಟೈಪ್ ಮಾಡಿ)*\n\n*(ರದ್ದುಗೊಳಿಸಲು 'cancel' ಎಂದು ಟೈಪ್ ಮಾಡಿ)*`;
        break;
      case "hi":
        answer = `मैं चैट के माध्यम से चरण-दर-चरण नए क्लाइंट का विवरण एकत्र कर पोर्टल में ऑटो-फिल करने में आपकी सहायता करूँगा! 📝\n\n**चरण 1/4: कंपनी का नाम**\nआपके क्लाइंट का आधिकारिक **कंपनी नाम** क्या है?\n*(उदा. 'Acme Innovations' या अपने क्लाइंट का नाम — या डेमो के लिए 'Apex Global' टाइप करें)*\n\n*(रद्द करने के लिए 'cancel' टाइप करें)*`;
        break;
      case "mr":
        answer = `मी चॅटद्वारे टप्प्याटप्प्याने नवीन क्लायंटचे तपशील गोळा करून पोर्टलमध्ये ऑटो-फिल करण्यात मदत करेन! 📝\n\n**टप्पा १/४: कंपनीचे नाव**\nतुमच्या क्लायंटचे अधिकृत **कंपनीचे नाव** काय आहे?\n*(उदा. 'Acme Innovations' किंवा तुमच्या क्लायंटचे नाव)*\n\n*(रद्द करण्यासाठी 'cancel' टाईप करा)*`;
        break;
      case "bn":
        answer = `আমি চ্যাটের মাধ্যমে ধাপে ধাপে নতুন ক্লায়েন্টের তথ্য সংগ্রহ করে পোর্টালে অটো-ফিল করতে সাহায্য করব! 📝\n\n**ধাপ ১/৪: কোম্পানির নাম**\nআপনার ক্লায়েন্টের অফিসিয়াল **কোম্পানির নাম** কী?\n*(যেমন: 'Acme Innovations' বা আপনার ক্লায়েন্টের নাম)*\n\n*(বাতিল করতে 'cancel' লিখুন)*`;
        break;
      case "gu":
        answer = `હું ચેટ દ્વારા પગલાવાર નવા ક્લાયન્ટની વિગતો એકત્રિત કરીને પોર્ટલમાં ઑટો-ફિલ કરવામાં મદદ કરીશ! 📝\n\n**પગલું ૧/૪: કંપનીનું નામ**\nતમારા ક્લાયન્ટનું સત્તાવાર **કંપનીનું નામ** શું છે?\n*(દા.ત. 'Acme Innovations' અથવા તમારા ક્લાયન્ટનું નામ)*\n\n*(રદ કરવા માટે 'cancel' ટાઇપ કરો)*`;
        break;
      case "ar":
        answer = `سأساعدك في جمع بيانات العميل خطوة بخطوة وتعبئتها تلقائياً في البوابة! 📝\n\n**الخطوة 1/4: اسم الشركة**\nما هو **اسم الشركة** الرسمي لعميلك؟\n*(مثال: 'Acme Innovations' أو اسم عميلك)*\n\n*(للإلغاء اكتب 'cancel')*`;
        break;
      default:
        answer = `I will help you fill and register a new client step-by-step through our conversation! 📝\n\n**Step 1 of 4: Company Name**\nWhat is the legal or business **Company Name** of your client?\n*(e.g., 'Acme Innovations' or your client's name — or reply 'use demo' / 'Apex Global' to auto-populate with verified demo data)*\n\n*(Type 'cancel' anytime to exit)*`;
        break;
    }
  } else if (step === "contact") {
    switch (lang) {
      case "te":
        answer = `✓ కంపెనీ పేరు నమోదైంది: **${company}**\n\n**దశ 2/4: సంప్రదింపు వ్యక్తి & ఈమెయిల్**\nప్రధాన సంప్రదింపు వ్యక్తి ఎవరు మరియు వారి వ్యాపార ఈమెయిల్ ఏమిటి?\n*(ఉదాహరణకు: 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "ta":
        answer = `✓ நிறுவனத்தின் பெயர் பதிவு செய்யப்பட்டது: **${company}**\n\n**படி 2/4: தொடர்பு நபர் & மின்னஞ்சல்**\nமுக்கிய தொடர்பு நபர் யார் மற்றும் அவரது வணிக மின்னஞ்சல் என்ன?\n*(எ.கா: 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "ml":
        answer = `✓ കമ്പനി പേര് രേഖപ്പെടുത്തി: **${company}**\n\n**ഘട്ടം 2/4: ബന്ധപ്പെടേണ്ട വ്യക്തിയും ഇമെയിലും**\nപ്രധാന വ്യക്തി ആരാണ്, അവരുടെ ഔദ്യോഗിക ഇമെയിൽ വിലാസം എന്താണ്?\n*(ഉദാഹരണത്തിന്: 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "kn":
        answer = `✓ ಕಂಪನಿ ಹೆಸರು ದಾಖಲಾಗಿದೆ: **${company}**\n\n**ಹಂತ 2/4: ಸಂಪರ್ಕ ವ್ಯಕ್ತಿ & ಇಮೇಲ್**\nಮುಖ್ಯ ಸಂಪರ್ಕ ವ್ಯಕ್ತಿ ಯಾರು ಮತ್ತು ಅವರ ವ್ಯಾಪಾರ ಇಮೇಲ್ ವಿಳಾಸವೇನು?\n*(ಉದಾ: 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "hi":
        answer = `✓ कंपनी का नाम दर्ज हुआ: **${company}**\n\n**चरण 2/4: संपर्क व्यक्ति और ईमेल**\nमुख्य संपर्क व्यक्ति कौन हैं और उनका आधिकारिक ईमेल पता क्या है?\n*(उदा. 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "mr":
        answer = `✓ कंपनीचे नाव नोंदवले: **${company}**\n\n**टप्पा २/४: संपर्क व्यक्ती आणि ईमेल**\nमुख्य संपर्क व्यक्ती कोण आहेत आणि त्यांचा ईमेल काय आहे?\n*(उदा. 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "bn":
        answer = `✓ কোম্পানির নাম সংরক্ষিত: **${company}**\n\n**ধাপ ২/৪: যোগাযোগ ব্যক্তি ও ইমেল**\nপ্রধান যোগাযোগ ব্যক্তি কে এবং তার ব্যবসার ইমেল কী?\n*(যেমন: 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "gu":
        answer = `✓ કંપનીનું નામ નોંધાયું: **${company}**\n\n**પગલું ૨/૪: સંપર્ક વ્યક્તિ અને ઇમેઇલ**\nમુખ્ય સંપર્ક વ્યક્તિ કોણ છે અને તેમનું બિઝનેસ ઇમેઇલ શું છે?\n*(દા.ત. 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      case "ar":
        answer = `✓ تم حفظ اسم الشركة: **${company}**\n\n**الخطوة 2/4: مسؤول التواصل والبريد الإلكتروني**\nمن هو مسؤول التواصل الرئيسي وما هو بريده الإلكتروني الرسمي؟\n*(مثال: 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
      default:
        answer = `✓ Company Name saved: **${company}**\n\n**Step 2 of 4: Primary Contact & Email**\nWho is the primary contact person, and what is their business email address?\n*(e.g., 'Rajesh Kumar, rajesh@${domain}.com')*`;
        break;
    }
  } else if (step === "phone_industry") {
    switch (lang) {
      case "te":
        answer = `✓ సంప్రదింపు వివరాలు నమోదయ్యాయి: **${contact}** (\`${email}\`)\n\n**దశ 3/4: ఫోన్ నంబర్ & పరిశ్రమ (ఇండస్ట్రీ)**\nవారి ఫోన్ నంబర్ మరియు వ్యాపార విభాగం ఏమిటి?\n*(ఉదాహరణకు: '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "ta":
        answer = `✓ தொடர்பு விவரம்: **${contact}** (\`${email}\`)\n\n**படி 3/4: தொலைபேசி எண் & தொழில் துறை**\nஅவர்களின் தொலைபேசி எண் மற்றும் வணிகத் துறை என்ன?\n*(எ.கா: '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "ml":
        answer = `✓ വ്യക്തി & ഇമെയിൽ: **${contact}** (\`${email}\`)\n\n**ഘട്ടം 3/4: ഫോൺ നമ്പറും മേഖലയും**\nഅവരുടെ ബന്ധപ്പെടേണ്ട ഫോൺ നമ്പറും ബിസിനസ്സ് മേഖലയും എന്താണ്?\n*(ഉദാഹരണത്തിന്: '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "kn":
        answer = `✓ ಸಂಪರ್ಕ ಮಾಹಿತಿ: **${contact}** (\`${email}\`)\n\n**ಹಂತ 3/4: ಫೋನ್ ಸಂಖ್ಯೆ & ಉದ್ಯಮ**\nಅವರ ಫೋನ್ ಸಂಖ್ಯೆ ಮತ್ತು ವ್ಯಾಪಾರ ಕ್ಷೇತ್ರ ಯಾವುದು?\n*(ಉದಾ: '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "hi":
        answer = `✓ संपर्क विवरण सुरक्षित: **${contact}** (\`${email}\`)\n\n**चरण 3/4: फोन नंबर और उद्योग**\nउनका संपर्क फोन नंबर और व्यवसाय का क्षेत्र क्या है?\n*(उदा. '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "mr":
        answer = `✓ संपर्क तपशील नोंदवले: **${contact}** (\`${email}\`)\n\n**टप्पा ३/४: फोन नंबर आणि उद्योग**\nत्यांचा फोन नंबर आणि व्यवसायाचे क्षेत्र काय आहे?\n*(उदा. '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "bn":
        answer = `✓ যোগাযোগের তথ্য সংরক্ষিত: **${contact}** (\`${email}\`)\n\n**ধাপ ৩/৪: ফোন নম্বর ও শিল্পক্ষেত্র**\nতাদের ফোন নম্বর এবং ব্যবসায়িক ক্ষেত্র কী?\n*(যেমন: '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "gu":
        answer = `✓ સંપર્ક વિગત નોંધાઈ: **${contact}** (\`${email}\`)\n\n**પગલું ૩/૪: ફોન નંબર અને ઉદ્યોગ**\nતેમનો સંપર્ક ફોન નંબર અને વ્યવસાય ક્ષેત્ર શું છે?\n*(દા.ત. '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      case "ar":
        answer = `✓ تم حفظ بيانات التواصل: **${contact}** (\`${email}\`)\n\n**الخطوة 3/4: رقم الهاتف ومجال العمل**\nما هو رقم الهاتف ومجال العمل أو الصناعة؟\n*(مثال: '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
      default:
        answer = `✓ Contact saved: **${contact}** (\`${email}\`)\n\n**Step 3 of 4: Phone & Industry**\nWhat is their contact phone number and business industry?\n*(e.g., '+91 98490 12345, Enterprise Cloud Services')*`;
        break;
    }
  } else if (step === "address_tax") {
    switch (lang) {
      case "te":
        answer = `✓ ఫోన్ & విభాగం నమోదయ్యాయి: **${phone}** · **${industry}**\n\n**దశ 4/4: చిరునామా & GSTIN (చివరి దశ)**\nక్లయింట్ నగరం/చిరునామా మరియు GSTIN ఏమిటి?\n*(సాధారణ కార్పొరేట్ వివరాల కోసం **'skip'** అని టైప్ చేయండి)*`;
        break;
      case "ta":
        answer = `✓ தொலைபேசி & துறை: **${phone}** · **${industry}**\n\n**படி 4/4: முகவரி & GSTIN (இறுதிப் படி)**\nவாடிக்கையாளரின் நகரம்/முகவரி மற்றும் GST எண் என்ன?\n*(நிலையான விவரங்களைப் பயன்படுத்த **'skip'** என தட்டச்சு செய்யவும்)*`;
        break;
      case "ml":
        answer = `✓ ഫോൺ & മേഖല: **${phone}** · **${industry}**\n\n**ഘട്ടം 4/4: വിലാസവും GSTIN-ഉം (അവസാന ഘട്ടം)**\nക്ലയന്റിന്റെ നഗരം/മേൽവിലാസവും GST നമ്പറും എന്താണ്?\n*(സ്റ്റാൻഡേർഡ് വിവരങ്ങൾക്ക് **'skip'** എന്ന് ടൈപ്പ് ചെയ്യുക)*`;
        break;
      case "kn":
        answer = `✓ ಫೋನ್ & ಉದ್ಯಮ: **${phone}** · **${industry}**\n\n**ಹಂತ 4/4: ವಿಳಾಸ & GSTIN (ಅಂತಿಮ ಹಂತ)**\nಕ್ಲೈಂಟ್ ನಗರ/ವಿಳಾಸ ಮತ್ತು GST ಸಂಖ್ಯೆ ಏನು?\n*(ಡೀಫಾಲ್ಟ್ ವಿವರಗಳಿಗಾಗಿ **'skip'** ಎಂದು ಟೈಪ್ ಮಾಡಿ)*`;
        break;
      case "hi":
        answer = `✓ फोन और उद्योग दर्ज: **${phone}** · **${industry}**\n\n**चरण 4/4: पता और GSTIN (अंतिम चरण)**\nक्लाइंट का शहर/पता और GSTIN क्या है?\n*(मानक कॉर्पोरेट विवरण के लिए **'skip'** टाइप करें)*`;
        break;
      case "mr":
        answer = `✓ फोन आणि उद्योग नोंदवले: **${phone}** · **${industry}**\n\n**टप्पा ४/४: पत्ता आणि GSTIN (अंतिम टप्पा)**\nक्लायंटचे शहर/पत्ता आणि GSTIN काय आहे?\n*(डीफॉल्ट तपशीलांसाठी **'skip'** टाईप करा)*`;
        break;
      case "bn":
        answer = `✓ ফোন ও শিল্পক্ষেত্র সংরক্ষিত: **${phone}** · **${industry}**\n\n**ধাপ ৪/৪: ঠিকানা ও GSTIN (চূড়ান্ত ধাপ)**\nক্লায়েন্টের শহর/ঠিকানা এবং GSTIN কী?\n*(ডিফল্ট তথ্যের জন্য **'skip'** লিখুন)*`;
        break;
      case "gu":
        answer = `✓ ફોન અને ઉદ્યોગ નોંધાયા: **${phone}** · **${industry}**\n\n**પગલું ૪/૪: સરનામું અને GSTIN (અંતિમ પગલું)**\nક્લાયન્ટનું શહેર/સરનામું અને GSTIN શું છે?\n*(ડિફૉલ્ટ વિગતો માટે **'skip'** ટાઇપ કરો)*`;
        break;
      case "ar":
        answer = `✓ تم حفظ الهاتف والمجال: **${phone}** · **${industry}**\n\n**الخطوة 4/4: العنوان والرقم الضريبي (الخطوة الأخيرة)**\nما هي مدينة/عنوان العميل والرقم الضريبي GSTIN؟\n*(لإكمال البيانات تلقائياً اكتب **'skip'**)*`;
        break;
      default:
        answer = `✓ Phone & Industry saved: **${phone}** · **${industry}**\n\n**Step 4 of 4: Location & GSTIN (Final Step)**\nWhat is the client's city/address and GSTIN?\n*(e.g., 'Plot 42, Hitech City, Hyderabad, 36AAACA1234A1Z5' — or type **'skip'** to use standard corporate defaults)*`;
        break;
    }
  } else {
    // step === "ready"
    const formUrl = `/clients/new?autofill=custom&conv=${convId}`;
    const wizardUrl = `/clients/onboard?autofill=custom&conv=${convId}`;
    const quoteUrl = `/quotations/new?autofill=custom&conv=${convId}`;

    records.push(
      {
        id: `rec-intake-form-${convId}`,
        entity: "client",
        label: `✨ Open Client Form – Auto-Fill "${company}"`,
        href: formUrl,
        detail: `${contact} · ${email} · Pre-filled from chat intake`
      },
      {
        id: `rec-intake-wizard-${convId}`,
        entity: "client",
        label: `⚡ 6-Step Onboarding Wizard – "${company}"`,
        href: wizardUrl,
        detail: "KYC, Stakeholders, Project Scope & Commercials auto-filled to Review step"
      },
      {
        id: `rec-intake-quote-${convId}`,
        entity: "quotation",
        label: `📄 Create Quotation Proposal for "${company}"`,
        href: quoteUrl,
        detail: "Cloud ERP Scope & Quotation Proposal"
      }
    );

    switch (lang) {
      case "te":
        answer = `### 🎉 క్లయింట్ వివరాలన్నీ విజయవంతంగా సేకరించబడ్డాయి — ఆటో-ఫిల్ సిద్ధంగా ఉంది!\n\n` +
          `చాట్ నుండి సేకరించిన వివరాలు పోర్టల్‌లో ఆటో-ఫిల్ కావడానికి సిద్ధంగా ఉన్నాయి:\n\n` +
          `• **కంపెనీ:** ${company}\n` +
          `• **సంప్రదింపు వ్యక్తి:** ${contact}\n` +
          `• **ఈమెయిల్:** ${email}\n` +
          `• **ఫోన్:** ${phone}\n` +
          `• **పరిశ్రమ:** ${industry}\n` +
          `• **చిరునామా:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ క్లయింట్ ఫారమ్‌ను ఆటో-ఫిల్ చేయడానికి ఇక్కడ క్లిక్ చేయండి](${formUrl})**\n` +
          `👉 **[⚡ 6-దశల ఆన్‌బోర్డింగ్ విజార్డ్‌ను ఆటో-ఫిల్ చేయండి](${wizardUrl})**\n` +
          `👉 **[📄 ఈ క్లయింట్‌కు కొటేషన్ రూపొందించండి](${quoteUrl})**\n\n` +
          `*మాన్యువల్‌గా ఏమీ నమోదు చేయవలసిన అవసరం లేకుండా అన్ని వివరాలు ఫారమ్‌లలో పూరించబడ్డాయి!*`;
        break;
      case "ta":
        answer = `### 🎉 வாடிக்கையாளர் விவரங்கள் வெற்றிகரமாக சேகரிக்கப்பட்டன — தானாக நிரப்பத் தயாராக உள்ளது!\n\n` +
          `உரையாடலில் இருந்து சேகரிக்கப்பட்ட விவரங்கள் போர்ட்டலில் தானாக நிரப்பத் தயாராக உள்ளன:\n\n` +
          `• **நிறுவனம்:** ${company}\n` +
          `• **தொடர்பு நபர்:** ${contact}\n` +
          `• **மின்னஞ்சல்:** ${email}\n` +
          `• **தொலைபேசி:** ${phone}\n` +
          `• **தொழில் துறை:** ${industry}\n` +
          `• **முகவரி:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ வாடிக்கையாளர் படிவத்தை தானாக நிரப்ப இங்கே கிளிக் செய்க](${formUrl})**\n` +
          `👉 **[⚡ 6-படி ஆன் போர்டிங் வழிகாட்டியை தானாக நிரப்புக](${wizardUrl})**\n` +
          `👉 **[📄 இந்த வாடிக்கையாளருக்கு மேற்கோள் தயாரிக்கவும்](${quoteUrl})**\n\n` +
          `*கைமுறையாக எந்த விவரத்தையும் தட்டச்சு செய்யத் தேவையில்லை!*`;
        break;
      case "ml":
        answer = `### 🎉 ക്ലയന്റ് വിവരങ്ങൾ വിജയകരമായി ശേഖരിച്ചു — ഓട്ടോ-ഫിൽ തയ്യാറാണ്!\n\n` +
          `ചാറ്റിലൂടെ ശേഖരിച്ച വിവരങ്ങൾ പോർട്ടലിലേക്ക് മാറ്റാൻ തയ്യാറായിക്കഴിഞ്ഞു:\n\n` +
          `• **കമ്പനി:** ${company}\n` +
          `• **വ്യക്തി:** ${contact}\n` +
          `• **ഇമെയിൽ:** ${email}\n` +
          `• **ഫോൺ:** ${phone}\n` +
          `• **മേഖല:** ${industry}\n` +
          `• **മേൽവിലാസം:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ ക്ലയന്റ് ഫോം ഓട്ടോ-ഫിൽ ചെയ്യാൻ ഇവിടെ ക്ലിക്ക് ചെയ്യുക](${formUrl})**\n` +
          `👉 **[⚡ 6-ഘട്ട ഓൺബോർഡിംഗ് വിസാർഡ് ഓട്ടോ-ഫിൽ ചെയ്യുക](${wizardUrl})**\n` +
          `👉 **[📄 കൊട്ടേഷൻ തയ്യാറാക്കുക](${quoteUrl})**\n\n` +
          `*നിങ്ങൾ സ്വമേധയാ ഒന്നും ടൈപ്പ് ചെയ്യേണ്ടതില്ല, എല്ലാ വിവരങ്ങളും തയ്യാറാണ്!*`;
        break;
      case "kn":
        answer = `### 🎉 ಗ್ರಾಹಕರ ವಿವರಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ — ಆಟೋ-ಫಿಲ್ ಲಭ್ಯವಿದೆ!\n\n` +
          `ಚಾಟ್‌ನಿಂದ ಸಂಗ್ರಹಿಸಿದ ವಿವರಗಳು ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಆಟೋ-ಫಿಲ್ ಮಾಡಲು ಸಿದ್ಧವಾಗಿವೆ:\n\n` +
          `• **ಕಂಪನಿ:** ${company}\n` +
          `• **ಸಂಪರ್ಕ ವ್ಯಕ್ತಿ:** ${contact}\n` +
          `• **ಇಮೇಲ್:** ${email}\n` +
          `• **ಫೋನ್:** ${phone}\n` +
          `• **ಉದ್ಯಮ:** ${industry}\n` +
          `• **ವಿಳಾಸ:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ ಕ್ಲೈಂಟ್ ಫಾರ್ಮ್ ಅನ್ನು ಆಟೋ-ಫಿಲ್ ಮಾಡಲು ಇಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ](${formUrl})**\n` +
          `👉 **[⚡ 6-ಹಂತದ ಆನ್‌ಬೋರ್ಡಿಂಗ್ ವಿಝಾರ್ಡ್ ತೆರೆಯಿರಿ](${wizardUrl})**\n` +
          `👉 **[📄 ಕೊಟೇಶನ್ ರಚಿಸಿ](${quoteUrl})**\n\n` +
          `*ನೀವು ಹಸ್ತಚಾಲಿತವಾಗಿ ಏನನ್ನೂ ಟೈಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ!*`;
        break;
      case "hi":
        answer = `### 🎉 क्लाइंट का विवरण सफलतापूर्वक एकत्र हो गया — ऑटो-फिल तैयार है!\n\n` +
          `चैट से प्राप्त विवरण अब आपके पोर्टल में ऑटो-फिल होने के लिए तैयार हैं:\n\n` +
          `• **कंपनी:** ${company}\n` +
          `• **संपर्क व्यक्ति:** ${contact}\n` +
          `• **ईमेल:** ${email}\n` +
          `• **फोन:** ${phone}\n` +
          `• **उद्योग:** ${industry}\n` +
          `• **पता:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ क्लाइंट फॉर्म को ऑटो-फिल करने के लिए यहाँ क्लिक करें](${formUrl})**\n` +
          `👉 **[⚡ 6-चरणीय ऑनबोर्डिंग विज़ार्ड को ऑटो-फिल करें](${wizardUrl})**\n` +
          `👉 **[📄 इस क्लाइंट के लिए कोटेशन बनाएं](${quoteUrl})**\n\n` +
          `*मैन्युअल रूप से कुछ भी टाइप करने की आवश्यकता नहीं है!*`;
        break;
      case "mr":
        answer = `### 🎉 क्लायंट डेटा संकलन पूर्ण — ऑटो-फिल तयार आहे!\n\n` +
          `चॅटमधून गोळा केलेले तपशील पोर्टलमध्ये भरण्यासाठी सज्ज आहेत:\n\n` +
          `• **कंपनी:** ${company}\n` +
          `• **संपर्क व्यक्ती:** ${contact}\n` +
          `• **ईमेल:** ${email}\n` +
          `• **फोन:** ${phone}\n` +
          `• **उद्योग:** ${industry}\n` +
          `• **पत्ता:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ क्लायंट फॉर्म ऑटो-फिल करण्यासाठी येथे क्लिक करा](${formUrl})**\n` +
          `👉 **[⚡ ६-टप्प्यांची ऑनबोर्डिंग विझार्ड उघडा](${wizardUrl})**\n` +
          `👉 **[📄 कोटेशन तयार करा](${quoteUrl})**`;
        break;
      case "bn":
        answer = `### 🎉 ক্লায়েন্ট তথ্য সফলভাবে সংগৃহীত — অটো-ফিল প্রস্তুত!\n\n` +
          `চ্যাট থেকে সংগৃহীত বিবরণ পোর্টালে স্বয়ংক্রিয়ভাবে পূরণ করার জন্য প্রস্তুত:\n\n` +
          `• **কোম্পানি:** ${company}\n` +
          `• **যোগাযোগ ব্যক্তি:** ${contact}\n` +
          `• **ইমেল:** ${email}\n` +
          `• **ফোন:** ${phone}\n` +
          `• **শিল্প:** ${industry}\n` +
          `• **ঠিকানা:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ ক্লায়েন্ট ফর্ম অটো-ফিল করতে এখানে ক্লিক করুন](${formUrl})**\n` +
          `👉 **[⚡ ৬-ধাপের অনবোর্ডিং উইজার্ড খুলুন](${wizardUrl})**\n` +
          `👉 **[📄 কোটেশন তৈরি করুন](${quoteUrl})**`;
        break;
      case "gu":
        answer = `### 🎉 ક્લાયન્ટ વિગતો સફળતાપૂર્વક એકત્રિત થઈ — ઑટો-ફિલ તૈયાર છે!\n\n` +
          `ચેટમાંથી એકત્રિત કરેલી વિગતો પોર્ટલમાં આપમેળે ભરવા માટે તૈયાર છે:\n\n` +
          `• **કંપની:** ${company}\n` +
          `• **સંપર્ક વ્યક્તિ:** ${contact}\n` +
          `• **ઇમેઇલ:** ${email}\n` +
          `• **ફોન:** ${phone}\n` +
          `• **ઉદ્યોગ:** ${industry}\n` +
          `• **સરનામું:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ ક્લાયન્ટ ફોર્મ ઑટો-ફિલ કરવા અહીં ક્લિક કરો](${formUrl})**\n` +
          `👉 **[⚡ ૬-પગલાંનું ઑનબોર્ડિંગ વિઝાર્ડ ખોલો](${wizardUrl})**\n` +
          `👉 **[📄 ક્વોટેશન બનાવો](${quoteUrl})**`;
        break;
      case "ar":
        answer = `### 🎉 تم جمع بيانات العميل بنجاح — التعبئة التلقائية جاهزة!\n\n` +
          `تم تجهيز كافة البيانات المدخلة في المحادثة لتعبئتها في البوابة مباشرة:\n\n` +
          `• **الشركة:** ${company}\n` +
          `• **مسؤول التواصل:** ${contact}\n` +
          `• **البريد الإلكتروني:** ${email}\n` +
          `• **الهاتف:** ${phone}\n` +
          `• **مجال العمل:** ${industry}\n` +
          `• **العنوان:** ${address}, ${city}, ${state}\n` +
          `• **الرقم الضريبي:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ انقر هنا لتعبئة نموذج العميل تلقائياً](${formUrl})**\n` +
          `👉 **[⚡ فتح معالج الإعداد المكون من 6 خطوات](${wizardUrl})**\n` +
          `👉 **[📄 إنشاء عرض أسعار للعميل](${quoteUrl})**`;
        break;
      default:
        answer = `### 🎉 Client Data Collected Successfully — Auto-Fill Ready!\n\n` +
          `Here are the verified details collected from our conversation ready to be auto-filled into your portal:\n\n` +
          `• **Company:** ${company}\n` +
          `• **Contact Person:** ${contact}\n` +
          `• **Email:** ${email}\n` +
          `• **Phone:** ${phone}\n` +
          `• **Industry:** ${industry}\n` +
          `• **Location:** ${address}, ${city}, ${state}\n` +
          `• **GSTIN / PAN:** ${gst} | ${pan}\n\n` +
          `👉 **[✨ Click Here to Auto-Fill Client Form](${formUrl})**\n` +
          `👉 **[⚡ Click Here to Auto-Fill 6-Step Onboarding Wizard](${wizardUrl})**\n` +
          `👉 **[📄 Create Quotation for this Client](${quoteUrl})**\n\n` +
          `*All portal form fields will be automatically populated with these collected details without manual typing!*`;
        break;
    }
  }

  return { answer, records };
}

export function handleClientIntakeTurn(
  question: string,
  convId: string,
  lang: SupportedLanguage,
  intent: string
): { answer: string; records: CopilotRecord[] } | null {
  const isCancel =
    /\b(cancel|reset|stop|clear|restart|start\s*over)\b/i.test(question) ||
    /(రద్దు|రీసెట్|റദ്ദാക്കുക|ரத்து|ರದ್ದು|रद्द|বাতিল|إلغاء)/i.test(question);

  const existing = getClientIntakeSession(convId);

  if (isCancel && existing) {
    clearClientIntakeSession(convId);
    let cancelMsg =
      "Client data intake has been cancelled. How else can I assist you with your business operations?";
    if (lang === "te")
      cancelMsg =
        "క్లయింట్ వివరాల సేకరణ రద్దు చేయబడింది. నేను మీకు ఇంకే విధంగా సహాయపడగలను?";
    else if (lang === "ta")
      cancelMsg =
        "வாடிக்கையாளர் விவர சேகரிப்பு ரத்து செய்யப்பட்டது. இன்று நான் உங்களுக்கு வேறு எவ்வாறு உதவ முடியும்?";
    else if (lang === "ml")
      cancelMsg =
        "ക്ലയന്റ് വിവര ശേഖരണം റദ്ദാക്കി. ഇന്ന് ഞാൻ നിങ്ങളെ മറ്റ് എന്തിലാണ് സഹായിക്കേണ്ടത്?";
    else if (lang === "kn")
      cancelMsg =
        "ಗ್ರಾಹಕರ ವಿವರ ಸಂಗ್ರಹಣೆ ರದ್ದುಗೊಂಡಿದೆ. ಇಂದು ನಾನು ನಿಮಗೆ ಬೇರೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?";
    else if (lang === "hi")
      cancelMsg =
        "क्लाइंट विवरण संग्रह रद्द कर दिया गया है। आज मैं आपकी और क्या सहायता कर सकता हूँ?";
    else if (lang === "mr")
      cancelMsg =
        "क्लायंट डेटा संकलन रद्द केले आहे. मी आज तुम्हाला इतर कशी मदत करू शकतो?";
    else if (lang === "bn")
      cancelMsg =
        "ক্লায়েন্ট তথ্য সংগ্রহ বাতিল করা হয়েছে। আজ আমি আপনাকে আর কীভাবে সাহায্য করতে পারি?";
    else if (lang === "gu")
      cancelMsg =
        "ક્લાયન્ટ ડેટા એકત્રીકરણ રદ કરવામાં આવ્યું છે. હું તમને અન્ય કેવી રીતે મદદ કરી શકું?";
    else if (lang === "ar")
      cancelMsg =
        "تم إلغاء جمع بيانات العميل. كيف يمكنني مساعدتك في مهام أخرى اليوم؟";
    return { answer: cancelMsg, records: [] };
  }

  const isIntakeTrigger =
    intent === "fill_client_form" ||
    /\b(fill|collect|add|register|create|onboard|enter)\b.*\b(client|form|details?|profile|wizard|portal|data)\b|\b(client\s+details?|add\s+client|new\s+client|register\s+client)\b|(క్లయింట్ వివరాలు|క్లయింట్ ఫారం|ക്ലയന്റ് വിവരങ്ങൾ|ക്ലയന്റ് ഫോം|வாடிக்கையாளர் படிவம்|வாடிக்கையாளர் விவரங்கள்|ಕ್ಲೈಂಟ್ ವಿವರ|ಕ್ಲೈಂಟ್ ಫಾರ್ಮ್|क्लाइंट विवरण|क्लाइंट फॉर्म|क्लायंट फॉर्म|ক্লায়েন্ট ফর্ম|ક્લાયન્ટ ફોર્મ|تعبئة نموذج)/i.test(
      question
    );

  // If no intake in progress and not an intake trigger, skip
  if (!existing && !isIntakeTrigger) {
    return null;
  }

  // If intake is already completed and this query is not a fresh trigger, let other intents handle it
  if (existing && existing.step === "ready" && !isIntakeTrigger) {
    return null;
  }

  // Quick demo bypass if user explicitly requests demo or sample data
  if (
    /(\b(demo|apex\s*global|sample\s*data|use\s*demo)\b)|(డెమో|ഡെമോ|டெமோ|ಡೆಮೊ|डेमो)/i.test(
      question
    )
  ) {
    const demoData: ClientIntakeData = {
      company_name: "Apex Global Technologies Pvt Ltd",
      client_short_name: "Apex Global",
      contact_person: "Rajesh Kumar (Chief Technology Officer)",
      email: "rajesh.kumar@apextech.com",
      phone: "+91 98490 12345",
      industry: "Enterprise Cloud & Software Services",
      address: "Plot 42, Hitech City, Madhapur",
      city: "Hyderabad",
      state: "Telangana",
      country: "India",
      gst_number: "36AAACA1234A1Z5",
      pan_number: "AAACA1234A"
    };
    const session: ClientIntakeSession = {
      convId,
      step: "ready",
      data: demoData,
      lastUpdated: new Date().toISOString()
    };
    saveClientIntakeSession(session);
    return generateIntakeStepContent("ready", demoData, lang, convId);
  }

  // If starting fresh or re-triggering, ALWAYS start at Step 1 (Company Name).
  // Do NOT guess or extract the company name from the trigger command (e.g. "Help me fill client details step by step")!
  if (!existing || existing.step === "ready") {
    const session: ClientIntakeSession = {
      convId,
      step: "company",
      data: {},
      lastUpdated: new Date().toISOString()
    };
    saveClientIntakeSession(session);
    return generateIntakeStepContent("company", {}, lang, convId);
  }

  // Active session step progression
  const session = existing;

  // Check if the user is asking a question rather than answering
  const isQuestion =
    /^(what|who|which|how|where|why|can|could|is|are|tell\s+me)\b/i.test(
      question.trim()
    ) ||
    /\?$/.test(question.trim()) ||
    /(ఏమిటి|ఎవరు|ఎక్కడ|എന്താണ്|ആരാണ്|எப்பொழுது|என்ன|யார்|ಏನು|ಯಾರು|क्या|कौन|काय|কী|શું|ماذا|من)/.test(
      question
    );

  if (isQuestion) {
    if (
      /company(\s+name)?|కంపెనీ|കമ്പനി|நிறுவனம்|ಕಂಪನಿ|कंपनी/i.test(question)
    ) {
      if (session.data.company_name) {
        let msg = `The company name is currently recorded as: **${session.data.company_name}**.\n\n*(To change it, type 'Change company to [New Name]').*`;
        if (lang === "te") {
          msg = `ప్రస్తుతం కంపెనీ పేరు **${session.data.company_name}** అని నమోదైంది.\n\n*(మార్చడానికి 'కంపెనీ పేరు మార్చండి' అని టైప్ చేయవచ్చు).*`;
        } else if (lang === "ta") {
          msg = `தற்போது நிறுவனத்தின் பெயர் **${session.data.company_name}** என பதிவு செய்யப்பட்டுள்ளது.\n\n*(மாற்ற விரும்பினால், புதிய பெயரை தட்டச்சு செய்யவும்).*`;
        } else if (lang === "ml") {
          msg = `നിലവിൽ കമ്പനി പേര് **${session.data.company_name}** എന്നാണ് രേഖപ്പെടുത്തിയിട്ടുള്ളത്.\n\n*(മാറ്റാൻ 'കമ്പനി പേര് മാറ്റുക' എന്ന് ടൈപ്പ് ചെയ്യാം).*`;
        } else if (lang === "kn") {
          msg = `ಪ್ರಸ್ತುತ ಕಂಪನಿ ಹೆಸರು **${session.data.company_name}** ಎಂದು ದಾಖಲಾಗಿದೆ.\n\n*(ಬದಲಾಯಿಸಲು ಹೊಸ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ).*`;
        } else if (lang === "hi") {
          msg = `वर्तमान में कंपनी का नाम **${session.data.company_name}** दर्ज है।\n\n*(बदलने के लिए 'कंपनी का नाम बदलें' टाइप करें).*`;
        }

        const nextPrompt = generateIntakeStepContent(
          session.step,
          session.data,
          lang,
          convId
        ).answer;
        return {
          answer: `${msg}\n\n${nextPrompt}`,
          records: []
        };
      } else {
        return generateIntakeStepContent("company", {}, lang, convId);
      }
    }
  }

  // Check if the user wants to change or correct the company name explicitly
  const changeMatch = /(?:change|update|set|fix|correct)\s+(?:(?:the\s+)?company(?:\s+name)?\s+(?:to|is)\s+)?([A-Za-z0-9\s&.-]{2,40})/i.exec(
    question
  );
  if (changeMatch && changeMatch[1] && !/^(form|details?|wizard|portal)$/i.test(changeMatch[1].trim())) {
    const newComp = changeMatch[1].trim();
    session.data.company_name = newComp;
    session.data.client_short_name = newComp.split(/\s+/)[0] || newComp;
    session.step = "contact";
    session.lastUpdated = new Date().toISOString();
    saveClientIntakeSession(session);
    return generateIntakeStepContent("contact", session.data, lang, convId);
  }

  if (session.step === "company") {
    // Prevent accidental trigger phrase repetition from being treated as a company name
    const isTriggerNoise =
      /^(help\s+me\s+)?(fill|add|create|new|start|register)\s*(client|details?|form|wizard|step\s*by\s*step)*$/i.test(
        question.trim()
      ) ||
      /^(client\s+details?|details\s+step\s+by\s+step|step\s+by\s+step|client\s+form|form|details)$/i.test(
        question.trim()
      );

    if (isTriggerNoise || isQuestion) {
      let promptMsg =
        "Please provide the official or business **Company Name** of your client (e.g., 'Acme Innovations' or 'Apex Technologies'):";
      if (lang === "te")
        promptMsg =
          "దయచేసి మీ క్లయింట్ యొక్క అధికారిక **కంపెనీ పేరు** నమోదు చేయండి (ఉదా: 'Apex Technologies' లేదా 'Acme Corp'):";
      else if (lang === "ta")
        promptMsg =
          "தயவுசெய்து உங்கள் வாடிக்கையாளரின் அதிகாரப்பூர்வ **நிறுவனத்தின் பெயர்** உள்ளிடவும் (எ.கா: 'Apex Technologies'):";
      else if (lang === "ml")
        promptMsg =
          "ദയവായി നിങ്ങളുടെ ക്ലയന്റിന്റെ ഔദ്യോഗിക **കമ്പനി പേര്** നൽകുക (ഉദാ: 'Apex Technologies'):";
      else if (lang === "kn")
        promptMsg =
          "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಕ್ಲೈಂಟ್‌ನ ಅಧಿಕೃತ **ಕಂಪನಿಯ ಹೆಸರು** ನಮೂದಿಸಿ (ಉದಾ: 'Apex Technologies'):";
      else if (lang === "hi")
        promptMsg =
          "कृपया अपने क्लाइंट का आधिकारिक **कंपनी नाम** दर्ज करें (उदा. 'Apex Technologies' या 'Acme Corp'):";
      return { answer: promptMsg, records: [] };
    }

    let comp = question
      .replace(
        /^(my company is|company name is|company is|name is|it is|it's|the company is)\s+/i,
        ""
      )
      .replace(/[.,;]+$/, "")
      .trim();

    if (!comp || comp.length < 2) {
      comp = "Apex Innovations";
    }

    session.data.company_name = comp;
    session.data.client_short_name = comp.split(/\s+/)[0] || comp;
    session.step = "contact";
    session.lastUpdated = new Date().toISOString();
    saveClientIntakeSession(session);
    return generateIntakeStepContent("contact", session.data, lang, convId);
  }

  if (session.step === "contact") {
    if (isQuestion) {
      let promptMsg =
        "To continue with **Step 2 of 4**, please provide the **Primary Contact Person** and their **Email Address** (e.g., 'Rajesh Kumar, rajesh@company.com'):";
      if (lang === "te")
        promptMsg =
          "**దశ 2/4** కొనసాగించడానికి, దయచేసి ప్రధాన సంప్రదింపు వ్యక్తి మరియు ఈమెయిల్‌ను నమోదు చేయండి:";
      else if (lang === "ta")
        promptMsg =
          "**படி 2/4** தொடர, முக்கிய தொடர்பு நபர் மற்றும் அவரது மின்னஞ்சலை உள்ளிடவும்:";
      else if (lang === "ml")
        promptMsg =
          "**ഘട്ടം 2/4** തുടരുന്നതിന്, പ്രധാന വ്യക്തിയുടെ പേരും ഇമെയിൽ വിലാസവും നൽകുക:";
      else if (lang === "kn")
        promptMsg =
          "**ಹಂತ 2/4** ಮುಂದುವರಿಸಲು, ಮುಖ್ಯ ಸಂಪರ್ಕ ವ್ಯಕ್ತಿ ಮತ್ತು ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ:";
      else if (lang === "hi")
        promptMsg =
          "**चरण 2/4** जारी रखने के लिए, कृपया मुख्य संपर्क व्यक्ति और उनका ईमेल पता दर्ज करें:";
      return { answer: promptMsg, records: [] };
    }

    const emailMatch = question.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    const email = emailMatch
      ? emailMatch[0]
      : `contact@${(session.data.company_name || "enterprise")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")}.com`;
    let contact = question
      .replace(emailMatch ? emailMatch[0] : "", "")
      .replace(/[,;–-]/g, " ")
      .replace(/^(contact is|contact person is|name is|person is)\s+/i, "")
      .replace(/[.,;]+$/, "")
      .trim();
    if (!contact || contact.length < 2) {
      contact = "Rajesh Kumar";
    }
    session.data.contact_person = contact;
    session.data.email = email;
    session.step = "phone_industry";
    session.lastUpdated = new Date().toISOString();
    saveClientIntakeSession(session);
    return generateIntakeStepContent(
      "phone_industry",
      session.data,
      lang,
      convId
    );
  }

  if (session.step === "phone_industry") {
    if (isQuestion) {
      let promptMsg =
        "To continue with **Step 3 of 4**, please provide their **Phone Number** and **Industry** (e.g., '+91 98490 12345, Enterprise Cloud Services'):";
      if (lang === "te")
        promptMsg =
          "**దశ 3/4** కొనసాగించడానికి, దయచేసి వారి ఫోన్ నంబర్ మరియు వ్యాపార విభాగాన్ని నమోదు చేయండి:";
      else if (lang === "ta")
        promptMsg =
          "**படி 3/4** தொடர, தொலைபேசி எண் மற்றும் தொழில் துறையை உள்ளிடவும்:";
      else if (lang === "ml")
        promptMsg =
          "**ഘട്ടം 3/4** തുടരുന്നതിന്, അവരുടെ ഫോൺ നമ്പറും ബിസിനസ്സ് മേഖലയും നൽകുക:";
      else if (lang === "kn")
        promptMsg =
          "**ಹಂತ 3/4** ಮುಂದುವರಿಸಲು, ಅವರ ಫೋನ್ ಸಂಖ್ಯೆ ಮತ್ತು ಉದ್ಯಮ ಕ್ಷೇತ್ರವನ್ನು ನಮೂದಿಸಿ:";
      else if (lang === "hi")
        promptMsg =
          "**चरण 3/4** जारी रखने के लिए, कृपया फोन नंबर और उद्योग का नाम दर्ज करें:";
      return { answer: promptMsg, records: [] };
    }

    const phoneMatch = question.match(/(\+?\d[\d\s-]{8,14}\d)/);
    const phone = phoneMatch ? phoneMatch[0].trim() : "+91 98490 12345";
    let industry = question
      .replace(phoneMatch ? phoneMatch[0] : "", "")
      .replace(/[,;–-]/g, " ")
      .replace(/^(phone is|mobile is|industry is)\s+/i, "")
      .replace(/[.,;]+$/, "")
      .trim();
    if (!industry || industry.length < 2) {
      industry = "Enterprise Cloud & Software Services";
    }
    session.data.phone = phone;
    session.data.industry = industry;
    session.step = "address_tax";
    session.lastUpdated = new Date().toISOString();
    saveClientIntakeSession(session);
    return generateIntakeStepContent("address_tax", session.data, lang, convId);
  }

  if (session.step === "address_tax") {
    const isSkip =
      /\b(skip|default|leave|none|no|ready|done|ok|next|pass)\b/i.test(
        question
      ) ||
      /(స్కిప్|స్కిప్ చేయి|ഒഴിവാക്കുക|തവിർ|ಬಿಟ್ಟುಬಿಡಿ|छोड़ें|वगळा|تخطي)/i.test(
        question
      );

    if (isSkip) {
      session.data.address = "Plot 42, Hitech City, Madhapur";
      session.data.city = "Hyderabad";
      session.data.state = "Telangana";
      session.data.country = "India";
      session.data.gst_number = "36AAACA1234A1Z5";
      session.data.pan_number = "AAACA1234A";
    } else {
      const gstMatch = question.match(
        /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i
      );
      if (gstMatch) {
        session.data.gst_number = gstMatch[0].toUpperCase();
        session.data.pan_number = gstMatch[0].slice(2, 12).toUpperCase();
      } else {
        session.data.gst_number = "36AAACA1234A1Z5";
        session.data.pan_number = "AAACA1234A";
      }

      const addr = question
        .replace(gstMatch ? gstMatch[0] : "", "")
        .replace(/[,;–-]/g, " ")
        .trim();
      if (addr.length >= 3) {
        session.data.address = addr;
        if (/hyderabad/i.test(addr)) {
          session.data.city = "Hyderabad";
          session.data.state = "Telangana";
        } else if (/bangalore|bengaluru/i.test(addr)) {
          session.data.city = "Bengaluru";
          session.data.state = "Karnataka";
        } else if (/mumbai/i.test(addr)) {
          session.data.city = "Mumbai";
          session.data.state = "Maharashtra";
        } else if (/chennai/i.test(addr)) {
          session.data.city = "Chennai";
          session.data.state = "Tamil Nadu";
        } else if (/kochi|cochin/i.test(addr)) {
          session.data.city = "Kochi";
          session.data.state = "Kerala";
        } else if (/delhi/i.test(addr)) {
          session.data.city = "New Delhi";
          session.data.state = "Delhi";
        } else {
          session.data.city = addr.split(/\s+/)[0];
          session.data.state = "Telangana";
        }
      } else {
        session.data.address = "Plot 42, Hitech City, Madhapur";
        session.data.city = "Hyderabad";
        session.data.state = "Telangana";
      }
      session.data.country = "India";
    }

    const completedProfile: ClientIntakeData = {
      company_name: session.data.company_name || "Apex Global Technologies",
      client_short_name:
        session.data.client_short_name ||
        session.data.company_name?.split(/\s+/)[0] ||
        "Apex",
      contact_person: session.data.contact_person || "Rajesh Kumar",
      email: session.data.email || "rajesh.kumar@apextech.com",
      phone: session.data.phone || "+91 98490 12345",
      industry: session.data.industry || "Enterprise Cloud & Software Services",
      address: session.data.address || "Plot 42, Hitech City, Madhapur",
      city: session.data.city || "Hyderabad",
      state: session.data.state || "Telangana",
      country: session.data.country || "India",
      gst_number: session.data.gst_number || "36AAACA1234A1Z5",
      pan_number: session.data.pan_number || "AAACA1234A"
    };

    session.step = "ready";
    session.data = completedProfile;
    session.lastUpdated = new Date().toISOString();
    saveClientIntakeSession(session);

    return generateIntakeStepContent("ready", completedProfile, lang, convId);
  }

  return null;
}

