import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, CheckCircle2, HeartPulse, Sparkles, Stethoscope, Activity, ShieldCheck } from "lucide-react";

const siteName = "ChestPain Navigator";

const unstableFeaturesList = [
  "Pain occurring at rest",
  "Ischemic ECG changes not present on old ECG",
  "Presence of bundle branch block",
  "Severe chest pain",
  "Elevated cardiac enzymes",
];

const highRiskCadFeatures = [
  "Left main stenosis ≥50%",
  "Obstructive CAD with FFR-CT ≤0.80",
];

const stressOptions = "Stress CMR, stress PET, stress SPECT, or stress echocardiography";

function classBadge(recClass) {
  if (recClass === "Class I") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (recClass === "Class IIa") return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function recommendation(recClass, text) {
  return { recClass, text };
}

function inferPainRisk({ sex, age, symptoms }) {
  if (symptoms !== "chest_pain") return null;
  const a = Number(age);
  if (!sex || Number.isNaN(a)) return null;

  if (sex === "male") {
    if (a <= 39) return "Low risk";
    if (a >= 40 && a <= 69) return "Intermediate risk";
    if (a >= 70) return "High risk";
  }

  if (sex === "female") {
    if (a <= 59) return "Low risk";
    if (a >= 60) return "Intermediate risk";
  }

  return null;
}

function computeOutcome(form) {
  const recommendations = [];
  const summary = [];
  const risk = inferPainRisk(form);

  summary.push(["Date", form.date || "—"]);
  summary.push(["Patient name", form.patientName || "—"]);
  summary.push(["Medical number", form.medicalNumber || "—"]);
  summary.push(["Age", form.age || "—"]);
  summary.push(["Sex", form.sex || "—"]);
  summary.push(["Presentation", form.symptoms === "chest_pain" ? "Chest pain" : "Asymptomatic"]);
  if (risk) summary.push(["Initial chest pain risk", risk]);

  if (form.symptoms === "asymptomatic") {
    summary.push(["Left main stent", form.leftMainStent === "yes" ? "Yes" : "No"]);
    if (form.leftMainStent === "yes") {
      recommendations.push(recommendation("Class IIa", "Consider screening with cardiac CT if needed and judged appropriate by the clinician."));
      return { risk, summary, recommendations };
    }

    summary.push(["ASCVD score", form.ascvdScore || "—"]);
    const score = Number(form.ascvdScore);
    if (!Number.isNaN(score)) {
      if (score < 5) {
        summary.push(["ASCVD category", "Low risk (<5%)"]);
        summary.push(["Family history of CAD", form.familyHistoryCad === "yes" ? "Yes" : "No"]);
        if (form.familyHistoryCad === "yes") {
          recommendations.push(recommendation("Class IIa", "Recommend calcium scoring."));
        } else {
          recommendations.push(recommendation("Info", "No specific additional testing pathway selected based on the entered data."));
        }
      } else if (score >= 5 && score <= 20) {
        summary.push(["ASCVD category", "Intermediate risk (5–20%)"]);
        recommendations.push(recommendation("Class IIa", "Recommend calcium scoring for risk stratification modification."));
      } else {
        summary.push(["ASCVD category", "Above 20%"]);
        recommendations.push(recommendation("Info", "This branch is not specifically defined in the current tool logic."));
      }
    }

    return { risk, summary, recommendations };
  }

  const unstable = form.unstableFeatures?.length > 0;
  summary.push(["Unstable features", unstable ? form.unstableFeatures.join(", ") : "None selected"]);
  if (unstable) {
    recommendations.push(recommendation("Class I", "Hospitalize the patient and perform cardiac catheterisation."));
    return { risk, summary, recommendations };
  }

  summary.push(["Chest pain pattern", "Stable chest pain"]);
  summary.push(["Acute chest pain", form.acutePain === "yes" ? "Yes" : "No"]);

  if (form.acutePain === "no") {
    summary.push(["Known CAD", form.knownCadStable === "yes" ? "Yes" : "No"]);
    if (form.knownCadStable === "no") {
      if (risk === "Low risk") {
        recommendations.push(
          recommendation("Class I", "No further testing."),
          recommendation("Class IIa", "Calcium scoring."),
          recommendation("Class IIa", "Exercise stress testing.")
        );
      } else if (risk === "Intermediate risk") {
        recommendations.push(
          recommendation("Class I", "CCTA."),
          recommendation("Class I", `${stressOptions}.`),
          recommendation("Class IIa", "Exercise ECG.")
        );
      } else if (risk === "High risk") {
        recommendations.push(
          recommendation("Class I", "CCTA."),
          recommendation("Class I", `${stressOptions}.`),
          recommendation("Class IIa", "Exercise ECG."),
          recommendation("Class IIa", "Direct cardiac catheterisation can be considered if the cardiologist finds it reasonable.")
        );
      }
      return { risk, summary, recommendations };
    }

    summary.push(["Stable known CAD type", form.knownCadTypeStable || "—"]);
    if (form.knownCadTypeStable === "nonobstructive") {
      recommendations.push(
        recommendation("Class I", "Intensification of preventive strategies."),
        recommendation("Class I", "Testing may be deferred.")
      );
      summary.push(["Persistent symptoms", form.persistentSymptoms === "yes" ? "Yes" : "No"]);
      if (form.persistentSymptoms === "yes") {
        recommendations.push(
          recommendation("Class IIa", "CCTA ± FFR-CT."),
          recommendation("Class IIa", `${stressOptions}.`)
        );
      }
      return { risk, summary, recommendations };
    }

    if (form.knownCadTypeStable === "obstructive") {
      recommendations.push(recommendation("Class I", "Intensify guideline-directed / gold standard medical therapy."));
      const hasHighRisk = form.highRiskCadStable?.length > 0;
      summary.push(["High-risk CAD features", hasHighRisk ? form.highRiskCadStable.join(", ") : "None selected"]);
      summary.push(["Frequent angina", form.frequentAngina === "yes" ? "Yes" : "No"]);
      if (hasHighRisk || form.frequentAngina === "yes") {
        recommendations.push(recommendation("Class I", "Invasive coronary angiography ± FFR studies."));
      } else {
        recommendations.push(
          recommendation("Class I", `${stressOptions}.`),
          recommendation("Class IIa", "Exercise ECG.")
        );
      }
      return { risk, summary, recommendations };
    }
  }

  if (form.acutePain === "yes") {
    summary.push(["Known CAD in acute setting", form.acuteKnownCad || "—"]);
    if (form.acuteKnownCad === "no") {
      summary.push(["Recent test status", form.recentTestStatus || "—"]);
      if (form.recentTestStatus === "normal_recent") recommendations.push(recommendation("Class I", "Discharge from hospital."));
      else if (form.recentTestStatus === "inconclusive_mild") recommendations.push(recommendation("Class IIa", "CCTA."));
      else if (form.recentTestStatus === "moderate_severe") recommendations.push(recommendation("Class I", "Invasive coronary angiography."));
      else if (form.recentTestStatus === "no_recent") {
        recommendations.push(
          recommendation("Class I", "CCTA."),
          recommendation("Class I", `${stressOptions}.`)
        );
      }
      return { risk, summary, recommendations };
    }

    if (form.acuteKnownCad === "yes") {
      summary.push(["Acute known CAD type", form.acuteKnownCadType || "—"]);
      if (form.acuteKnownCadType === "nonobstructive") {
        recommendations.push(
          recommendation("Class I", "Intensification of preventive strategies."),
          recommendation("Class IIa", "CCTA."),
          recommendation("Class IIa", `${stressOptions}.`)
        );
        return { risk, summary, recommendations };
      }

      if (form.acuteKnownCadType === "obstructive") {
        recommendations.push(recommendation("Class I", "Intensify guideline-directed / gold standard medical therapy."));
        const acuteHighRisk = form.highRiskCadAcute?.length > 0;
        summary.push(["High-risk CAD features", acuteHighRisk ? form.highRiskCadAcute.join(", ") : "None selected"]);
        if (acuteHighRisk) recommendations.push(recommendation("Class I", "Perform coronary angiography."));
        else recommendations.push(recommendation("Class IIa", `${stressOptions}.`));
        return { risk, summary, recommendations };
      }
    }
  }

  recommendations.push(recommendation("Info", "Incomplete pathway. Please review the selections."));
  return { risk, summary, recommendations };
}

function FieldLabel({ children, optional = false }) {
  return (
    <label className="mb-2 block text-sm font-medium text-slate-700">
      {children} {optional && <span className="text-slate-400">(optional)</span>}
    </label>
  );
}

function Input({ className = "", ...props }) {
  return <input {...props} className={`w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 ${className}`} />;
}

function Select({ className = "", children, ...props }) {
  return <select {...props} className={`w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 ${className}`}>{children}</select>;
}

function QuestionCard({ title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -18, scale: 0.99 }}
      transition={{ duration: 0.3 }}
      className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur md:p-7"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function ToggleCards({ value, onChange, options }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-3xl border p-4 text-left transition ${active ? "border-cyan-500 bg-cyan-50 shadow-lg shadow-cyan-100" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <div className="text-base font-semibold text-slate-900">{opt.label}</div>
            {opt.description && <div className="mt-1 text-sm text-slate-500">{opt.description}</div>}
          </button>
        );
      })}
    </div>
  );
}

function CheckList({ items, values, onChange }) {
  const toggle = (item) => {
    const exists = values.includes(item);
    onChange(exists ? values.filter((v) => v !== item) : [...values, item]);
  };

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const active = values.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${active ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <div className={`mt-0.5 h-5 w-5 rounded-md border ${active ? "border-rose-500 bg-rose-500" : "border-slate-300 bg-white"}`} />
            <div className="text-sm font-medium text-slate-800">{item}</div>
          </button>
        );
      })}
    </div>
  );
}

function RiskPill({ risk }) {
  const styles = {
    "Low risk": "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Intermediate risk": "border-amber-200 bg-amber-50 text-amber-700",
    "High risk": "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${styles[risk] || "border-slate-200 bg-white text-slate-600"}`}><Stethoscope className="h-4 w-4" /> {risk || "Risk pending"}</div>;
}

const stepResetMap = {
  home: {
    symptoms: "",
    leftMainStent: "",
    ascvdScore: "",
    familyHistoryCad: "",
    unstableFeatures: [],
    unstableNone: false,
    acutePain: "",
    knownCadStable: "",
    knownCadTypeStable: "",
    persistentSymptoms: "",
    highRiskCadStable: [],
    stableHighRiskNone: false,
    frequentAngina: "",
    acuteKnownCad: "",
    recentTestStatus: "",
    acuteKnownCadType: "",
    highRiskCadAcute: [],
    acuteHighRiskNone: false,
  },
  asymptomatic_left_main: { leftMainStent: "" },
  asymptomatic_ascvd: { ascvdScore: "", familyHistoryCad: "" },
  asymptomatic_family_history: { familyHistoryCad: "" },
  unstable_features: { unstableFeatures: [], unstableNone: false },
  acute_or_not: { acutePain: "", knownCadStable: "", knownCadTypeStable: "", persistentSymptoms: "", highRiskCadStable: [], stableHighRiskNone: false, frequentAngina: "", acuteKnownCad: "", recentTestStatus: "", acuteKnownCadType: "", highRiskCadAcute: [], acuteHighRiskNone: false },
  stable_known_cad: { knownCadStable: "", knownCadTypeStable: "", persistentSymptoms: "", highRiskCadStable: [], stableHighRiskNone: false, frequentAngina: "" },
  stable_known_cad_type: { knownCadTypeStable: "", persistentSymptoms: "", highRiskCadStable: [], stableHighRiskNone: false, frequentAngina: "" },
  persistent_symptoms: { persistentSymptoms: "" },
  stable_obstructive_details: { highRiskCadStable: [], stableHighRiskNone: false, frequentAngina: "" },
  acute_known_cad: { acuteKnownCad: "", recentTestStatus: "", acuteKnownCadType: "", highRiskCadAcute: [], acuteHighRiskNone: false },
  acute_recent_test_status: { recentTestStatus: "" },
  acute_known_cad_type: { acuteKnownCadType: "", highRiskCadAcute: [], acuteHighRiskNone: false },
  acute_obstructive_details: { highRiskCadAcute: [], acuteHighRiskNone: false },
};

export default function ChestPainEvaluationApp() {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    patientName: "",
    age: "",
    sex: "",
    medicalNumber: "",
    symptoms: "",
    leftMainStent: "",
    ascvdScore: "",
    familyHistoryCad: "",
    unstableFeatures: [],
    unstableNone: false,
    acutePain: "",
    knownCadStable: "",
    knownCadTypeStable: "",
    persistentSymptoms: "",
    highRiskCadStable: [],
    stableHighRiskNone: false,
    frequentAngina: "",
    acuteKnownCad: "",
    recentTestStatus: "",
    acuteKnownCadType: "",
    highRiskCadAcute: [],
    acuteHighRiskNone: false,
  });

  const [step, setStep] = useState(0);
  const autoAdvanceRef = useRef(null);
  const risk = useMemo(() => inferPainRisk(form), [form]);
  const outcome = useMemo(() => computeOutcome(form), [form]);

  const visibleSteps = useMemo(() => {
    const steps = ["home"];
    if (!form.symptoms) return steps;

    if (form.symptoms === "asymptomatic") {
      steps.push("asymptomatic_left_main");
      if (form.leftMainStent === "no") {
        steps.push("asymptomatic_ascvd");
        const score = Number(form.ascvdScore);
        if (!Number.isNaN(score) && score < 5) steps.push("asymptomatic_family_history");
      }
      steps.push("summary");
      return steps;
    }

    steps.push("unstable_features");
    if ((form.unstableFeatures || []).length > 0) {
      steps.push("summary");
      return steps;
    }

    if (!form.unstableNone) return steps;
    steps.push("acute_or_not");

    if (form.acutePain === "no") {
      steps.push("stable_known_cad");
      if (form.knownCadStable === "yes") {
        steps.push("stable_known_cad_type");
        if (form.knownCadTypeStable === "nonobstructive") steps.push("persistent_symptoms");
        if (form.knownCadTypeStable === "obstructive") steps.push("stable_obstructive_details");
      }
      steps.push("summary");
      return steps;
    }

    if (form.acutePain === "yes") {
      steps.push("acute_known_cad");
      if (form.acuteKnownCad === "no") steps.push("acute_recent_test_status");
      if (form.acuteKnownCad === "yes") {
        steps.push("acute_known_cad_type");
        if (form.acuteKnownCadType === "obstructive") steps.push("acute_obstructive_details");
      }
      steps.push("summary");
      return steps;
    }

    return steps;
  }, [form]);

  const currentStepIndex = Math.min(step, visibleSteps.length - 1);
  const currentStepKey = visibleSteps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / visibleSteps.length) * 100;

  const update = (key, value) => setForm((s) => ({ ...s, [key]: value }));
  const resetAndUpdate = (patch) => setForm((s) => ({ ...s, ...patch }));
  const prev = () => {
    if (currentStepIndex === 0) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    const targetStep = currentStepIndex - 1;
    const targetKey = visibleSteps[targetStep];
    const resetPatch = stepResetMap[targetKey] || {};

    setStep(targetStep);
    setForm((s) => ({ ...s, ...resetPatch }));
  };

  const canAutoAdvance = () => {
    switch (currentStepKey) {
      case "home": return !!form.age && !!form.sex && !!form.symptoms;
      case "asymptomatic_left_main": return !!form.leftMainStent;
      case "asymptomatic_ascvd": return form.ascvdScore !== "";
      case "asymptomatic_family_history": return !!form.familyHistoryCad;
      case "unstable_features": return form.unstableNone || (form.unstableFeatures || []).length > 0;
      case "acute_or_not": return !!form.acutePain;
      case "stable_known_cad": return !!form.knownCadStable;
      case "stable_known_cad_type": return !!form.knownCadTypeStable;
      case "persistent_symptoms": return !!form.persistentSymptoms;
      case "stable_obstructive_details": return !!form.frequentAngina && (form.stableHighRiskNone || (form.highRiskCadStable || []).length > 0);
      case "acute_known_cad": return !!form.acuteKnownCad;
      case "acute_recent_test_status": return !!form.recentTestStatus;
      case "acute_known_cad_type": return !!form.acuteKnownCadType;
      case "acute_obstructive_details": return form.acuteHighRiskNone || (form.highRiskCadAcute || []).length > 0;
      default: return false;
    }
  };

  useEffect(() => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    if (!canAutoAdvance()) return;
    if (currentStepIndex >= visibleSteps.length - 1) return;

    autoAdvanceRef.current = setTimeout(() => {
      setStep((s) => Math.min(s + 1, visibleSteps.length - 1));
    }, 650);

    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [form, currentStepKey, currentStepIndex, visibleSteps.length]);

  useEffect(() => {
    if (step > visibleSteps.length - 1) setStep(visibleSteps.length - 1);
  }, [visibleSteps.length, step]);

  
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_20%),linear-gradient(180deg,_#f8fbff_0%,_#edf6ff_100%)] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 overflow-hidden rounded-[2.6rem] border border-white/60 bg-[linear-gradient(135deg,_#041226_0%,_#0d2447_45%,_#15366a_100%)] text-white shadow-[0_30px_90px_rgba(2,8,23,0.35)]">
          <div className="relative overflow-hidden p-8 md:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(34,211,238,0.22),_transparent_24%),radial-gradient(circle_at_85%_10%,_rgba(168,85,247,0.18),_transparent_24%),radial-gradient(circle_at_70%_80%,_rgba(59,130,246,0.15),_transparent_20%)]" />
            <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur">
                  <HeartPulse className="h-4 w-4" /> {siteName}
                </div>
                <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
                  Smart chest pain triage, built for faster clinical flow.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  A guided clinician-support interface for asymptomatic evaluation, stable chest pain, and acute chest pain pathways with automatic progression and final structured recommendation.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">Automatic page flow</div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">Structured recommendation output</div>
                  
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                    <Activity className="h-4 w-4" /> Workflow mode
                  </div>
                  <div className="text-2xl font-bold">Automatic</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Once the required answer is entered, the next page appears automatically. Use Previous to step back and modify responses.
                  </p>
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    <ShieldCheck className="h-4 w-4" /> Intended use
                  </div>
                  <p className="text-sm leading-6 text-slate-300">
                    Decision-support tool for clinicians. Final decisions should always integrate full clinical judgment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Progress</span>
            <span className="text-slate-500">Step {currentStepIndex + 1} / {visibleSteps.length}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <AnimatePresence mode="wait">
            <div key={currentStepKey}>
              {currentStepKey === "home" && (
                <QuestionCard title="Patient information" subtitle="Complete the baseline details. Once the required fields are filled, the next screen opens automatically.">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Auto navigation</div>
                      <div className="mt-1 text-sm font-medium text-slate-700">Complete the required fields and the next page opens automatically.</div>
                    </div>
                    {form.symptoms === "chest_pain" && risk && <RiskPill risk={risk} />}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div><FieldLabel>Date</FieldLabel><Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} /></div>
                    <div><FieldLabel optional>Patient name</FieldLabel><Input value={form.patientName} onChange={(e) => update("patientName", e.target.value)} placeholder="e.g. John Doe" /></div>
                    <div><FieldLabel>Age</FieldLabel><Input type="number" value={form.age} onChange={(e) => update("age", e.target.value)} placeholder="Enter age" /></div>
                    <div><FieldLabel>Sex</FieldLabel><Select value={form.sex} onChange={(e) => update("sex", e.target.value)}><option value="">Select sex</option><option value="male">Male</option><option value="female">Female</option></Select></div>
                    <div className="md:col-span-2"><FieldLabel optional>Medical number</FieldLabel><Input value={form.medicalNumber} onChange={(e) => update("medicalNumber", e.target.value)} placeholder="Optional identifier" /></div>
                  </div>

                  <div className="mt-8">
                    <FieldLabel>Clinical presentation</FieldLabel>
                    <ToggleCards
                      value={form.symptoms}
                      onChange={(v) => resetAndUpdate({ symptoms: v, leftMainStent: "", ascvdScore: "", familyHistoryCad: "", unstableFeatures: [], unstableNone: false, acutePain: "", knownCadStable: "", knownCadTypeStable: "", persistentSymptoms: "", highRiskCadStable: [], stableHighRiskNone: false, frequentAngina: "", acuteKnownCad: "", recentTestStatus: "", acuteKnownCadType: "", highRiskCadAcute: [], acuteHighRiskNone: false })}
                      options={[{ value: "chest_pain", label: "Chest pain", description: "Continue through the chest pain decision pathway." }, { value: "asymptomatic", label: "Asymptomatic", description: "Follow the asymptomatic risk-based branch." }]}
                    />
                  </div>
                </QuestionCard>
              )}

              {currentStepKey === "asymptomatic_left_main" && <QuestionCard title="Asymptomatic pathway" subtitle="Does the patient have a left main stent?"><ToggleCards value={form.leftMainStent} onChange={(v) => update("leftMainStent", v)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></QuestionCard>}

              {currentStepKey === "asymptomatic_ascvd" && <QuestionCard title="ASCVD score" subtitle="Enter the ASCVD score to continue risk refinement."><div className="max-w-sm"><FieldLabel>ASCVD score (%)</FieldLabel><Input type="number" value={form.ascvdScore} onChange={(e) => update("ascvdScore", e.target.value)} placeholder="e.g. 4.2" /></div></QuestionCard>}

              {currentStepKey === "asymptomatic_family_history" && <QuestionCard title="Family history of CAD" subtitle="Required when ASCVD score is below 5%."><ToggleCards value={form.familyHistoryCad} onChange={(v) => update("familyHistoryCad", v)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></QuestionCard>}

              {currentStepKey === "unstable_features" && (
                <QuestionCard title="Assess instability" subtitle="Select one or more unstable features. If none are present, choose the stable pathway card below.">
                  <CheckList items={unstableFeaturesList} values={form.unstableFeatures} onChange={(v) => resetAndUpdate({ unstableFeatures: v, unstableNone: false })} />
                  <button type="button" onClick={() => resetAndUpdate({ unstableFeatures: [], unstableNone: true })} className={`mt-4 w-full rounded-2xl border p-4 text-left transition ${form.unstableNone ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <div className="text-sm font-semibold text-slate-900">No unstable features</div>
                    <div className="mt-1 text-sm text-slate-500">Treat as stable chest pain and continue automatically.</div>
                  </button>
                </QuestionCard>
              )}

              {currentStepKey === "acute_or_not" && <QuestionCard title="Stable chest pain branch" subtitle="Is the chest pain acute?"><ToggleCards value={form.acutePain} onChange={(v) => update("acutePain", v)} options={[{ value: "yes", label: "Acute chest pain" }, { value: "no", label: "Not acute" }]} /></QuestionCard>}

              {currentStepKey === "stable_known_cad" && <QuestionCard title="History of CAD" subtitle="For stable, non-acute chest pain: does the patient have known CAD?"><ToggleCards value={form.knownCadStable} onChange={(v) => update("knownCadStable", v)} options={[{ value: "yes", label: "Known CAD" }, { value: "no", label: "No known CAD" }]} /></QuestionCard>}

              {currentStepKey === "stable_known_cad_type" && <QuestionCard title="Stable known CAD type" subtitle="Choose the CAD category."><ToggleCards value={form.knownCadTypeStable} onChange={(v) => update("knownCadTypeStable", v)} options={[{ value: "nonobstructive", label: "Nonobstructive CAD", description: "Stenosis <50%" }, { value: "obstructive", label: "Obstructive CAD", description: "Stenosis >50%" }]} /></QuestionCard>}

              {currentStepKey === "persistent_symptoms" && <QuestionCard title="Persistent symptoms" subtitle="For stable, nonobstructive CAD: are symptoms persisting?"><ToggleCards value={form.persistentSymptoms} onChange={(v) => update("persistentSymptoms", v)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></QuestionCard>}

              {currentStepKey === "stable_obstructive_details" && (
                <QuestionCard title="Stable obstructive CAD details" subtitle="Select any high-risk CAD feature and indicate the angina burden. If none are present, choose the dedicated card below.">
                  <div>
                    <FieldLabel>High-risk CAD features</FieldLabel>
                    <CheckList items={highRiskCadFeatures} values={form.highRiskCadStable} onChange={(v) => resetAndUpdate({ highRiskCadStable: v, stableHighRiskNone: false })} />
                    <button type="button" onClick={() => resetAndUpdate({ highRiskCadStable: [], stableHighRiskNone: true })} className={`mt-4 w-full rounded-2xl border p-4 text-left transition ${form.stableHighRiskNone ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <div className="text-sm font-semibold text-slate-900">No high-risk CAD features</div>
                    </button>
                  </div>
                  <div className="mt-6"><FieldLabel>Frequent angina</FieldLabel><ToggleCards value={form.frequentAngina} onChange={(v) => update("frequentAngina", v)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></div>
                </QuestionCard>
              )}

              {currentStepKey === "acute_known_cad" && <QuestionCard title="Acute chest pain" subtitle="Does the patient have known CAD?"><ToggleCards value={form.acuteKnownCad} onChange={(v) => update("acuteKnownCad", v)} options={[{ value: "yes", label: "Known CAD" }, { value: "no", label: "No known CAD" }]} /></QuestionCard>}

              {currentStepKey === "acute_recent_test_status" && (
                <QuestionCard title="Recent test status" subtitle="Choose the most appropriate recent testing category.">
                  <div className="space-y-3">
                    {[
                      { value: "normal_recent", label: "Normal CCTA ≤2 years (no plaque / no stenosis) OR negative stress test ≤1 year with adequate stress" },
                      { value: "inconclusive_mild", label: "Inconclusive or mildly abnormal stress test done <1 year ago" },
                      { value: "moderate_severe", label: "Prior moderate or severely abnormal test done <1 year ago" },
                      { value: "no_recent", label: "No recent test" },
                    ].map((opt) => (
                      <button key={opt.value} type="button" onClick={() => update("recentTestStatus", opt.value)} className={`w-full rounded-2xl border p-4 text-left transition ${form.recentTestStatus === opt.value ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                        <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </QuestionCard>
              )}

              {currentStepKey === "acute_known_cad_type" && <QuestionCard title="Acute known CAD type" subtitle="Choose the CAD category."><ToggleCards value={form.acuteKnownCadType} onChange={(v) => update("acuteKnownCadType", v)} options={[{ value: "nonobstructive", label: "Nonobstructive CAD", description: "Stenosis <50%" }, { value: "obstructive", label: "Obstructive CAD", description: "Stenosis >50%" }]} /></QuestionCard>}

              {currentStepKey === "acute_obstructive_details" && (
                <QuestionCard title="Acute obstructive CAD details" subtitle="Select any high-risk CAD feature. If none are present, choose the dedicated card below.">
                  <CheckList items={highRiskCadFeatures} values={form.highRiskCadAcute} onChange={(v) => resetAndUpdate({ highRiskCadAcute: v, acuteHighRiskNone: false })} />
                  <button type="button" onClick={() => resetAndUpdate({ highRiskCadAcute: [], acuteHighRiskNone: true })} className={`mt-4 w-full rounded-2xl border p-4 text-left transition ${form.acuteHighRiskNone ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <div className="text-sm font-semibold text-slate-900">No high-risk CAD features</div>
                  </button>
                </QuestionCard>
              )}

              {currentStepKey === "summary" && (
                <QuestionCard title="Summary and recommendation" subtitle="Final pathway output based on the selected options.">
                  <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Selection summary</div>
                      <div className="space-y-3">
                        {outcome.summary.map(([k, v]) => (
                          <div key={`${k}-${v}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</div>
                            <div className="mt-1 text-sm font-medium text-slate-900">{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-4 flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-600" /><div className="text-lg font-bold text-slate-900">Recommendations</div></div>
                      <div className="space-y-4">
                        {outcome.recommendations.map((rec, idx) => (
                          <div key={`${rec.recClass}-${idx}`} className={`rounded-3xl border p-4 ${classBadge(rec.recClass)}`}>
                            <div className="mb-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">{rec.recClass}</div>
                            <div className="text-sm font-semibold leading-6">{rec.text}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-900">
                        <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Important notice</div>
                        This tool was made to help clinicians in decision-making and should not replace clinical human reasoning.
                      </div>
                      
                    </div>
                  </div>
                </QuestionCard>
              )}
            </div>
          </AnimatePresence>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-lg backdrop-blur">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                <Sparkles className="h-4 w-4" /> Current inferred risk
              </div>
              <div className="mb-3">{form.symptoms === "chest_pain" && risk ? <RiskPill risk={risk} /> : <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Risk will appear here once chest pain, age, and sex are provided.</div>}</div>
              <p className="text-sm leading-6 text-slate-500">This value is calculated silently from the patient profile and used in the pathway logic. It is shown here only as a quick reference.</p>
            </div>
            <div className="flex items-center justify-start rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-lg backdrop-blur">
              <button type="button" onClick={prev} disabled={currentStepIndex === 0} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition enabled:hover:border-slate-300 enabled:hover:shadow disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Previous</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
