import { createClient } from '@supabase/supabase-js';

const url = "https://eppbwhvtezpcbukcshxu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwcGJ3aHZ0ZXpwY2J1a2NzaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NzU2ODUsImV4cCI6MjA5ODM1MTY4NX0.hn5S8wnseARTq3s6ozP4HbUtLwLtLmd0-s6fLwo-ML0";

const supabase = createClient(url, anonKey);

async function testInsert() {
  const { error } = await supabase.from('pkl_classes').insert({
    id: "99999999-9999-9999-9999-999999999999",
    nama_kelas: "TEST CLASS",
    jurusan: "TEST JURUSAN"
  });
  if (error) {
    console.log("Insert into pkl_classes failed:", error.message, error.code);
  } else {
    console.log("Insert into pkl_classes succeeded!");
    await supabase.from('pkl_classes').delete().eq('id', "99999999-9999-9999-9999-999999999999");
  }
}

testInsert();
