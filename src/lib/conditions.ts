/**
 * Clinical condition and red flag definitions.
 *
 * All red flags sourced from NICE Clinical Knowledge Summaries (CKS)
 * and NHS 111 pathway documentation. Each condition maps to specific
 * symptoms that warrant GP escalation — these are the "safety net"
 * instructions that GPs give verbally but are rarely tracked.
 *
 * Sources:
 *   - NICE CKS: https://cks.nice.org.uk/
 *   - NHS 111: https://111.nhs.uk/
 *   - RCGP Safety Netting guidance
 */

export interface ConditionGroup {
  specialty: string;
  conditions: string[];
}

export const CONDITION_GROUPS: ConditionGroup[] = [
  { specialty: "Paediatrics", conditions: ["Viral URTI", "Bronchiolitis", "Croup", "Febrile convulsion", "Meningitis"] },
  { specialty: "Respiratory", conditions: ["Community acquired pneumonia", "Asthma exacerbation", "Pulmonary embolism", "COPD exacerbation", "Suspected lung malignancy"] },
  { specialty: "Cardiology", conditions: ["Acute coronary syndrome", "Heart failure", "Atrial fibrillation", "Pericarditis", "Aortic dissection"] },
  { specialty: "Gastroenterology", conditions: ["Acute appendicitis", "Acute pancreatitis", "Gastroenteritis", "Upper GI bleed", "Inflammatory bowel disease flare"] },
  { specialty: "Neurology", conditions: ["Concussion", "Migraine", "Subarachnoid haemorrhage", "First seizure", "Transient ischaemic attack"] },
  { specialty: "ENT", conditions: ["Tonsillitis", "Peritonsillar abscess", "Otitis media", "Epistaxis", "Epiglottitis"] },
  { specialty: "Mental Health", conditions: ["Acute suicidal ideation", "Psychotic episode", "Acute anxiety or panic"] },
  { specialty: "Musculoskeletal", conditions: ["Suspected fracture", "Septic arthritis", "Cauda equina syndrome"] },
  { specialty: "Dermatology", conditions: ["Cellulitis", "Allergic reaction", "Necrotising fasciitis"] },
];

export const CONDITIONS = CONDITION_GROUPS.flatMap((g) => g.conditions);

export const RED_FLAGS: Record<string, string[]> = {
  // Paediatrics
  "Viral URTI": [
    "Breathing difficulty",
    "Not drinking for 8+ hours",
    "Temperature > 39°C for 3+ days",
    "Non-blanching rash",
    "Drowsy or floppy",
  ],
  Bronchiolitis: [
    "Breathing rate > 60",
    "Apnoea episodes",
    "Poor feeding <50% normal",
    "Cyanosis",
    "Severe chest recession",
  ],
  Croup: [
    "Stridor at rest",
    "Severe chest wall recession",
    "Agitation or lethargy",
    "Cyanosis",
    "Drooling or unable to swallow",
  ],
  "Febrile convulsion": [
    "Seizure lasting > 5 mins",
    "Second seizure within 24h",
    "Non-blanching rash",
    "Neck stiffness",
    "Not recovering within 1 hour",
  ],
  Meningitis: [
    "Non-blanching rash",
    "Neck stiffness",
    "Photophobia",
    "Bulging fontanelle",
    "Altered consciousness",
  ],
  // Respiratory
  "Community acquired pneumonia": [
    "Oxygen sats < 94%",
    "Confusion",
    "Systolic BP < 90",
    "Not improving after 48h antibiotics",
    "Pleuritic chest pain worsening",
  ],
  "Asthma exacerbation": [
    "Unable to complete sentences",
    "Peak flow < 50% best",
    "Using accessory muscles",
    "Silent chest",
    "Cyanosis",
  ],
  "Pulmonary embolism": [
    "Sudden breathlessness",
    "Haemoptysis",
    "Pleuritic chest pain",
    "Tachycardia > 120",
    "Syncope",
  ],
  "COPD exacerbation": [
    "Severe breathlessness at rest",
    "Confusion",
    "Peripheral oedema",
    "Cyanosis",
    "Not responding to treatment",
  ],
  "Suspected lung malignancy": [
    "Haemoptysis",
    "Unexplained weight loss > 3kg",
    "Persistent chest pain",
    "Hoarse voice > 3 weeks",
    "Superior vena cava obstruction signs",
  ],
  // Cardiology
  "Acute coronary syndrome": [
    "Pain radiating to arm or jaw",
    "Sweating",
    "Breathlessness at rest",
    "Nausea with chest tightness",
    "Syncope",
  ],
  "Heart failure": [
    "Breathlessness lying flat",
    "Weight gain > 2kg in 2 days",
    "New ankle swelling",
    "Unable to walk across room",
    "Chest pain",
  ],
  "Atrial fibrillation": [
    "Chest pain",
    "Syncope",
    "Breathlessness at rest",
    "Heart rate > 150",
    "Signs of stroke",
  ],
  Pericarditis: [
    "Worsening chest pain not relieved by sitting forward",
    "Breathlessness",
    "Fever > 38°C for 48h",
    "Syncope",
    "New heart murmur",
  ],
  "Aortic dissection": [
    "Tearing chest or back pain",
    "BP difference between arms",
    "New neurological symptoms",
    "Syncope",
    "Limb ischaemia signs",
  ],
  // Gastroenterology
  "Acute appendicitis": [
    "Pain migrating to right iliac fossa",
    "Fever > 38°C",
    "Rigidity on palpation",
    "Vomiting increasing",
    "Unable to mobilise",
  ],
  "Acute pancreatitis": [
    "Severe epigastric pain radiating to back",
    "Persistent vomiting",
    "Fever",
    "Tachycardia",
    "Grey Turner or Cullen sign",
  ],
  Gastroenteritis: [
    "Unable to keep fluids down for 12h",
    "Blood in stool",
    "Fever > 39°C for 48h",
    "Signs of dehydration",
    "Severe abdominal pain",
  ],
  "Upper GI bleed": [
    "Vomiting blood or coffee grounds",
    "Black tarry stools",
    "Dizziness on standing",
    "Heart rate > 100",
    "Fainting",
  ],
  "Inflammatory bowel disease flare": [
    "Bloody diarrhoea > 6x daily",
    "Fever",
    "Tachycardia",
    "Abdominal distension",
    "Weight loss",
  ],
  // Neurology
  Concussion: [
    "Vomiting more than once",
    "Worsening headache",
    "Confusion",
    "Clear fluid from nose or ear",
    "Seizure",
  ],
  Migraine: [
    "Worst headache of life",
    "Neck stiffness",
    "Fever",
    "New neurological weakness",
    "Vision loss",
  ],
  "Subarachnoid haemorrhage": [
    "Thunderclap headache",
    "Neck stiffness",
    "Photophobia",
    "Reduced consciousness",
    "New neurological deficit",
  ],
  "First seizure": [
    "Further seizures",
    "Not regaining consciousness within 30 min",
    "Focal neurological deficit",
    "Persistent confusion",
    "Tongue bite with no recovery",
  ],
  "Transient ischaemic attack": [
    "Recurrence of symptoms",
    "New facial droop",
    "Arm or leg weakness",
    "Speech difficulty",
    "Visual loss",
  ],
  // ENT
  Tonsillitis: [
    "Unable to swallow fluids",
    "Trismus (can't open mouth)",
    "Unilateral swelling",
    "Drooling",
    "Difficulty breathing",
  ],
  "Peritonsillar abscess": [
    "Trismus",
    "Uvula deviation",
    "Hot potato voice",
    "Fever > 39°C",
    "Airway compromise",
  ],
  "Otitis media": [
    "Mastoid swelling or redness",
    "Facial nerve weakness",
    "High fever for 48h",
    "Neck stiffness",
    "Persistent discharge",
  ],
  Epistaxis: [
    "Bleeding not stopping after 20 min pressure",
    "Bilateral bleeding",
    "Dizziness or fainting",
    "On anticoagulants with continued bleeding",
    "Recurrent heavy episodes",
  ],
  Epiglottitis: [
    "Stridor",
    "Drooling",
    "Tripod positioning",
    "Rapid deterioration",
    "Muffled voice",
  ],
  // Mental Health
  "Acute suicidal ideation": [
    "Active plan formed",
    "Access to means",
    "Recent attempt",
    "Command hallucinations",
    "Final acts (giving away possessions)",
  ],
  "Psychotic episode": [
    "Command hallucinations to harm",
    "Refusal of food or water for 24h",
    "Self-neglect",
    "Extreme agitation",
    "Catatonia",
  ],
  "Acute anxiety or panic": [
    "Chest pain lasting > 30 min",
    "Self-harm ideation",
    "Dissociation",
    "Unable to function for basic needs",
    "Substance use to cope",
  ],
  // Musculoskeletal
  "Suspected fracture": [
    "Increasing pain despite immobilisation",
    "Numbness or tingling beyond injury",
    "Skin colour change in limb",
    "Unable to bear weight at all",
    "Visible deformity worsening",
  ],
  "Septic arthritis": [
    "Fever with hot swollen joint",
    "Unable to weight bear",
    "Worsening despite antibiotics",
    "Red tracking up limb",
    "Rigors",
  ],
  "Cauda equina syndrome": [
    "Bladder or bowel dysfunction",
    "Saddle area numbness",
    "Bilateral leg weakness",
    "Progressive neurological deficit",
    "Urinary retention",
  ],
  // Dermatology
  Cellulitis: [
    "Rapidly spreading redness",
    "Fever > 38°C",
    "Red tracking lines",
    "Pain out of proportion",
    "Blistering",
  ],
  "Allergic reaction": [
    "Facial or tongue swelling",
    "Difficulty breathing",
    "Widespread urticaria spreading",
    "Dizziness or faintness",
    "Abdominal pain with rash",
  ],
  "Necrotising fasciitis": [
    "Pain out of proportion to appearance",
    "Crepitus",
    "Rapid spread",
    "Systemic toxicity",
    "Skin blistering or necrosis",
  ],
};

export const TIMEFRAMES = [
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "72h", hours: 72 },
  { label: "7 days", hours: 168 },
] as const;
