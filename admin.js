function getSlugFromUrl(){
  const parts=window.location.pathname.split('/').filter(Boolean);
  if(parts.length>0){
    const f=parts[0].toLowerCase();
    if(!['admin.html','barbeiro.html','cliente.html','admin','barbeiro','cliente','index.html','hub.html'].includes(f)) return f;
  }
  const p=new URLSearchParams(window.location.search);
  if(p.get('b')) return p.get('b').toLowerCase();
  return localStorage.getItem('dnh_slug')||'dnh';
}
const cfg=window.DNH_CONFIG||{};
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let CURRENT_SLUG=getSlugFromUrl();localStorage.setItem('dnh_slug',CURRENT_SLUG);
let settings={};
const $=s=>document.querySelector(s);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const todayLocal=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};

// Abas
document.querySelectorAll('[data-tab]').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active');
  };
});

async function checkLogin(){
  $('#loginSlug').textContent='/'+CURRENT_SLUG;
  $('#slugAdmin').textContent='/'+CURRENT_SLUG;
  $('#linkVoltarHub').href='/'+CURRENT_SLUG;
  $('#linkPublicoAdmin').href='/'+CURRENT_SLUG;
  const {data:{session}}=await sb.auth.getSession();
  if(!session){ $('#telaLogin').style.display='block'; $('#telaAdmin').style.display='none'; return false; }
  $('#emailLogado').textContent=session.user.email;
  $('#telaLogin').style.display='none'; $('#telaAdmin').style.display='block';
  await initAdmin();
  return true;
}

$('#btnLogin')?.addEventListener('click', async ()=>{
  const email=$('#loginEmail').value.trim(), password=$('#loginSenha').value;
  if(!email||!password){ $('#msgLogin').textContent='Preencha email e senha'; return; }
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){ $('#msgLogin').textContent=error.message; return; }
  location.reload();
});
$('#btnSair')?.addEventListener('click', async ()=>{ await sb.auth.signOut(); location.reload(); });

async function initAdmin(){
  const {data:set}=await sb.from('settings').select('*').eq('slug',CURRENT_SLUG).maybeSingle();
  if(set){ settings=set; $('#nomeAdmin').textContent=set.name||CURRENT_SLUG; }
  $('#linkPublico').value = location.origin+'/'+CURRENT_SLUG;
  $('#filtroData').value = todayLocal();

  // Carrega barbeiros no filtro
  const {data:profs=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).eq('active',true);
  $('#filtroBarbeiro').innerHTML='<option value="">Todos</option>'+profs.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

  // Config form
  if(set){
    $('#cfgNome').value=set.name||'';
    $('#cfgLogo').value=set.logo_url||'';
    $('#cfgWhatsapp').value=set.whatsapp||'';
    $('#cfgStart').value=(set.start_time||'08:00').slice(0,5);
    $('#cfgEnd').value=(set.end_time||'18:00').slice(0,5);
    $('#cfgInterval').value=set.slot_interval||30;
    $('#cfgLunchStart').value=(set.lunch_start||'12:00').slice(0,5);
    $('#cfgLunchEnd').value=(set.lunch_end||'13:00').slice(0,5);
  }
  // Weekly
  const dias=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const weekly=settings.weekly_schedule||{};
  $('#cfgWeekly').innerHTML=dias.map((n,i)=>{
    const c=weekly[i];
    const on = c ? c.enabled!==false : true;
    const s = c?.start||settings.start_time||'08:00';
    const e = c?.end||settings.end_time||'18:00';
    return `<label style="background:#111827;border:1px solid #222;border-radius:8px;padding:8px;text-align:center"><input type="checkbox" data-dia="${i}" ${on?'checked':''} style="width:auto"> ${n}<br><input type="time" data-start="${i}" value="${s.slice(0,5)}" style="padding:4px;margin-top:4px"><input type="time" data-end="${i}" value="${e.slice(0,5)}" style="padding:4px"></label>`;
  }).join('');

  await carregarDashboard();
  await carregarAniversariantes();
  await carregarAgenda();
  await carregarClientes();
  await carregarServicos();
  await carregarBarbeiros();
}

async function carregarDashboard(){
  const mes = todayLocal().slice(0,7);
  const {data:books=[]}=await sb.from('bookings').select('*').eq('slug',CURRENT_SLUG);
  const hoje = books.filter(b=>b.booking_date===todayLocal() && b.status!=='cancelled');
  $('#totalHoje').textContent=hoje.length;
  const fat = books.filter(b=>b.booking_date.startsWith(mes) && b.status!=='cancelled').reduce((s,b)=>s+Number(b.price||0),0);
  $('#totalFaturamento').textContent=money(fat);
}

// ===== ANIVERSARIANTES + TOTAL CLIENTES =====
async function carregarAniversariantes(){
  const {data:clientes=[]} = await sb.from('customers').select('*').eq('slug', CURRENT_SLUG);
  const elTotal = document.getElementById('totalClientes');
  if(elTotal) elTotal.textContent = clientes.length;

  const hoje = new Date();
  const mesHoje = hoje.getMonth()+1;
  const diaHoje = hoje.getDate();
  const comNasc = clientes.filter(c=>c.birthdate);
  const doMes = comNasc.filter(c=>{
    const d = new Date(c.birthdate+'T12:00:00');
    return (d.getMonth()+1)===mesHoje;
  });
  const deHoje = doMes.filter(c=> new Date(c.birthdate+'T12:00:00').getDate()===diaHoje);
  doMes.sort((a,b)=> new Date(a.birthdate).getDate() - new Date(b.birthdate).getDate());

  const elMes = document.getElementById('totalAniversarioMes');
  if(elMes) elMes.textContent = doMes.length;
  const elLista = document.getElementById('listaAniversarioMes');
  if(elLista) elLista.innerHTML = doMes.map(c=>{
    const d = new Date(c.birthdate+'T12:00:00');
    const ehHoje = d.getDate()===diaHoje ? ' <b style="color:#d4af37">- HOJE 🎉</b>' : '';
    const msg = encodeURIComponent(`Fala ${c.name}! Aqui é da ${settings?.name||'nossa barbearia'}! Parabéns pelo seu dia! 🎂✂️ Passa aqui essa semana que você tem 20% DE DESCONTO DE ANIVERSARIANTE! Quer agendar?`);
    const wa = `https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}`;
    return `• ${c.name} - ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} - ${c.phone} <a href="${wa}" target="_blank" style="color:#25D366">WhatsApp</a>${ehHoje}`;
  }).join('<br>') || 'Nenhum esse mês';

  if(deHoje.length>0){
    const card = document.getElementById('cardAniversario');
    if(card){
      card.style.display='block';
      document.getElementById('listaAniversarioHoje').innerHTML = deHoje.map(c=>`🎉 <b>${c.name}</b> - ${c.phone} - faz aniversário hoje!`).join('<br>');
      document.getElementById('botoesAniversarioHoje').innerHTML = deHoje.map(c=>{
        const msg = encodeURIComponent(`Fala ${c.name}! Aqui é da ${settings?.name||'nossa barbearia'}! Parabéns pelo seu dia! 🎂 Hoje você tem 20% DE DESCONTO DE ANIVERSARIANTE, quer aproveitar e agendar seu corte?`);
        return `<a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank" style="display:inline-block;margin:6px 6px 0 0;background:#25D366;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:700">WhatsApp ${c.name}</a>`;
      }).join('');
    }
  }
}

// ===== AGENDA =====
async function carregarAgenda(){
  const data=$('#filtroData').value||todayLocal();
  const barb=$('#filtroBarbeiro').value;
  let q=sb.from('bookings').select('*, services(name), professionals(name)').eq('slug',CURRENT_SLUG).eq('booking_date',data).order('booking_time');
  if(barb) q=q.eq('professional_id',barb);
  const {data:books=[]}=await q;
  $('#listaAgenda').innerHTML = books.map(b=>`
    <div style="background:#111827;border:1px solid #222;border-radius:10px;padding:10px;margin:6px 0;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div><b>${(b.booking_time||'').slice(0,5)}</b> - ${b.client_name} - ${b.services?.name||''} - ${b.professionals?.name||''}<br><small>${b.phone||''} • ${money(b.price)} • ${b.status} • ${b.paid?'Pago ✅':'Não pago'}</small></div>
      <div style="display:flex;gap:6px">
        <button class="green" onclick="marcarPago('${b.id}',${!b.paid})">${b.paid?'Desmarcar pago':'Marcar pago'}</button>
        <button class="red" onclick="cancelarBooking('${b.id}')">Cancelar</button>
      </div>
    </div>`).join('') || 'Nenhum agendamento nesse dia';
}
window.marcarPago=async(id,val)=>{ await sb.from('bookings').update({paid:val}).eq('id',id); carregarAgenda(); carregarDashboard(); };
window.cancelarBooking=async(id)=>{ if(!confirm('Cancelar?'))return; await sb.from('bookings').update({status:'cancelled'}).eq('id',id); carregarAgenda(); carregarDashboard(); };
$('#btnCarregarAgenda')?.addEventListener('click',carregarAgenda);
$('#filtroBarbeiro')?.addEventListener('change',carregarAgenda);

// ===== CLIENTES =====
async function carregarClientes(filtro=''){
  let q=sb.from('customers').select('*').eq('slug',CURRENT_SLUG).order('created_at',{ascending:false}).limit(100);
  const {data:clientes=[]}=await q;
  let lista=clientes;
  if(filtro){
    const f=filtro.toLowerCase();
    lista=clientes.filter(c=>c.name.toLowerCase().includes(f)||String(c.phone).includes(f));
  }
  // Conta agendamentos por telefone
  const {data:books=[]}=await sb.from('bookings').select('phone').eq('slug',CURRENT_SLUG);
  const count={}; books.forEach(b=>{count[String(b.phone).replace(/\D/g,'')]=(count[String(b.phone).replace(/\D/g,'')]||0)+1});
  $('#listaClientes').innerHTML = lista.map(c=>{
    const d=c.birthdate?new Date(c.birthdate+'T12:00:00'):null;
    const nasc=d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:'—';
    const isHoje = d && d.getDate()===new Date().getDate() && (d.getMonth()+1)===(new Date().getMonth()+1) ? ' 🎂 HOJE' : '';
    const msg = encodeURIComponent(`Fala ${c.name}! Aqui é da ${settings?.name||'nossa barbearia'}! Quer agendar seu próximo corte?`);
    return `<div style="background:#111827;border:1px solid #222;border-radius:10px;padding:10px;margin:6px 0;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>${c.name}${isHoje}</b><br><small>${c.phone} • Nasc: ${nasc} • ${count[String(c.phone).replace(/\D/g,'')]||0} agendamentos • Desde ${new Date(c.created_at).toLocaleDateString('pt-BR')}</small></div><div><a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank"><button class="green">WhatsApp</button></a> <button class="red" onclick="excluirCliente('${c.id}')">Excluir</button></div></div>`;
  }).join('') || 'Nenhum cliente ainda';
}
window.excluirCliente=async(id)=>{ if(!confirm('Excluir cliente?'))return; await sb.from('customers').delete().eq('id',id); carregarClientes(); carregarAniversariantes(); };
$('#btnBuscarCliente')?.addEventListener('click',()=>carregarClientes($('#buscaCliente').value));
$('#buscaCliente')?.addEventListener('input',e=>carregarClientes(e.target.value));

// ===== SERVIÇOS =====
async function carregarServicos(){
  const {data:servs=[]}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG).order('name');
  $('#listaServicos').innerHTML=servs.map(s=>`<div style="display:flex;justify-content:space-between;gap:8px;background:#111827;border:1px solid #222;border-radius:10px;padding:10px;margin:6px 0"><span><b>${s.name}</b> - ${money(s.price)} - ${s.duration}min - ${s.active?'Ativo':'Inativo'}</span><button class="red" onclick="excluirServico('${s.id}')">Excluir</button></div>`).join('')||'Nenhum serviço';
}
window.excluirServico=async(id)=>{ await sb.from('services').delete().eq('id',id); carregarServicos(); };
$('#btnAddServico')?.addEventListener('click', async ()=>{
  const name=$('#srvNome').value.trim(), price=Number($('#srvPreco').value), duration=Number($('#srvDuracao').value);
  if(!name){alert('Nome do serviço');return;}
  const {error}=await sb.from('services').insert({slug:CURRENT_SLUG,name,price,duration,active:true});
  if(error){alert(error.message);return;}
  $('#srvNome').value=''; carregarServicos();
});

// ===== BARBEIROS =====
async function carregarBarbeiros(){
  const {data:profs=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).order('name');
  $('#listaBarbeiros').innerHTML=profs.map(p=>`<div style="display:flex;justify-content:space-between;gap:8px;background:#111827;border:1px solid #222;border-radius:10px;padding:10px;margin:6px 0"><span><b>${p.name}</b><br><small>${p.phone||''} • ${p.email||''} • ${p.active?'Ativo':'Inativo'}</small></span><button class="red" onclick="excluirBarbeiro('${p.id}')">Excluir</button></div>`).join('')||'Nenhum barbeiro';
}
window.excluirBarbeiro=async(id)=>{ await sb.from('professionals').delete().eq('id',id); carregarBarbeiros(); };
$('#btnAddBarbeiro')?.addEventListener('click', async ()=>{
  const name=$('#profNome').value.trim(), phone=$('#profPhone').value.trim(), email=$('#profEmail').value.trim();
  if(!name){alert('Nome do barbeiro');return;}
  const {error}=await sb.from('professionals').insert({slug:CURRENT_SLUG,name,phone,email,active:true});
  if(error){alert(error.message);return;}
  $('#profNome').value=''; $('#profPhone').value=''; $('#profEmail').value=''; carregarBarbeiros();
});

// ===== CONFIG =====
$('#btnSalvarConfig')?.addEventListener('click', async ()=>{
  const weekly={};
  document.querySelectorAll('[data-dia]').forEach(cb=>{
    const i=cb.dataset.dia;
    const s=document.querySelector(`[data-start="${i}"]`)?.value||'08:00';
    const e=document.querySelector(`[data-end="${i}"]`)?.value||'18:00';
    weekly[i]={enabled:cb.checked,start:s,end:e};
  });
  const payload={
    slug:CURRENT_SLUG,
    name:$('#cfgNome').value.trim()||CURRENT_SLUG,
    logo_url:$('#cfgLogo').value.trim()||null,
    whatsapp:$('#cfgWhatsapp').value.trim()||null,
    start_time:$('#cfgStart').value,
    end_time:$('#cfgEnd').value,
    slot_interval:Number($('#cfgInterval').value)||30,
    lunch_start:$('#cfgLunchStart').value,
    lunch_end:$('#cfgLunchEnd').value,
    weekly_schedule:weekly
  };
  const {error}=await sb.from('settings').upsert(payload,{onConflict:'slug'});
  if(error){ $('#msgConfig').textContent=error.message; $('#msgConfig').style.color='#f87171'; return; }
  settings=payload;
  $('#msgConfig').textContent='✅ Salvo!'; $('#msgConfig').style.color='#4ade80';
  $('#nomeAdmin').textContent=payload.name;
});

checkLogin();
