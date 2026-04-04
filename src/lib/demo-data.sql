-- SafetyNet Demo Data
-- Run in Supabase SQL Editor after logging in with a demo GP account
-- Replace USER_ID_HERE with the actual auth.users id of your demo GP account

-- ESCALATED: Child with meningitis signs
INSERT INTO safety_nets (user_id, patient_name, patient_email, patient_dob, nhs_number, condition, timeframe_hours, red_flags, gp_name, notes, status, follow_up_method, created_at, follow_up_at) VALUES
('USER_ID_HERE', 'Amara Okafor', 'amara.okafor@demo.nhs', '2023-06-15', '943 862 1547', 'Meningitis', 48,
 ARRAY['Non-blanching rash', 'Neck stiffness', 'Photophobia', 'Bulging fontanelle', 'Altered consciousness'],
 'Dr Sarah Whitfield', 'Age 3, presented with fever and irritability', 'escalated', 'email',
 NOW() - INTERVAL '52 hours', NOW() - INTERVAL '4 hours');

-- ESCALATED: Chest pain, ACS red flags
INSERT INTO safety_nets (user_id, patient_name, patient_email, patient_dob, nhs_number, condition, timeframe_hours, red_flags, gp_name, notes, status, follow_up_method, created_at, follow_up_at) VALUES
('USER_ID_HERE', 'James Hartley', 'james.hartley@demo.nhs', '1958-11-03', '721 554 8832', 'Acute coronary syndrome', 24,
 ARRAY['Pain radiating to arm or jaw', 'Sweating', 'Breathlessness at rest', 'Nausea with chest tightness', 'Syncope'],
 'Dr Raj Patel', 'Atypical chest pain, ECG normal at presentation', 'escalated', 'email',
 NOW() - INTERVAL '28 hours', NOW() - INTERVAL '4 hours');

-- SENT: Concussion, awaiting response
INSERT INTO safety_nets (user_id, patient_name, patient_email, patient_dob, nhs_number, condition, timeframe_hours, red_flags, gp_name, notes, status, follow_up_method, created_at, follow_up_at) VALUES
('USER_ID_HERE', 'Connor Walsh', 'connor.walsh@demo.nhs', '1995-03-22', '612 443 9917', 'Concussion', 72,
 ARRAY['Vomiting more than once', 'Worsening headache', 'Confusion', 'Clear fluid from nose or ear', 'Seizure'],
 'Dr Emily Chen', 'Fell from bicycle, no LOC, GCS 15', 'sent', 'email',
 NOW() - INTERVAL '48 hours', NOW() - INTERVAL '1 hour');

-- RESOLVED: Community acquired pneumonia, patient better
INSERT INTO safety_nets (user_id, patient_name, patient_email, patient_dob, nhs_number, condition, timeframe_hours, red_flags, gp_name, notes, status, follow_up_method, created_at, follow_up_at) VALUES
('USER_ID_HERE', 'Fatima Al-Hassan', 'fatima.alhassan@demo.nhs', '1972-08-19', '834 221 6673', 'Community acquired pneumonia', 168,
 ARRAY['Oxygen sats < 94%', 'Confusion', 'Systolic BP < 90', 'Not improving after 48h antibiotics', 'Pleuritic chest pain worsening'],
 'Dr Sarah Whitfield', 'Non-smoker, CRB-65 score 1', 'resolved', 'email',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days');

-- PENDING: Cauda equina, not yet contacted
INSERT INTO safety_nets (user_id, patient_name, patient_email, patient_dob, nhs_number, condition, timeframe_hours, red_flags, gp_name, notes, status, follow_up_method, created_at, follow_up_at) VALUES
('USER_ID_HERE', 'Priya Sharma', 'priya.sharma@demo.nhs', '1988-01-07', '455 339 7721', 'Cauda equina syndrome', 24,
 ARRAY['Bladder or bowel dysfunction', 'Saddle area numbness', 'Bilateral leg weakness', 'Progressive neurological deficit', 'Urinary retention'],
 'Dr Raj Patel', 'New onset lower back pain with bilateral sciatica', 'pending', 'email',
 NOW() - INTERVAL '2 hours', NOW() + INTERVAL '22 hours');

-- PENDING: Bronchiolitis in infant, phone follow-up
INSERT INTO safety_nets (user_id, patient_name, patient_email, patient_dob, nhs_number, condition, timeframe_hours, red_flags, gp_name, notes, status, follow_up_method, created_at, follow_up_at) VALUES
('USER_ID_HERE', 'Noah Brennan', 'noah.brennan@demo.nhs', '2025-09-12', '287 664 3318', 'Bronchiolitis', 24,
 ARRAY['Breathing rate > 60', 'Apnoea episodes', 'Poor feeding <50% normal', 'Cyanosis', 'Severe chest recession'],
 'Dr Emily Chen', 'Age 6 months, mild recession, feeding 70% normal', 'pending', 'phone',
 NOW() - INTERVAL '3 hours', NOW() + INTERVAL '21 hours');

-- Check-in records for escalated and resolved
INSERT INTO check_ins (safety_net_id, patient_response, red_flags_triggered, escalated)
SELECT id, 'She has a rash that doesn''t go away when I press a glass on it, and she''s very stiff in her neck. She seems confused and won''t look at the light.',
  TRUE, TRUE
FROM safety_nets WHERE patient_name = 'Amara Okafor';

INSERT INTO check_ins (safety_net_id, patient_response, red_flags_triggered, escalated)
SELECT id, 'The pain has come back and it''s going down my left arm and into my jaw. I''m sweating a lot and feel really sick.',
  TRUE, TRUE
FROM safety_nets WHERE patient_name = 'James Hartley';

INSERT INTO check_ins (safety_net_id, patient_response, red_flags_triggered, escalated)
SELECT id, 'Feeling much better now, the antibiotics worked well. Cough is clearing up and I can breathe normally. Thank you for checking in.',
  FALSE, FALSE
FROM safety_nets WHERE patient_name = 'Fatima Al-Hassan';
